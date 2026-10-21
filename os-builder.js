// ---------------------------------------------------------------------------
// Build What's Yours (/build-whats-yours): invite-only sign-in and saving.
//
// How it works:
//   1. POST /api/os/start   {email, marketingConsent}  If the email is on the
//      Notion "Build What's Yours: Invite List" with Allowed ticked, a 6-digit
//      code is emailed by Resend. Anyone else gets reason "not-invited".
//   2. POST /api/os/verify  {email, code}  Right code: returns a signed session
//      token (30 days) and any answers saved to their account.
//   3. POST /api/os/content {token}  The questions. They live in
//      private/os-builder-content.js and are never in the public page.
//   4. POST /api/os/load | save | delete {token, ...}  Their answers, one JSON
//      file per person, named by a hash of the email.
//
// Access is re-checked against Notion (cached for a minute), so unticking
// Allowed locks someone out within about a minute.
//
// Invite links: /build-whats-yours?invite=<code> lets people add themselves.
// The code must match a row in the Notion "Build What's Yours: Invite Links"
// table with Active ticked. Someone new who signs in through a link is added
// to the Invite List (Allowed ticked, "How they got in" = Invite link). Anyone
// already on the Invite List with Allowed unticked stays out, link or not.
// Unticking Active switches a link off within about a minute.
//
// Answers are only kept on the server when there's somewhere permanent to
// keep them: a Railway volume (RAILWAY_VOLUME_MOUNT_PATH, set by Railway
// when a volume is attached) or OS_BUILDER_DIR. Without one, Railway wipes
// the disk on every deploy, so the server says accountSaving:false and the
// page keeps answers on the person's device instead.
//
// Settings (Railway Variables, all optional):
//   OS_BUILDER_ACCESS_DB_ID  the invite list database (defaults to the one below)
//   OS_BUILDER_MODE          "invite" (default) or "open" (anyone can sign in)
//   OS_BUILDER_SECRET        signs session tokens (defaults to a hash of the keys)
//   OS_BUILDER_DIR           where answers are saved (defaults to the volume)
//   OS_BUILDER_IMAGES_DB_ID  the image requests database (defaults to the one below)
//   OS_BUILDER_INVITES_DB_ID the invite links database (defaults to the one below)
// ---------------------------------------------------------------------------
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_ACCESS_DB_ID = "1b0f16c620f1412295d92fab84821687";
const DEFAULT_IMAGES_DB_ID = "860004a52d8648b1a2974b51314034c1";
const DEFAULT_INVITES_DB_ID = "1a4c83223d0047eba31bfbd747323369";
// Link codes are long and random (24 letters and numbers). Shorter codes in
// the table are ignored, so a weak one can never open the door.
const INVITE_PATTERN = /^[a-z0-9]{16,64}$/;
const IMAGE_SLOTS = ["Logo", "Photo of you", "Top of the page", "Work photo", "Other"];
const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_CACHE_MS = 60 * 1000;
const MAX_CODE_TRIES = 5;
const CODES_PER_HOUR = 5;
const MAX_VALUE_CHARS = 20000;
const MAX_OBJECT_CHARS = 4000;
const MAX_KEYS = 200;
const MAX_RECORD_BYTES = 2 * 1024 * 1024;
const KEY_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

function isPlainObject(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x) &&
    Object.getPrototypeOf(x) === Object.prototype;
}

function createOsBuilder(deps) {
  const env = deps.env || {};
  const now = deps.now || (() => Date.now());
  const { str, isEmail, sendJSON, notionRequest, resendSend, createNotionPage, upsertCrmContact, emailCapOk } = deps;

  const ACCESS_DB_ID = env.OS_BUILDER_ACCESS_DB_ID || DEFAULT_ACCESS_DB_ID;
  const IMAGE_DB_ID = env.OS_BUILDER_IMAGES_DB_ID || DEFAULT_IMAGES_DB_ID;
  const INVITES_DB_ID = env.OS_BUILDER_INVITES_DB_ID || DEFAULT_INVITES_DB_ID;
  const MODE = String(env.OS_BUILDER_MODE || "invite").toLowerCase() === "open" ? "open" : "invite";
  const onRailway = !!(env.RAILWAY_ENVIRONMENT || env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_PROJECT_ID);
  const permanentDir = env.OS_BUILDER_DIR ||
    (env.RAILWAY_VOLUME_MOUNT_PATH ? path.join(env.RAILWAY_VOLUME_MOUNT_PATH, "os-builder") : "");
  const STORE_DIR = permanentDir || path.join(deps.dataDir || "data", "os-builder");
  const accountSaving = !!permanentDir || !onRailway;
  const SECRET = env.OS_BUILDER_SECRET || crypto.createHash("sha256")
    .update("os-builder|" + (env.NOTION_API_KEY || "") + "|" + (env.RESEND_API_KEY || ""))
    .digest("hex");

  // ---- Access (the Notion invite list) ------------------------------------
  const accessCache = new Map();

  async function checkAccess(email) {
    const cached = accessCache.get(email);
    if (cached && now() - cached.at < ACCESS_CACHE_MS) return cached;

    let rows = [];
    if (env.NOTION_API_KEY) {
      const data = await notionRequest(`https://api.notion.com/v1/databases/${ACCESS_DB_ID}/query`, "POST", {
        // "contains" as well as "equals" so a row typed with capital letters
        // still matches; the exact check below drops any near misses.
        filter: { or: [
          { property: "Email", email: { equals: email } },
          { property: "Email", email: { contains: email } },
        ] },
        page_size: 10,
      });
      rows = ((data && data.results) || []).filter((r) => {
        const e = r.properties && r.properties.Email && r.properties.Email.email;
        return typeof e === "string" && e.trim().toLowerCase() === email;
      });
    } else if (MODE === "invite") {
      // No Notion key means no invite list to check, so nobody gets in.
      throw new Error("NOTION_API_KEY is not set, so the invite list can't be checked");
    }
    const allowedRow = rows.find((r) => r.properties && r.properties.Allowed && r.properties.Allowed.checkbox === true);
    const result = {
      allowed: MODE === "open" || !!allowedRow,
      listed: rows.length > 0,
      pageId: (allowedRow || rows[0] || {}).id || null,
      at: now(),
    };
    accessCache.set(email, result);
    return result;
  }

  // ---- Invite links (the Notion invite links table) ------------------------
  let linkCache = null;
  function plainText(prop) {
    const parts = (prop && (prop.rich_text || prop.title)) || [];
    return parts.map((p) => p.plain_text || (p.text && p.text.content) || "").join("");
  }
  async function activeLinks() {
    if (linkCache && now() - linkCache.at < ACCESS_CACHE_MS) return linkCache.links;
    if (!env.NOTION_API_KEY) return [];
    const data = await notionRequest(`https://api.notion.com/v1/databases/${INVITES_DB_ID}/query`, "POST", {
      filter: { property: "Active", checkbox: { equals: true } },
      page_size: 100,
    });
    const links = ((data && data.results) || [])
      .filter((r) => r.properties && r.properties.Active && r.properties.Active.checkbox === true)
      .map((r) => ({ name: plainText(r.properties.Name).trim() || "Invite link", code: plainText(r.properties.Code).trim().toLowerCase() }))
      .filter((l) => INVITE_PATTERN.test(l.code));
    linkCache = { at: now(), links };
    return links;
  }
  // The active link matching this code, or null. Compared in constant time.
  async function matchInvite(raw) {
    const code = str(raw).toLowerCase();
    if (!INVITE_PATTERN.test(code)) return null;
    const want = crypto.createHash("sha256").update(code).digest();
    let hit = null;
    for (const l of await activeLinks()) {
      if (crypto.timingSafeEqual(want, crypto.createHash("sha256").update(l.code).digest())) hit = l;
    }
    return hit;
  }
  // Puts someone who came in through a link on the Invite List.
  async function addFromInvite(email, link) {
    const page = await createNotionPage(ACCESS_DB_ID, {
      Name: { title: [{ text: { content: email } }] },
      Email: { email },
      Allowed: { checkbox: true },
      "How they got in": { select: { name: "Invite link" } },
      Notes: { rich_text: [{ text: { content: `Joined with the invite link "${link.name}" on ${new Date(now()).toISOString().slice(0, 10)}` } }] },
    });
    const result = { allowed: true, listed: true, pageId: (page && page.id) || null, at: now() };
    accessCache.set(email, result);
    return result;
  }

  // ---- Sign-in codes --------------------------------------------------------
  const codes = new Map();
  const codeSends = new Map();

  function hashCode(email, code) {
    return crypto.createHmac("sha256", SECRET).update(email + "|" + code).digest("hex");
  }
  function safeEqual(a, b) {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  }
  function recentSends(email) {
    const cutoff = now() - 60 * 60 * 1000;
    const list = (codeSends.get(email) || []).filter((t) => t > cutoff);
    codeSends.set(email, list);
    return list;
  }

  const pruneTimer = setInterval(() => {
    const t = now();
    for (const [k, v] of codes) if (v.expires < t) codes.delete(k);
    for (const [k] of codeSends) recentSends(k).length || codeSends.delete(k);
    for (const [k, v] of accessCache) if (t - v.at > ACCESS_CACHE_MS) accessCache.delete(k);
  }, 60 * 1000);
  if (pruneTimer.unref) pruneTimer.unref();

  function codeEmail(code) {
    return {
      subject: `Your sign-in code: ${code}`,
      text: `Hi,\n\nHere's your code to sign in to Build What's Yours:\n\n${code}\n\nIt works for 10 minutes. If you didn't ask for it, you can ignore this email.\n\nAlana\nGrowing Women in Business`,
      html: `<div style="font-family:Arial,sans-serif;color:#0A1F3D;font-size:16px;line-height:1.6">` +
        `<p>Hi,</p><p>Here's your code to sign in to <strong>Build What's Yours</strong>:</p>` +
        `<p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#B03A4E;margin:18px 0">${code}</p>` +
        `<p>It works for 10 minutes. If you didn't ask for it, you can ignore this email.</p>` +
        `<p>Alana<br>Growing Women in Business</p></div>`,
    };
  }

  // ---- Session tokens -------------------------------------------------------
  function sign(data) {
    return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  }
  function makeToken(email) {
    const body = Buffer.from(JSON.stringify({ e: email, x: now() + SESSION_TTL_MS })).toString("base64url");
    return body + "." + sign(body);
  }
  function readToken(token) {
    if (typeof token !== "string" || token.length > 1000) return null;
    const parts = token.split(".");
    if (parts.length !== 2 || !safeEqual(parts[1], sign(parts[0]))) return null;
    let payload;
    try { payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); } catch (e) { return null; }
    if (!isPlainObject(payload) || typeof payload.e !== "string" || typeof payload.x !== "number") return null;
    if (payload.x < now()) return null;
    return payload.e;
  }

  // ---- Answers on disk ------------------------------------------------------
  function fileFor(email) {
    return path.join(STORE_DIR, crypto.createHash("sha256").update(email).digest("hex") + ".json");
  }
  function readRecord(email) {
    try {
      const rec = JSON.parse(fs.readFileSync(fileFor(email), "utf8"));
      if (isPlainObject(rec) && isPlainObject(rec.answers)) return rec;
    } catch (e) { /* none yet */ }
    return { answers: {}, updatedAt: null };
  }
  function writeRecord(email, rec) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    const file = fileFor(email);
    const tmp = file + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(rec));
    fs.renameSync(tmp, file);
  }
  function cleanValue(v) {
    if (v === null) return { ok: true, value: null };
    if (typeof v === "string") return v.length <= MAX_VALUE_CHARS ? { ok: true, value: v } : { ok: false };
    if (isPlainObject(v) && JSON.stringify(v).length <= MAX_OBJECT_CHARS) return { ok: true, value: v };
    return { ok: false };
  }

  // ---- Content (the questions) ---------------------------------------------
  let contentCache = null;
  function loadContent() {
    if (!contentCache) contentCache = require(deps.contentFile);
    return contentCache;
  }

  // ---- Shared checks --------------------------------------------------------
  function normEmail(x) { return str(x).toLowerCase(); }

  // Returns the signed-in, still-invited email, or sends the error and returns null.
  async function requireSession(res, body) {
    const email = readToken(body.token);
    if (!email) { sendJSON(res, 401, { ok: false, reason: "signed-out", error: "Please sign in again." }); return null; }
    let access;
    try { access = await checkAccess(email); } catch (err) {
      console.error("OS builder access check failed:", err.message);
      sendJSON(res, 503, { ok: false, error: "We can't check your access right now. Try again in a few minutes." });
      return null;
    }
    if (!access.allowed) { sendJSON(res, 403, { ok: false, reason: "not-invited", error: "Your access has ended." }); return null; }
    return email;
  }

  // ---- Handlers -------------------------------------------------------------
  async function handleStart(req, res, body) {
    const email = normEmail(body.email);
    if (!email || !isEmail(email)) return sendJSON(res, 400, { ok: false, error: "Please check your email address." });
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
      return sendJSON(res, 503, { ok: false, error: "Sign-in isn't switched on yet. Please try again later." });
    }

    let access;
    try { access = await checkAccess(email); } catch (err) {
      console.error("OS builder access check failed:", err.message);
      return sendJSON(res, 503, { ok: false, error: "We can't check your invite right now. Try again in a few minutes." });
    }
    let link = null;
    if (!access.allowed) {
      // A link only lets in people who aren't on the list yet: anyone Alana
      // has unticked stays out.
      if (!body.invite || access.listed) return sendJSON(res, 403, { ok: false, reason: "not-invited" });
      try { link = await matchInvite(body.invite); } catch (err) {
        console.error("OS builder invite link check failed:", err.message);
        return sendJSON(res, 503, { ok: false, error: "We can't check your invite right now. Try again in a few minutes." });
      }
      if (!link) return sendJSON(res, 403, { ok: false, reason: "invite-ended" });
    }

    const sends = recentSends(email);
    if (sends.length >= CODES_PER_HOUR) {
      return sendJSON(res, 429, { ok: false, error: "You've asked for a few codes already. Check your inbox and spam folder, or try again in an hour." });
    }
    if (!emailCapOk()) {
      return sendJSON(res, 503, { ok: false, error: "Lots of people are signing in right now. Try again in a little while." });
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    codes.set(email, { hash: hashCode(email, code), expires: now() + CODE_TTL_MS, tries: 0, consent: body.marketingConsent === true, invite: link ? str(body.invite).toLowerCase() : null });
    sends.push(now());

    const msg = codeEmail(code);
    try {
      await resendSend({ from: env.RESEND_FROM_EMAIL, to: email, subject: msg.subject, html: msg.html, text: msg.text });
    } catch (err) {
      console.error("OS builder code email failed:", err.message);
      codes.delete(email);
      return sendJSON(res, 502, { ok: false, error: "We couldn't send the email. Please try again in a minute." });
    }
    sendJSON(res, 200, { ok: true });
  }

  async function handleVerify(req, res, body) {
    const email = normEmail(body.email);
    const code = str(body.code).replace(/\D/g, "");
    const entry = codes.get(email);
    if (!entry || entry.expires < now()) {
      codes.delete(email);
      return sendJSON(res, 400, { ok: false, reason: "expired", error: "That code has run out. Ask for a new one." });
    }
    entry.tries += 1;
    if (entry.tries > MAX_CODE_TRIES) {
      codes.delete(email);
      return sendJSON(res, 400, { ok: false, reason: "expired", error: "Too many tries. Ask for a new code." });
    }
    if (code.length !== 6 || !safeEqual(hashCode(email, code), entry.hash)) {
      return sendJSON(res, 400, { ok: false, error: "That code doesn't match. Check the latest email and try again." });
    }
    codes.delete(email);

    let access;
    try { access = await checkAccess(email); } catch (err) {
      console.error("OS builder access check failed:", err.message);
      return sendJSON(res, 503, { ok: false, error: "We can't check your invite right now. Try again in a few minutes." });
    }
    if (!access.allowed) {
      if (!entry.invite || access.listed) return sendJSON(res, 403, { ok: false, reason: "not-invited" });
      try {
        // Checked again, in case the link was switched off in the last ten minutes.
        const link = await matchInvite(entry.invite);
        if (!link) return sendJSON(res, 403, { ok: false, reason: "invite-ended" });
        access = await addFromInvite(email, link);
      } catch (err) {
        console.error("OS builder invite sign-up failed:", err.message);
        return sendJSON(res, 503, { ok: false, error: "We couldn't finish signing you up just now. Ask for a new code in a few minutes." });
      }
    }

    const rec = accountSaving ? readRecord(email) : { answers: {}, updatedAt: null };
    sendJSON(res, 200, { ok: true, token: makeToken(email), email, answers: rec.answers, updatedAt: rec.updatedAt, accountSaving });

    // Bookkeeping after the reply, so a slow Notion never holds up sign-in.
    recordSignIn(email, access.pageId, entry.consent).catch((err) => console.error("OS builder sign-in record failed:", err.message));
  }

  async function recordSignIn(email, pageId, consent) {
    if (!env.NOTION_API_KEY) return;
    const props = { "Last sign-in": { date: { start: new Date(now()).toISOString() } } };
    if (consent) props.Newsletter = { checkbox: true };
    if (pageId) {
      await notionRequest(`https://api.notion.com/v1/pages/${pageId}`, "PATCH", { properties: props });
    } else if (MODE === "open") {
      await createNotionPage(ACCESS_DB_ID, {
        Name: { title: [{ text: { content: email } }] },
        Email: { email },
        Allowed: { checkbox: true },
        ...props,
      });
    }
    if (consent) {
      if (deps.newsletterDbId) {
        await createNotionPage(deps.newsletterDbId, {
          "Email": { title: [{ text: { content: email } }] },
          "Quiz Archetype": { select: { name: "Not from quiz" } },
          "Source": { select: { name: "OS Builder" } },
        });
      }
      await upsertCrmContact(email, {
        "Newsletter Subscribed": { checkbox: true },
        "Source": { select: { name: "OS Builder" } },
      });
    }
  }

  async function handleContent(req, res, body) {
    const email = await requireSession(res, body);
    if (!email) return;
    sendJSON(res, 200, { ok: true, modules: loadContent() });
  }

  async function handleLoad(req, res, body) {
    const email = await requireSession(res, body);
    if (!email) return;
    const rec = accountSaving ? readRecord(email) : { answers: {}, updatedAt: null };
    sendJSON(res, 200, { ok: true, email, answers: rec.answers, updatedAt: rec.updatedAt, accountSaving });
  }

  async function handleSave(req, res, body) {
    const email = await requireSession(res, body);
    if (!email) return;
    if (!accountSaving) return sendJSON(res, 200, { ok: true, accountSaving: false });
    if (!isPlainObject(body.changes)) return sendJSON(res, 400, { ok: false, error: "Nothing to save." });

    const rec = readRecord(email);
    for (const [key, raw] of Object.entries(body.changes)) {
      if (!KEY_PATTERN.test(key)) continue;
      const v = cleanValue(raw);
      if (!v.ok) return sendJSON(res, 413, { ok: false, error: "One answer is too long to save. Try splitting it up." });
      if (v.value === null) delete rec.answers[key];
      else rec.answers[key] = v.value;
    }
    if (Object.keys(rec.answers).length > MAX_KEYS) return sendJSON(res, 413, { ok: false, error: "Too many answers to save." });
    rec.updatedAt = new Date(now()).toISOString();
    const out = JSON.stringify(rec);
    if (Buffer.byteLength(out) > MAX_RECORD_BYTES) return sendJSON(res, 413, { ok: false, error: "Your workbook is too big to save." });
    try { writeRecord(email, rec); } catch (err) {
      console.error("OS builder save failed:", err.message);
      return sendJSON(res, 500, { ok: false, error: "We couldn't save just now. Your answers are still on this device." });
    }
    sendJSON(res, 200, { ok: true, updatedAt: rec.updatedAt, accountSaving: true });
  }

  // A member asks Alana for a picture for their website. Lands in the Notion
  // "Build What's Yours: Image Requests" table. Twelve a day per person.
  const imageSends = new Map();
  async function handleImageRequest(req, res, body) {
    const email = await requireSession(res, body);
    if (!email) return;
    const slot = IMAGE_SLOTS.includes(str(body.slot)) ? str(body.slot) : "Other";
    const description = str(body.description).slice(0, 1500);
    if (description.length < 5) return sendJSON(res, 400, { ok: false, error: "Tell us a little about the picture you'd like first." });
    if (!env.NOTION_API_KEY) return sendJSON(res, 503, { ok: false, error: "Image requests aren't switched on yet. Please try again later." });

    const cutoff = now() - 24 * 60 * 60 * 1000;
    const recent = (imageSends.get(email) || []).filter((t) => t > cutoff);
    if (recent.length >= 12) return sendJSON(res, 429, { ok: false, error: "That's a lot of requests for one day. Try again tomorrow." });

    const text = (s) => [{ text: { content: s.slice(0, 1900) } }];
    try {
      await createNotionPage(IMAGE_DB_ID, {
        "Request": { title: [{ text: { content: `${slot}: ${description.slice(0, 60)}` } }] },
        "Email": { email },
        "Image for": { select: { name: slot } },
        "What they want": { rich_text: text(description) },
        "Business": { rich_text: text(str(body.business).slice(0, 200)) },
        "Brand colours": { rich_text: text(str(body.colours).slice(0, 100)) },
        "Status": { select: { name: "New" } },
        "Requested": { date: { start: new Date(now()).toISOString() } },
      });
    } catch (err) {
      console.error("OS builder image request failed:", err.message);
      return sendJSON(res, 502, { ok: false, error: "We couldn't send your request just now. Please try again in a minute." });
    }
    recent.push(now());
    imageSends.set(email, recent);
    sendJSON(res, 200, { ok: true });
  }

  async function handleDelete(req, res, body) {
    const email = readToken(body.token);
    if (!email) return sendJSON(res, 401, { ok: false, reason: "signed-out", error: "Please sign in again." });
    try { fs.unlinkSync(fileFor(email)); } catch (e) { /* nothing saved */ }
    sendJSON(res, 200, { ok: true });
  }

  return {
    routes: {
      "/api/os/start": handleStart,
      "/api/os/verify": handleVerify,
      "/api/os/content": handleContent,
      "/api/os/load": handleLoad,
      "/api/os/save": handleSave,
      "/api/os/delete": handleDelete,
      "/api/os/image-request": handleImageRequest,
    },
    // For tests.
    _internals: { makeToken, readToken, codes, accessCache, fileFor, MODE, accountSaving, STORE_DIR },
  };
}

module.exports = { createOsBuilder, DEFAULT_ACCESS_DB_ID, DEFAULT_INVITES_DB_ID };
