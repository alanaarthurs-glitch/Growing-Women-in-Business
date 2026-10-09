const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");

const NOTION_API_KEY = process.env.NOTION_API_KEY || "";
const NOTION_APPLICATIONS_DB_ID = process.env.NOTION_APPLICATIONS_DB_ID || "";
const NOTION_NEWSLETTER_DB_ID = process.env.NOTION_NEWSLETTER_DB_ID || "";
const NOTION_CRM_DB_ID = process.env.NOTION_CRM_DB_ID || "";
const NOTION_VERSION = "2022-06-28";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const PDF_DIR = path.join(__dirname, "assets", "pdfs");

// One line about the next Cohort, used in the scorecard email. Set it in
// Railway (for example "The next Future Maker Cohort starts on 12 January.")
// and clear it when there is no date. Empty means the email says nothing
// about dates, so it can never go stale.
const NEXT_COHORT_LINE = process.env.NEXT_COHORT_LINE || "";

// Every outbound call (Notion, Resend) gives up after this long, so a slow
// third party can never hold a request open for ever.
const FETCH_TIMEOUT_MS = 8000;

// The canonical site origin, always the www host. Used both to build the
// redirect target and, with the protocol and "www." stripped, to recognise
// the bare (non-www) host that should be redirected. Never matches a
// localhost or Railway-internal hostname, so previews and health checks
// are left alone.
const SITE_ORIGIN = (process.env.SITE_ORIGIN || "https://www.growingwomeninbusiness.com").replace(/\/+$/, "");
function deriveBareHost(origin) {
  const withoutProtocol = origin.replace(/^https?:\/\//i, "");
  const hostOnly = withoutProtocol.split("/")[0];
  return hostOnly.replace(/^www\./i, "");
}
const BARE_HOST = deriveBareHost(SITE_ORIGIN);

// Content Security Policy. Locks scripts, frames, images, fonts and form
// targets to this site plus PayPal (the buttons and checkout) and Google
// Fonts. Inline scripts and styles stay allowed because the pages carry small
// inline scripts and the PayPal SDK injects its own; anything else off-site
// is blocked by the browser. To add a new third party, add its origin to the
// relevant directive here.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self' https://*.paypal.com",
  "script-src 'self' 'unsafe-inline' https://*.paypal.com https://*.paypalobjects.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.paypal.com https://*.paypalobjects.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: https://*.paypal.com https://*.paypalobjects.com",
  "frame-src https://*.paypal.com",
  "connect-src 'self' https://*.paypal.com https://*.paypalobjects.com",
  "upgrade-insecure-requests",
].join("; ");

// One year of HSTS, covering subdomains, with the preload flag. Only sent on
// HTTPS responses. The flag on its own does nothing: the domain only joins
// the browser preload list once it is submitted at hstspreload.org, and that
// is slow to undo, so only submit once every subdomain is on HTTPS.
const STRICT_TRANSPORT_SECURITY = "max-age=31536000; includeSubDomains; preload";

// Cross-Origin-Opener-Policy. "same-origin-allow-popups" keeps other sites
// from scripting our windows but still lets the PayPal checkout popup (used
// by the Circle subscription button) talk back to the page that opened it.
// Plain "same-origin" would cut that link and break the PayPal popup.
const CROSS_ORIGIN_OPENER_POLICY = "same-origin-allow-popups";

const KNOWN_ARCHETYPES = [
  "The Wildflower", "The Ember", "The Pearl", "Mademoiselle", "The Late Bloomer",
  "The Firestarter", "The Sage", "The Live Wire", "The Anchor",
];

const ARCHETYPE_PDF_KEYS = {
  "The Wildflower": "wildflower",
  "The Ember": "ember",
  "The Pearl": "pearl",
  "Mademoiselle": "mademoiselle",
  "The Late Bloomer": "latebloomer",
  "The Firestarter": "firestarter",
  "The Sage": "sage",
  "The Live Wire": "livewire",
  "The Anchor": "anchor",
};

const KNOWN_SOURCES = [
  "Home Quiz", "Circle Welcome", "Cohort Welcome", "Free Newsletter Card",
  "Push Waitlist", "Cohort Waitlist", "Webinar Waitlist", "Newsletter Panel", "Findable Scorecard", "Draw a Card",
  "Free Prompts",
];

const KNOWN_APPLY_CATEGORIES = ["Pricing", "Visibility", "The Avoided Conversation"];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
};

// Types that are worth gzipping. Anything not in this list (in particular
// every image type except SVG) is left alone.
const GZIPPABLE_TYPES = ["application/javascript", "application/json", "application/xml", "image/svg+xml"];

function isGzippable(contentType) {
  const bareType = contentType.split(";")[0].trim();
  if (bareType.indexOf("text/") === 0) return true;
  return GZIPPABLE_TYPES.indexOf(bareType) !== -1;
}

// HTML is never cached (content changes often and there's no build hash).
// Static assets under css/js/images, plus the favicon, are cached for a day.
// Everything else (robots.txt, sitemap.xml, etc.) gets no explicit header.
function getCacheControl(filePath, ext) {
  if (ext === ".html") return "no-cache";
  const relative = path.relative(PUBLIC_DIR, filePath).split(path.sep).join("/");
  if (
    relative.indexOf("css/") === 0 ||
    relative.indexOf("js/") === 0 ||
    relative.indexOf("images/") === 0 ||
    relative === "favicon.svg"
  ) {
    return "public, max-age=86400";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Static file cache
// ---------------------------------------------------------------------------
// Each file is read and gzipped once, then kept in memory with its ETag.
// Every request still does a cheap fs.stat, so editing a file on disk is
// picked up straight away (the mtime or size changes and the entry is
// rebuilt). Files over MAX_CACHED_FILE_BYTES are read fresh each time.
const MAX_CACHED_FILE_BYTES = 5 * 1024 * 1024;
const staticCache = new Map();

function buildEntry(filePath, stats, raw) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const hash = crypto.createHash("sha1").update(raw).digest("base64url").slice(0, 22);
  const gz = isGzippable(contentType) && raw.length > 1024 ? zlib.gzipSync(raw) : null;
  return {
    raw,
    gz,
    etag: `W/"${hash}"`,
    mtimeMs: stats.mtimeMs,
    size: stats.size,
    contentType,
    cacheControl: getCacheControl(filePath, ext),
  };
}

function loadFile(filePath, stats) {
  const cached = staticCache.get(filePath);
  if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
    return Promise.resolve(cached);
  }
  return fs.promises.readFile(filePath).then((raw) => {
    const entry = buildEntry(filePath, stats, raw);
    if (raw.length <= MAX_CACHED_FILE_BYTES) staticCache.set(filePath, entry);
    return entry;
  });
}

function etagMatches(ifNoneMatch, etag) {
  if (!ifNoneMatch) return false;
  const bare = etag.replace(/^W\//, "");
  return ifNoneMatch.split(",").some((tag) => {
    const t = tag.trim();
    return t === "*" || t.replace(/^W\//, "") === bare;
  });
}

function sendEntry(req, res, entry, statusCode) {
  const headers = { "Content-Type": entry.contentType, "ETag": entry.etag };
  if (entry.cacheControl) headers["Cache-Control"] = entry.cacheControl;
  if (entry.gz) headers["Vary"] = "Accept-Encoding";

  if (statusCode === 200 && etagMatches(req.headers["if-none-match"], entry.etag)) {
    res.writeHead(304, headers);
    res.end();
    return;
  }

  const acceptEncoding = req.headers["accept-encoding"] || "";
  let body = entry.raw;
  if (entry.gz && /\bgzip\b/.test(acceptEncoding)) {
    headers["Content-Encoding"] = "gzip";
    body = entry.gz;
  }
  headers["Content-Length"] = body.length;
  res.writeHead(statusCode, headers);
  if (req.method === "HEAD") res.end();
  else res.end(body);
}

function sendNotFound(req, res) {
  const notFoundPath = path.join(PUBLIC_DIR, "404.html");
  fs.promises.stat(notFoundPath)
    .then((stats) => loadFile(notFoundPath, stats))
    .then((entry) => sendEntry(req, res, entry, 404))
    .catch(() => {
      if (res.headersSent) return;
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    });
}

function isInsidePublic(filePath) {
  return filePath === PUBLIC_DIR || filePath.startsWith(PUBLIC_DIR + path.sep);
}

async function statFile(filePath) {
  try {
    return await fs.promises.stat(filePath);
  } catch (err) {
    return null;
  }
}

// Resolves a request path against public/: exact files and directories
// (served as index.html) first, then, for an extension-less path, a clean
// URL match against "<path>.html". Anything left over is a 404.
async function serveStatic(req, res, urlPath) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Allow": "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }
  // The Future Maker Cohort came off the site on 25 September 2026. Old links land on the offers.
  if (urlPath === "/cohort" || urlPath === "/cohort.html") {
    res.writeHead(301, { Location: "/#offer" });
    res.end();
    return;
  }
  // The Push is off the site for now. Old links land on the homepage.
  if (urlPath === "/push" || urlPath === "/push.html") {
    res.writeHead(301, { Location: "/" });
    res.end();
    return;
  }

  let filePath = path.join(PUBLIC_DIR, urlPath === "/" ? "index.html" : urlPath);
  if (!isInsidePublic(filePath)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  let stats = await statFile(filePath);
  if (stats && stats.isDirectory()) {
    filePath = path.join(filePath, "index.html");
    stats = await statFile(filePath);
  }
  if (!stats && path.extname(filePath) === "") {
    const htmlPath = filePath + ".html";
    if (isInsidePublic(htmlPath)) {
      filePath = htmlPath;
      stats = await statFile(filePath);
    }
  }
  if (!stats || !stats.isFile()) {
    sendNotFound(req, res);
    return;
  }

  const entry = await loadFile(filePath, stats);
  sendEntry(req, res, entry, 200);
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function sendJSON(res, status, body, extraHeaders) {
  if (res.headersSent) return;
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...(extraHeaders || {}) });
  res.end(data);
}

// Every field from a form goes through this. Anything that is not a string
// (a number, an array, an object, null) becomes an empty string, so a
// crafted body can never reach .trim() on the wrong type.
function str(x) {
  return typeof x === "string" ? x.trim() : "";
}

function isPlainObject(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x) &&
    Object.getPrototypeOf(x) === Object.prototype;
}

const EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
function isEmail(email) {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

// Escapes the five characters that matter in HTML text and attributes.
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Reads a JSON request body. Refuses anything that is not sent as
// application/json (415), anything over 32 KB (413) and anything that is not
// a plain JSON object (400). The forms on the site send a few hundred bytes.
const MAX_BODY_BYTES = 32 * 1024;
function readBody(req) {
  return new Promise((resolve, reject) => {
    const contentType = (req.headers["content-type"] || "").toLowerCase();
    if (contentType.indexOf("application/json") !== 0) {
      req.resume();
      reject(new HttpError(415, "Send JSON"));
      return;
    }
    const declared = parseInt(req.headers["content-length"] || "0", 10);
    if (declared > MAX_BODY_BYTES) {
      req.resume();
      reject(new HttpError(413, "Too large"));
      return;
    }

    const chunks = [];
    let total = 0;
    let done = false;
    req.on("data", (chunk) => {
      if (done) return;
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        done = true;
        reject(new HttpError(413, "Too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (done) return;
      done = true;
      let parsed;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch (err) {
        reject(new HttpError(400, "Invalid request body"));
        return;
      }
      if (!isPlainObject(parsed)) {
        reject(new HttpError(400, "Invalid request body"));
        return;
      }
      resolve(parsed);
    });
    req.on("error", (err) => {
      if (done) return;
      done = true;
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Abuse limits (all in memory, reset when the server restarts)
// ---------------------------------------------------------------------------

// Token bucket per key. Each key starts with `capacity` tokens and earns
// them back at capacity per windowMs. With 20 per 10 minutes, someone can
// send 20 forms in a burst, then one every 30 seconds. The Map is pruned on
// a timer and never grows past maxKeys.
function createRateLimiter(options) {
  const capacity = (options && options.capacity) || 20;
  const windowMs = (options && options.windowMs) || 10 * 60 * 1000;
  const maxKeys = (options && options.maxKeys) || 10000;
  const refillPerMs = capacity / windowMs;
  const buckets = new Map();

  function prune(now) {
    if (typeof now !== "number") now = Date.now();
    for (const [key, b] of buckets) {
      if (now - b.last >= windowMs) buckets.delete(key);
    }
  }

  function take(key, now) {
    if (typeof now !== "number") now = Date.now();
    let b = buckets.get(key);
    if (!b) {
      if (buckets.size >= maxKeys) {
        prune(now);
        // Still full: drop the oldest entry (Maps keep insertion order).
        if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value);
      }
      b = { tokens: capacity, last: now };
      buckets.set(key, b);
    } else {
      b.tokens = Math.min(capacity, b.tokens + (now - b.last) * refillPerMs);
      b.last = now;
    }
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return { ok: true, remaining: Math.floor(b.tokens), retryAfter: 0 };
    }
    const retryAfter = Math.max(1, Math.ceil((1 - b.tokens) / refillPerMs / 1000));
    return { ok: false, remaining: 0, retryAfter };
  }

  return { take, prune, size: () => buckets.size, capacity, windowMs };
}

// One email of each kind per address per 24 hours, so the forms can't be
// used to flood someone's inbox through Resend.
function createSendGuard(options) {
  const ttlMs = (options && options.ttlMs) || 24 * 60 * 60 * 1000;
  const maxKeys = (options && options.maxKeys) || 50000;
  const sent = new Map();

  function prune(now) {
    if (typeof now !== "number") now = Date.now();
    for (const [key, at] of sent) {
      if (now - at >= ttlMs) sent.delete(key);
    }
  }

  // Returns true (and records the send) the first time; false after that.
  function claim(kind, email, now) {
    if (typeof now !== "number") now = Date.now();
    const key = kind + ":" + email.toLowerCase();
    const at = sent.get(key);
    if (at !== undefined && now - at < ttlMs) return false;
    if (sent.size >= maxKeys) {
      prune(now);
      if (sent.size >= maxKeys) sent.delete(sent.keys().next().value);
    }
    sent.set(key, now);
    return true;
  }

  return { claim, prune, size: () => sent.size };
}

const apiLimiter = createRateLimiter({ capacity: 60, windowMs: 10 * 60 * 1000, maxKeys: 10000 });
const sendGuard = createSendGuard({ ttlMs: 24 * 60 * 60 * 1000, maxKeys: 50000 });
setInterval(() => {
  apiLimiter.prune();
  sendGuard.prune();
}, 60 * 1000).unref();

// How many proxies sit in front of this server and add to X-Forwarded-For
// (Railway's edge is 1; add 1 more if Cloudflare goes in front). The sender
// controls the START of that header, so only the values the proxies added at
// the END can be trusted. Never use the first value.
const TRUST_PROXY_HOPS = Math.max(0, parseInt(process.env.TRUST_PROXY_HOPS || "1", 10) || 0);
function clientIp(req) {
  const parts = (req.headers["x-forwarded-for"] || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (TRUST_PROXY_HOPS > 0 && parts.length) {
    const ip = parts[Math.max(0, parts.length - TRUST_PROXY_HOPS)];
    if (ip) return ip;
  }
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

// A hard ceiling on emails sent from the site per hour, whoever asks. Leads
// are still saved when the cap is hit; only the email is skipped.
const EMAIL_HOURLY_CAP = parseInt(process.env.EMAIL_HOURLY_CAP || "200", 10);
let emailWindowStart = Date.now();
let emailWindowCount = 0;
function emailCapOk() {
  const now = Date.now();
  if (now - emailWindowStart >= 60 * 60 * 1000) { emailWindowStart = now; emailWindowCount = 0; }
  if (emailWindowCount >= EMAIL_HOURLY_CAP) return false;
  emailWindowCount += 1;
  return true;
}

// Browsers send an Origin header on every cross-site POST. If there is one,
// it has to be this site, the request's own host (Railway previews) or a
// local preview. No Origin header (curl, server-to-server) is allowed
// through, since the rate limit and the send guard still apply.
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (origin === SITE_ORIGIN) return true;
  if (LOCAL_ORIGIN.test(origin)) return true;
  const host = req.headers.host || "";
  if (host && (origin === "https://" + host || origin === "http://" + host)) return true;
  return false;
}

function appendLocalLead(fileName, record) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const file = path.join(DATA_DIR, fileName);
    // Notion is the real record. Stop the local backup growing without limit.
    try { if (fs.statSync(file).size > 5 * 1024 * 1024) return; } catch (e) { /* new file */ }
    fs.appendFileSync(file, JSON.stringify(record) + "\n");
  } catch (err) {
    console.error("Local lead write failed:", err.message);
  }
}

// Notion rich_text properties have a length ceiling. Keep well under it.
function truncateRichText(text) {
  return text.length > 1900 ? text.slice(0, 1900) : text;
}

// ---------------------------------------------------------------------------
// Notion
// ---------------------------------------------------------------------------

async function notionRequest(url, method, payload) {
  const response = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion API ${response.status}: ${text}`);
  }
  return response.json();
}

async function createNotionPage(databaseId, properties) {
  return notionRequest("https://api.notion.com/v1/pages", "POST", { parent: { database_id: databaseId }, properties });
}

async function findNotionPageByEmail(databaseId, email) {
  const data = await notionRequest(`https://api.notion.com/v1/databases/${databaseId}/query`, "POST", {
    filter: { property: "Email", email: { equals: email } },
    page_size: 1,
  });
  return data.results[0] || null;
}

async function updateNotionPage(pageId, properties) {
  return notionRequest(`https://api.notion.com/v1/pages/${pageId}`, "PATCH", { properties });
}

// Creates a CRM contact if the email is new, or merges these updates onto
// their existing row if it isn't (checkboxes are OR'd, never un-ticked here).
async function upsertCrmContact(email, updates) {
  if (!NOTION_API_KEY || !NOTION_CRM_DB_ID) return;

  const existing = await findNotionPageByEmail(NOTION_CRM_DB_ID, email);

  if (existing) {
    const merged = { ...updates };
    for (const key of ["Quiz Completed", "Newsletter Subscribed", "Applied For Cohort"]) {
      if (key in merged) {
        const wasAlreadyTrue = existing.properties[key] && existing.properties[key].checkbox;
        merged[key] = { checkbox: wasAlreadyTrue || merged[key].checkbox };
      }
    }
    // Never overwrite a real name with a blank one from a later, name-less touchpoint.
    if (merged.Name && !merged.Name.title[0].text.content) delete merged.Name;
    await updateNotionPage(existing.id, merged);
  } else {
    await createNotionPage(NOTION_CRM_DB_ID, {
      "Name": { title: [{ text: { content: (updates.Name && updates.Name.title[0].text.content) || email } }] },
      "Email": { email },
      "Stage": { select: { name: "New" } },
      ...updates,
    });
  }
}

// ---------------------------------------------------------------------------
// Resend
// ---------------------------------------------------------------------------

async function resendSend(payload) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend API ${response.status}: ${text}`);
  }
  return true;
}

function welcomeEmailHtml(archetype) {
  return `<p>Hi,</p>` +
    `<p>You just found out you're <strong>${escapeHtml(archetype)}</strong>. Attached is your full guide: who you are, your specific pain points, and tips and tricks built just for your type.</p>` +
    `<p>Alana</p>`;
}

async function sendWelcomeEmail(email, archetype) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) return false;

  const pdfKey = ARCHETYPE_PDF_KEYS[archetype];
  if (!pdfKey) return false;
  if (!sendGuard.claim("welcome", email)) return false;
  if (!emailCapOk()) { console.warn("Hourly email cap reached, welcome email skipped"); return false; }

  const pdfPath = path.join(PDF_DIR, `${pdfKey}.pdf`);
  const pdfBuffer = await fs.promises.readFile(pdfPath);

  return resendSend({
    from: RESEND_FROM_EMAIL,
    to: email,
    subject: `You're ${archetype}: here's your full guide`,
    html: welcomeEmailHtml(archetype),
    attachments: [
      {
        filename: `${archetype.replace(/\s+/g, "-")}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Form handlers. Each one gets a body that readBody has already checked is a
// plain object, and treats every field as untrusted.
// ---------------------------------------------------------------------------

async function handleApply(req, res, body) {
  const name = (str(body.name) || str(body.firstName)).slice(0, 120);
  const email = str(body.email);
  const phone = str(body.phone).slice(0, 40);
  const categoryRaw = str(body.category);
  const category = KNOWN_APPLY_CATEGORIES.includes(categoryRaw) ? categoryRaw : "Not given";
  const stuck = truncateRichText(str(body.stuck));
  const whyNow = truncateRichText(str(body.whyNow));

  if (!name || !email || !stuck || !whyNow) {
    return sendJSON(res, 400, { ok: false, error: "Missing required fields" });
  }
  if (!isEmail(email)) {
    return sendJSON(res, 400, { ok: false, error: "Invalid email" });
  }

  appendLocalLead("applications.jsonl", {
    name, email, phone, category, stuck, whyNow, submittedAt: new Date().toISOString(),
  });

  // The Notion Applications DB has fixed properties, so the category and
  // phone (neither of which has its own column) are folded into the two
  // free-text fields that do exist.
  const stuckText = truncateRichText(`${category}: ${stuck}`);
  let whyNowText = whyNow;
  if (phone) whyNowText += `\n\nPhone: ${phone}`;
  whyNowText = truncateRichText(whyNowText);

  if (NOTION_API_KEY && NOTION_APPLICATIONS_DB_ID) {
    try {
      await createNotionPage(NOTION_APPLICATIONS_DB_ID, {
        "Name": { title: [{ text: { content: name } }] },
        "Email": { email },
        "What they keep putting off": { rich_text: [{ text: { content: stuckText } }] },
        "Why now": { rich_text: [{ text: { content: whyNowText } }] },
        "Stage": { select: { name: "New" } },
      });
    } catch (err) {
      console.error("Notion write failed (application):", err.message);
    }
  }

  try {
    await upsertCrmContact(email, {
      "Name": { title: [{ text: { content: name } }] },
      "Applied For Cohort": { checkbox: true },
      "Source": { select: { name: "Application" } },
    });
  } catch (err) {
    console.error("CRM upsert failed (application):", err.message);
  }

  sendJSON(res, 200, { ok: true });
}

async function handleFirstAction(req, res, body) {
  const email = str(body.email);
  const action = truncateRichText(str(body.action));
  const name = str(body.name).slice(0, 120);

  if (!email || !action) {
    return sendJSON(res, 400, { ok: false, error: "Missing required fields" });
  }
  if (!isEmail(email)) {
    return sendJSON(res, 400, { ok: false, error: "Invalid email" });
  }

  appendLocalLead("first-actions.jsonl", { email, action, name, submittedAt: new Date().toISOString() });

  if (NOTION_API_KEY && NOTION_APPLICATIONS_DB_ID) {
    try {
      // This form is public: anyone who finds welcome.html can post it, so it
      // must never mark someone as paid. Stage "Welcome page" just records
      // where the row came from. The trustworthy source for "Paid" is a
      // PayPal webhook (PAYMENT.CAPTURE.COMPLETED / BILLING.SUBSCRIPTION.
      // ACTIVATED) verified with PayPal's signature, or Alana checking PayPal
      // by hand. Notion adds the "Welcome page" option the first time it sees it.
      await createNotionPage(NOTION_APPLICATIONS_DB_ID, {
        "Name": { title: [{ text: { content: name || email } }] },
        "Email": { email },
        "What they keep putting off": { rich_text: [{ text: { content: action } }] },
        "Why now": { rich_text: [{ text: { content: "First action sent from the Cohort welcome page" } }] },
        "Stage": { select: { name: "Welcome page" } },
      });
    } catch (err) {
      console.error("Notion write failed (first action):", err.message);
    }
  }

  try {
    await upsertCrmContact(email, {
      "Name": { title: [{ text: { content: name || email } }] },
      "Source": { select: { name: "Cohort Welcome" } },
    });
  } catch (err) {
    console.error("CRM upsert failed (first action):", err.message);
  }

  sendJSON(res, 200, { ok: true });
}

async function handleNewsletter(req, res, body) {
  const email = str(body.email);
  const archetypeRaw = str(body.archetype);
  const archetype = KNOWN_ARCHETYPES.includes(archetypeRaw) ? archetypeRaw : "Not from quiz";
  const sourceRaw = str(body.source);
  const source = KNOWN_SOURCES.includes(sourceRaw) ? sourceRaw : "Home Quiz";

  if (!email) {
    return sendJSON(res, 400, { ok: false, error: "Missing email" });
  }
  if (!isEmail(email)) {
    return sendJSON(res, 400, { ok: false, error: "Invalid email" });
  }

  appendLocalLead("newsletter.jsonl", { email, archetype, source, signedUpAt: new Date().toISOString() });

  if (NOTION_API_KEY && NOTION_NEWSLETTER_DB_ID) {
    try {
      await createNotionPage(NOTION_NEWSLETTER_DB_ID, {
        "Email": { title: [{ text: { content: email } }] },
        "Quiz Archetype": { select: { name: archetype } },
        "Source": { select: { name: source } },
      });
    } catch (err) {
      console.error("Notion write failed (newsletter):", err.message);
    }
  }

  try {
    const crmUpdates = {
      "Newsletter Subscribed": { checkbox: true },
      "Source": { select: { name: source } },
    };
    if (archetype !== "Not from quiz") {
      crmUpdates["Quiz Completed"] = { checkbox: true };
      crmUpdates["Archetype"] = { select: { name: archetype } };
    }
    await upsertCrmContact(email, crmUpdates);
  } catch (err) {
    console.error("CRM upsert failed (newsletter):", err.message);
  }

  if (archetype !== "Not from quiz") {
    try {
      const sent = await sendWelcomeEmail(email, archetype);
      if (sent) {
        await upsertCrmContact(email, { "Welcome Email Sent": { checkbox: true } });
      }
    } catch (err) {
      console.error("Welcome email failed:", err.message);
    }
  }

  sendJSON(res, 200, { ok: true });
}


// ---------------------------------------------------------------------------
// The findable scorecard (/scorecard). Saves every finished scorecard,
// upserts the CRM contact, and emails the result by Resend.
// ---------------------------------------------------------------------------

// Highest first. The page uses the same cut-offs (75 and 40).
const SCORECARD_TIERS = [
  { min: 75, name: "Findable. Not yet paid." },
  { min: 40, name: "Two fixes from findable" },
  { min: 0, name: "Ready to be found" },
];
const LOWEST_TIER = SCORECARD_TIERS[SCORECARD_TIERS.length - 1].name;

// The three areas the scorecard measures. Any other key a browser sends is
// dropped.
const SCORECARD_CATEGORIES = ["Can they find you?", "Is there one thing to buy?", "Do you show up?"];

const CALL_URL = "https://calendly.com/alana-arthurs/findable-call?utm_source=scorecard-email&utm_medium=email&utm_campaign=findable-score";

function clampPercent(x) {
  const n = typeof x === "number" ? x : (typeof x === "string" ? parseInt(x, 10) : NaN);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// The tier always comes from the score, never from what the browser says.
function computeTier(score) {
  const s = clampPercent(score) || 0;
  return (SCORECARD_TIERS.find((t) => s >= t.min) || SCORECARD_TIERS[SCORECARD_TIERS.length - 1]).name;
}

function cleanCategories(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const name of SCORECARD_CATEGORIES) {
    if (Object.prototype.hasOwnProperty.call(raw, name)) {
      const pct = clampPercent(raw[name]);
      if (pct !== null) out[name] = pct;
    }
  }
  return out;
}

function cleanWins(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((w) => typeof w === "string").map((w) => w.trim().slice(0, 200)).filter(Boolean).slice(0, 3);
}

// Builds the scorecard email. Every value that came from the browser is
// escaped, and the categories are rebuilt from the three known names.
// opts.consent: did she tick the newsletter box. opts.hot: did she say she
// wants help soon.
function scorecardEmailHtml(firstName, score, tier, categories, wins, opts) {
  const o = opts || {};
  const name = escapeHtml(str(firstName) || "there");
  const pct = clampPercent(score) || 0;
  const tierName = SCORECARD_TIERS.some((t) => t.name === tier) ? tier : computeTier(pct);
  const cats = cleanCategories(categories);
  const bars = Object.keys(cats).map((k) =>
    `<li><strong>${escapeHtml(k)}</strong>: ${cats[k]}%</li>`).join("");
  const winList = cleanWins(wins).map((w) => `<li>${escapeHtml(w)}</li>`).join("");
  const callLink = `<a href="${escapeHtml(CALL_URL)}">calendly.com/alana-arthurs/findable-call</a>`;
  const cohortLine = NEXT_COHORT_LINE ? ` ${escapeHtml(NEXT_COHORT_LINE)}` : "";

  let next;
  if (tierName === LOWEST_TIER) {
    const intro = `Every other Sunday I send The Only Way Is Up: one true story about fear and what it costs, and one thing to do before Monday.`;
    if (o.consent) {
      next = `<p>${intro} You're on it now. Reply and tell me the one sentence you said out loud, if you like. I read every one.</p>`;
    } else {
      next = `<p>${intro} If you'd like it, reply to this email with "yes" and I'll add you. Reply and tell me the one sentence you said out loud, if you like. I read every one.</p>`;
    }
    if (o.hot) {
      next += `<p>You said you'd like a hand. There's a free 30-minute call for that. Pick any time that suits you: ${callLink}.${cohortLine}</p>`;
    }
  } else {
    next = `<p>The fastest way through this is a free 30-minute call where we look at your three areas together and pick the one fix. Book it here, pick any time that suits you: ${callLink}. That's also where we work out how I can help, if you want it: one to one, a day together, or The Circle at &pound;10 a month.</p>`;
  }
  return `<p>Hi ${name},</p>` +
    `<p>You scored <strong>${pct}%</strong>: <strong>${escapeHtml(tierName)}</strong>.</p>` +
    (bars ? `<ul>${bars}</ul>` : "") +
    (winList ? `<p>Your top 3 quick wins:</p><ol>${winList}</ol>` : "") +
    next +
    `<p>Alana x<br><em>Built everyone else's life. Not yet your own. Let's fix that.</em></p>`;
}

async function sendScorecardEmail(email, firstName, score, tier, categories, wins, opts) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) return false;
  if (!sendGuard.claim("scorecard", email)) return false;
  if (!emailCapOk()) { console.warn("Hourly email cap reached, scorecard email skipped"); return false; }
  return resendSend({
    from: RESEND_FROM_EMAIL,
    to: email,
    subject: `Your Visibility Score: ${score}%, ${tier}`,
    html: scorecardEmailHtml(firstName, score, tier, categories, wins, opts),
  });
}

function cleanShortMap(raw, maxKeys) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const key of Object.keys(raw).slice(0, maxKeys)) {
    const v = str(raw[key]);
    if (v) out[key.slice(0, 40)] = v.slice(0, 200);
  }
  return out;
}

async function handleScorecard(req, res, body) {
  const email = str(body.email);
  const firstName = str(body.firstName).slice(0, 80);
  const consent = body.marketingConsent === true;
  const score = clampPercent(body.scorePercent) || 0;
  const tier = computeTier(score);
  const categories = cleanCategories(body.categories);
  const wins = cleanWins(body.wins);
  const hot = body.hotLead === true;
  const insights = cleanShortMap(body.insights, 5);
  const utm = cleanShortMap(body.utm, 5);
  const source = "Findable Scorecard";

  if (!email || !isEmail(email)) {
    return sendJSON(res, 400, { ok: false, error: "Missing email" });
  }

  appendLocalLead("scorecard.jsonl", {
    email, firstName, consent, score, tier, categories, hot, insights,
    utm, completedAt: new Date().toISOString(),
  });

  if (consent && NOTION_API_KEY && NOTION_NEWSLETTER_DB_ID) {
    try {
      await createNotionPage(NOTION_NEWSLETTER_DB_ID, {
        "Email": { title: [{ text: { content: email } }] },
        "Quiz Archetype": { select: { name: "Not from quiz" } },
        "Source": { select: { name: source } },
      });
    } catch (err) {
      console.error("Notion write failed (scorecard):", err.message);
    }
  }

  const baseUpdates = {
    "Name": { title: [{ text: { content: firstName } }] },
    "Source": { select: { name: source } },
  };
  if (consent) baseUpdates["Newsletter Subscribed"] = { checkbox: true };
  try {
    // First try with the Lead magnet and Quiz tier fields; if they don't exist
    // in the CRM yet, Notion rejects the whole write, so fall back without them.
    await upsertCrmContact(email, {
      ...baseUpdates,
      "Lead magnet": { select: { name: "findable-score" } },
      "Quiz tier": { select: { name: tier } },
    });
  } catch (err) {
    try {
      await upsertCrmContact(email, baseUpdates);
    } catch (err2) {
      console.error("CRM upsert failed (scorecard):", err2.message);
    }
  }

  try {
    await sendScorecardEmail(email, firstName, score, tier, categories, wins, { consent, hot });
  } catch (err) {
    console.error("Scorecard email failed:", err.message);
  }

  sendJSON(res, 200, { ok: true });
}

const API_ROUTES = {
  "/api/apply": handleApply,
  "/api/newsletter": handleNewsletter,
  "/api/first-action": handleFirstAction,
  "/api/scorecard": handleScorecard,
};

// Every /api/* request runs these checks, in this order, before a handler
// sees it: method, route, origin, rate limit, content type and size, JSON
// shape, honeypot.
async function handleApi(req, res, urlPath) {
  if (req.method !== "POST") {
    return sendJSON(res, 405, { ok: false, error: "Method not allowed" }, { "Allow": "POST" });
  }
  const handler = API_ROUTES[urlPath];
  if (!handler) {
    return sendJSON(res, 404, { ok: false, error: "Not found" });
  }
  if (!originAllowed(req)) {
    req.resume();
    return sendJSON(res, 403, { ok: false, error: "Forbidden" });
  }
  const limit = apiLimiter.take(clientIp(req));
  if (!limit.ok) {
    req.resume();
    return sendJSON(res, 429, { ok: false, error: "Too many requests. Try again shortly." },
      { "Retry-After": String(limit.retryAfter) });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 400;
    const extra = status === 413 ? { "Connection": "close" } : undefined;
    return sendJSON(res, status, { ok: false, error: err instanceof HttpError ? err.message : "Invalid request body" }, extra);
  }

  // Honeypot: a hidden "website" field real people never see or fill. Bots
  // that fill every field get a normal-looking reply and nothing is saved.
  if (str(body.website)) {
    return sendJSON(res, 200, { ok: true });
  }

  return handler(req, res, body);
}

function sendServerError(res, err) {
  console.error("Request failed:", err && err.stack ? err.stack : err);
  if (res.headersSent) {
    res.destroy();
    return;
  }
  sendJSON(res, 500, { ok: false, error: "Something went wrong" });
}

function handleRequest(req, res) {
  try {
    // Encryption in transit. Railway terminates TLS at its edge and passes the
    // original scheme in X-Forwarded-Proto. Anything that arrived over plain
    // HTTP is sent to the HTTPS canonical site (the edge already does this
    // too; this is the belt to its braces). The target is always SITE_ORIGIN,
    // never the Host header, so a forged Host can't turn this into an open
    // redirect. Every HTTPS response carries HSTS. Local previews have no
    // X-Forwarded-Proto header, so neither branch fires there.
    const hostHeader = req.headers.host || "";
    const forwardedProto = (req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
    const isLocalHost = hostHeader.indexOf("localhost") === 0 || hostHeader.indexOf("127.0.0.1") === 0;
    if (forwardedProto === "http" && hostHeader && !isLocalHost) {
      res.writeHead(301, { Location: SITE_ORIGIN + req.url });
      res.end();
      return;
    }
    if (forwardedProto === "https") {
      res.setHeader("Strict-Transport-Security", STRICT_TRANSPORT_SECURITY);
    }

    // Security headers on every response, no matter how it's handled below.
    res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", CROSS_ORIGIN_OPENER_POLICY);
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");

    // Canonical host redirect. Only fires on an exact match against the bare
    // (non-www) host, so localhost and Railway's own *.up.railway.app host
    // are never touched.
    if (hostHeader === BARE_HOST) {
      res.writeHead(301, { Location: SITE_ORIGIN + req.url });
      res.end();
      return;
    }

    let urlPath;
    try {
      urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    } catch (err) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad request");
      return;
    }
    // A null byte in a path makes fs throw synchronously. Refuse it here.
    if (urlPath.indexOf("\0") !== -1) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad request");
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && urlPath === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : "ok");
      return;
    }

    if (urlPath.indexOf("/api/") === 0) {
      handleApi(req, res, urlPath).catch((err) => sendServerError(res, err));
      return;
    }

    serveStatic(req, res, urlPath).catch((err) => sendServerError(res, err));
  } catch (err) {
    sendServerError(res, err);
  }
}

// Last line of defence. Log and carry on rather than take the whole site
// down for one bad request. (Each request is already wrapped above; these
// catch anything that slips past.)
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason && reason.stack ? reason.stack : reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err && err.stack ? err.stack : err);
});

const server = http.createServer(handleRequest);
server.headersTimeout = 20000;
server.requestTimeout = 30000;

if (require.main === module) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Growing Women in Business site running on port ${PORT}`);
  });
} else {
  module.exports = {
    server,
    escapeHtml,
    scorecardEmailHtml,
    welcomeEmailHtml,
    computeTier,
    createRateLimiter,
    rateLimiter: apiLimiter,
    createSendGuard,
    sendGuard,
    originAllowed,
    str,
    SCORECARD_TIERS,
  };
}
