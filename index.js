const http = require("http");
const fs = require("fs");
const path = require("path");

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

const KNOWN_SOURCES = ["Home Quiz", "Circle Welcome", "Cohort Welcome"];

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
};

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
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
      subject: `You're ${archetype} — here's your full guide`,
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

  const name = (body.name || "").trim();
  const email = (body.email || "").trim();
  const stuck = (body.stuck || "").trim();
  const whyNow = (body.whyNow || "").trim();

  if (!name || !email || !stuck || !whyNow) {
    return sendJSON(res, 400, { ok: false, error: "Missing required fields" });
  }

  appendLocalLead("applications.jsonl", { name, email, stuck, whyNow, submittedAt: new Date().toISOString() });

  if (NOTION_API_KEY && NOTION_APPLICATIONS_DB_ID) {
    try {
      await createNotionPage(NOTION_APPLICATIONS_DB_ID, {
        "Name": { title: [{ text: { content: name } }] },
        "Email": { email },
        "What they keep putting off": { rich_text: [{ text: { content: stuck } }] },
        "Why now": { rich_text: [{ text: { content: whyNow } }] },
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
  const urlPath = decodeURIComponent(req.url.split("?")[0]);

  if (req.method === "POST" && urlPath === "/api/apply") {
    return handleApply(req, res);
  }
  if (req.method === "POST" && urlPath === "/api/newsletter") {
    return handleNewsletter(req, res);
  }

  let filePath = path.join(PUBLIC_DIR, urlPath === "/" ? "index.html" : urlPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    serveFile(res, filePath);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Growing Women in Business site running on port ${PORT}`);
});
