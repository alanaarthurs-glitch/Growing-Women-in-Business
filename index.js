const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");

const NOTION_API_KEY = process.env.NOTION_API_KEY || "";
const NOTION_APPLICATIONS_DB_ID = process.env.NOTION_APPLICATIONS_DB_ID || "";
const NOTION_NEWSLETTER_DB_ID = process.env.NOTION_NEWSLETTER_DB_ID || "";
const NOTION_CRM_DB_ID = process.env.NOTION_CRM_DB_ID || "";
const NOTION_VERSION = "2022-06-28";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const PDF_DIR = path.join(__dirname, "assets", "pdfs");

// The canonical site origin, always the www host. Used both to build the
// redirect target and, with the protocol and "www." stripped, to recognise
// the bare (non-www) host that should be redirected. Never matches a
// localhost or Railway-internal hostname, so previews and health checks
// are left alone.
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://www.growingwomeninbusiness.com";
function deriveBareHost(origin) {
  const withoutProtocol = origin.replace(/^https?:\/\//i, "");
  const hostOnly = withoutProtocol.split("/")[0];
  return hostOnly.replace(/^www\./i, "");
}
const BARE_HOST = deriveBareHost(SITE_ORIGIN);

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
  "Push Waitlist", "Newsletter Panel",
];

const KNOWN_APPLY_CATEGORIES = ["Pricing", "Visibility", "The Avoided Conversation"];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
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
const GZIPPABLE_TYPES = ["application/javascript", "application/json", "image/svg+xml"];

function isGzippable(contentType) {
  const bareType = contentType.split(";")[0].trim();
  if (bareType.indexOf("text/") === 0) return true;
  return GZIPPABLE_TYPES.indexOf(bareType) !== -1;
}

// Gzips the body when the client accepts it, the content type is worth
// compressing and the body clears the 1KB floor. Mutates `headers` to add
// Content-Encoding and Vary when it does. Returns the body to send.
function maybeGzip(req, headers, contentType, data) {
  const acceptEncoding = req.headers["accept-encoding"] || "";
  if (acceptEncoding.indexOf("gzip") === -1) return data;
  if (!isGzippable(contentType)) return data;
  if (data.length <= 1024) return data;

  headers["Content-Encoding"] = "gzip";
  headers["Vary"] = "Accept-Encoding";
  return zlib.gzipSync(data);
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

// Reads and sends a file. If it's missing and this isn't already the 404
// page, falls back to serving public/404.html with a 404 status. If that
// itself is missing, falls back to plain text so a request never hangs.
function serveFile(req, res, filePath, statusCode) {
  statusCode = statusCode || 200;
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (statusCode === 404) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      serveFile(req, res, path.join(PUBLIC_DIR, "404.html"), 404);
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const headers = { "Content-Type": contentType };

    const cacheControl = getCacheControl(filePath, ext);
    if (cacheControl) headers["Cache-Control"] = cacheControl;

    const body = maybeGzip(req, headers, contentType, data);
    res.writeHead(statusCode, headers);
    res.end(body);
  });
}

// Resolves a request path against public/: exact files and directories
// (served as index.html) first, then, for an extension-less path, a clean
// URL match against "<path>.html". Anything left over is a 404.
function serveStatic(req, res, urlPath) {
  let filePath = path.join(PUBLIC_DIR, urlPath === "/" ? "index.html" : urlPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      serveFile(req, res, path.join(filePath, "index.html"));
      return;
    }
    if (!err && stats.isFile()) {
      serveFile(req, res, filePath);
      return;
    }

    if (path.extname(filePath) === "") {
      const htmlPath = filePath + ".html";
      if (htmlPath.startsWith(PUBLIC_DIR)) {
        fs.stat(htmlPath, (err2, stats2) => {
          if (!err2 && stats2.isFile()) {
            serveFile(req, res, htmlPath);
            return;
          }
          serveFile(req, res, path.join(PUBLIC_DIR, "404.html"), 404);
        });
        return;
      }
    }

    serveFile(req, res, path.join(PUBLIC_DIR, "404.html"), 404);
  });
}

function sendJSON(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = "";
    req.on("data", (chunk) => {
      chunks += chunk;
      if (chunks.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(chunks ? JSON.parse(chunks) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function appendLocalLead(fileName, record) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(path.join(DATA_DIR, fileName), JSON.stringify(record) + "\n");
}

// Notion rich_text properties have a length ceiling. Keep well under it.
function truncateRichText(text) {
  return text.length > 1900 ? text.slice(0, 1900) : text;
}

async function createNotionPage(databaseId, properties) {
  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion API ${response.status}: ${text}`);
  }
  return response.json();
}

async function findNotionPageByEmail(databaseId, email) {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: { property: "Email", email: { equals: email } },
      page_size: 1,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion API ${response.status}: ${text}`);
  }
  const data = await response.json();
  return data.results[0] || null;
}

async function updateNotionPage(pageId, properties) {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion API ${response.status}: ${text}`);
  }
  return response.json();
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

async function sendWelcomeEmail(email, archetype) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) return false;

  const pdfKey = ARCHETYPE_PDF_KEYS[archetype];
  if (!pdfKey) return false;

  const pdfPath = path.join(PDF_DIR, `${pdfKey}.pdf`);
  const pdfBuffer = await fs.promises.readFile(pdfPath);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: email,
      subject: `You're ${archetype}: here's your full guide`,
      html:
        `<p>Hi,</p>` +
        `<p>You just found out you're <strong>${archetype}</strong>. Attached is your full guide: who you are, your specific pain points, and tips and tricks built just for your type.</p>` +
        `<p>Alana</p>`,
      attachments: [
        {
          filename: `${archetype.replace(/\s+/g, "-")}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend API ${response.status}: ${text}`);
  }
  return true;
}

async function handleApply(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return sendJSON(res, 400, { ok: false, error: "Invalid request body" });
  }

  const name = (body.name || body.firstName || "").trim();
  const email = (body.email || "").trim();
  const phone = (body.phone || "").trim();
  const categoryRaw = (body.category || "").trim();
  const category = KNOWN_APPLY_CATEGORIES.includes(categoryRaw) ? categoryRaw : "Not given";
  const stuck = (body.stuck || "").trim();
  const whyNow = (body.whyNow || "").trim();

  if (!name || !email || !stuck || !whyNow) {
    return sendJSON(res, 400, { ok: false, error: "Missing required fields" });
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

async function handleFirstAction(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return sendJSON(res, 400, { ok: false, error: "Invalid request body" });
  }

  const email = (body.email || "").trim();
  const action = (body.action || "").trim();
  const name = (body.name || "").trim();

  if (!email || !action) {
    return sendJSON(res, 400, { ok: false, error: "Missing required fields" });
  }

  appendLocalLead("first-actions.jsonl", { email, action, name, submittedAt: new Date().toISOString() });

  if (NOTION_API_KEY && NOTION_APPLICATIONS_DB_ID) {
    try {
      await createNotionPage(NOTION_APPLICATIONS_DB_ID, {
        "Name": { title: [{ text: { content: name || email } }] },
        "Email": { email },
        "What they keep putting off": { rich_text: [{ text: { content: truncateRichText(action) } }] },
        "Why now": { rich_text: [{ text: { content: "First action sent from the Cohort welcome page" } }] },
        "Stage": { select: { name: "Paid" } },
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

async function handleNewsletter(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return sendJSON(res, 400, { ok: false, error: "Invalid request body" });
  }

  const email = (body.email || "").trim();
  const archetypeRaw = (body.archetype || "").trim();
  const archetype = KNOWN_ARCHETYPES.includes(archetypeRaw) ? archetypeRaw : "Not from quiz";
  const sourceRaw = (body.source || "").trim();
  const source = KNOWN_SOURCES.includes(sourceRaw) ? sourceRaw : "Home Quiz";

  if (!email) {
    return sendJSON(res, 400, { ok: false, error: "Missing email" });
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

const server = http.createServer((req, res) => {
  // Security headers on every response, no matter how it's handled below.
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Canonical host redirect. Only fires on an exact match against the bare
  // (non-www) host, so localhost and Railway's own *.up.railway.app host
  // are never touched.
  const hostHeader = req.headers.host || "";
  if (hostHeader === BARE_HOST) {
    res.writeHead(301, { Location: SITE_ORIGIN + req.url });
    res.end();
    return;
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split("?")[0]);
  } catch (err) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  if (req.method === "GET" && urlPath === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  if (urlPath.indexOf("/api/") === 0) {
    if (req.method !== "POST") {
      sendJSON(res, 405, { ok: false, error: "Method not allowed" });
      return;
    }
    if (urlPath === "/api/apply") {
      handleApply(req, res);
      return;
    }
    if (urlPath === "/api/newsletter") {
      handleNewsletter(req, res);
      return;
    }
    if (urlPath === "/api/first-action") {
      handleFirstAction(req, res);
      return;
    }
    sendJSON(res, 404, { ok: false, error: "Not found" });
    return;
  }

  serveStatic(req, res, urlPath);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Growing Women in Business site running on port ${PORT}`);
});
