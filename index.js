const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");

const NOTION_API_KEY = process.env.NOTION_API_KEY || "";
const NOTION_APPLICATIONS_DB_ID = process.env.NOTION_APPLICATIONS_DB_ID || "";
const NOTION_NEWSLETTER_DB_ID = process.env.NOTION_NEWSLETTER_DB_ID || "";
const NOTION_VERSION = "2022-06-28";

const KNOWN_ARCHETYPES = [
  "The Wildflower", "The Ember", "The Pearl", "Mademoiselle", "The Late Bloomer",
  "The Firestarter", "The Sage", "The Live Wire", "The Anchor",
];

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

  if (!email) {
    return sendJSON(res, 400, { ok: false, error: "Missing email" });
  }

  appendLocalLead("newsletter.jsonl", { email, archetype, signedUpAt: new Date().toISOString() });

  if (NOTION_API_KEY && NOTION_NEWSLETTER_DB_ID) {
    try {
      await createNotionPage(NOTION_NEWSLETTER_DB_ID, {
        "Email": { title: [{ text: { content: email } }] },
        "Quiz Archetype": { select: { name: archetype } },
      });
    } catch (err) {
      console.error("Notion write failed (newsletter):", err.message);
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
