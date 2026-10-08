// Run with: npm test   (node --test tests/)
// Starts the real server from index.js on a random port. No Notion or
// Resend keys are set, so nothing leaves the machine. Leads are written to
// a temporary folder, not to data/.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), "gwib-test-"));
process.env.DATA_DIR = tmpData;
for (const k of ["NOTION_API_KEY", "RESEND_API_KEY", "RESEND_FROM_EMAIL"]) delete process.env[k];

const app = require("../index.js");
let port;

before(async () => {
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  port = app.server.address().port;
});

after(async () => {
  await new Promise((resolve) => app.server.close(resolve));
  fs.rmSync(tmpData, { recursive: true, force: true });
});

// Raw request so paths like /../package.json and /%00 are sent as written.
function request(method, rawPath, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: rawPath, headers, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

let ipCounter = 0;
function freshIp() { ipCounter += 1; return `203.0.113.${ipCounter}`; }

function postJson(rawPath, bodyText, extraHeaders = {}) {
  return request("POST", rawPath, {
    headers: { "Content-Type": "application/json", "X-Forwarded-For": freshIp(), ...extraHeaders },
    body: bodyText,
  });
}

const validScorecard = {
  email: "test@example.com",
  firstName: "Jo",
  marketingConsent: false,
  scorePercent: 52,
  tier: "Two fixes from findable",
  categories: { "Can they find you?": 40, "Is there one thing to buy?": 60, "Do you show up?": 55 },
  wins: ["One", "Two", "Three"],
  hotLead: false,
};

test("GET / is 200 with CSP and COOP headers", async () => {
  const r = await request("GET", "/");
  assert.strictEqual(r.status, 200);
  assert.ok(r.headers["content-security-policy"], "has CSP");
  assert.ok(r.headers["cross-origin-opener-policy"], "has COOP");
  assert.match(r.body, /<html/i);
});

test("GET /%00 is 400 and the server keeps answering", async () => {
  const r = await request("GET", "/%00");
  assert.strictEqual(r.status, 400);
  const h = await request("GET", "/healthz");
  assert.strictEqual(h.status, 200);
  assert.strictEqual(h.body, "ok");
});

test("path traversal is refused", async () => {
  const r = await request("GET", "/../package.json");
  assert.strictEqual(r.status, 403);
});

test("PUT on a static file is 405", async () => {
  const r = await request("PUT", "/index.html", { body: "x" });
  assert.strictEqual(r.status, 405);
});

test("HEAD on a static file sends headers only", async () => {
  const r = await request("HEAD", "/index.html");
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body, "");
  assert.ok(r.headers.etag);
});

test("scorecard body null is 400, not a crash", async () => {
  const r = await postJson("/api/scorecard", "null");
  assert.strictEqual(r.status, 400);
  const h = await request("GET", "/healthz");
  assert.strictEqual(h.status, 200);
});

test("scorecard with a non-string email is 400", async () => {
  for (const bad of ['{"email":123}', '{"email":["a"]}', '{"firstName":5}', "[]", "\"x\""]) {
    const r = await postJson("/api/scorecard", bad);
    assert.strictEqual(r.status, 400, bad);
  }
  for (const route of ["/api/newsletter", "/api/apply", "/api/first-action"]) {
    const r = await postJson(route, '{"email":123,"name":5,"action":[1]}');
    assert.strictEqual(r.status, 400, route);
  }
  const h = await request("GET", "/healthz");
  assert.strictEqual(h.status, 200);
});

test("text/plain body is 415", async () => {
  const r = await request("POST", "/api/scorecard", {
    headers: { "Content-Type": "text/plain", "X-Forwarded-For": freshIp() },
    body: JSON.stringify(validScorecard),
  });
  assert.strictEqual(r.status, 415);
});

test("body over 32 KB is 413", async () => {
  const r = await postJson("/api/newsletter", JSON.stringify({ email: "a@example.com", pad: "x".repeat(40 * 1024) }));
  assert.strictEqual(r.status, 413);
});

test("cross-site Origin is 403, own origin is allowed", async () => {
  const bad = await postJson("/api/scorecard", JSON.stringify(validScorecard), { Origin: "https://evil.example" });
  assert.strictEqual(bad.status, 403);
  const good = await postJson("/api/scorecard", JSON.stringify(validScorecard), { Origin: "https://www.growingwomeninbusiness.com" });
  assert.strictEqual(good.status, 200);
  const local = await postJson("/api/scorecard", JSON.stringify(validScorecard), { Origin: `http://localhost:${port}` });
  assert.strictEqual(local.status, 200);
});

test("honeypot filled: 200 but nothing saved", async () => {
  const r = await postJson("/api/newsletter", JSON.stringify({ email: "bot@example.com", website: "http://spam.example" }));
  assert.strictEqual(r.status, 200);
  const file = path.join(tmpData, "newsletter.jsonl");
  const saved = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  assert.ok(!saved.includes("bot@example.com"));
});

test("rate limit: 20 posts are fine, the 21st from the same IP is 429", async () => {
  const ip = "198.51.100.77";
  const statuses = [];
  for (let i = 0; i < 21; i++) {
    const r = await request("POST", "/api/scorecard", {
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify(validScorecard),
    });
    statuses.push(r.status);
    if (i === 20) assert.ok(Number(r.headers["retry-after"]) > 0, "Retry-After set");
  }
  assert.deepStrictEqual(statuses.slice(0, 20), new Array(20).fill(200));
  assert.strictEqual(statuses[20], 429);
});

test("stored scorecard is cleaned: tier from score, unknown categories dropped", async () => {
  await postJson("/api/scorecard", JSON.stringify({
    ...validScorecard, email: "clean@example.com", scorePercent: 90, tier: "<b>made up</b>",
    categories: { "<script>x</script>": 100, "Do you show up?": 400 },
  }));
  const lines = fs.readFileSync(path.join(tmpData, "scorecard.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const rec = lines.find((l) => l.email === "clean@example.com");
  assert.strictEqual(rec.tier, "Findable. Not yet paid.");
  assert.deepStrictEqual(rec.categories, { "Do you show up?": 100 });
});

test("escapeHtml escapes < > & \" '", () => {
  assert.strictEqual(app.escapeHtml(`<a href="x">Tom & 'Jo'</a>`),
    "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jo&#39;&lt;/a&gt;");
});

test("scorecardEmailHtml escapes the name, categories and wins", () => {
  const html = app.scorecardEmailHtml("<img src=x onerror=alert(1)>", 42, "Two fixes from findable",
    { "Can they find you?": 40, "<script>alert(1)</script>": "<b>99</b>" },
    ["<a href=\"https://evil.example\">Claim</a>"], { consent: false });
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("evil.example\">"));
  assert.ok(!/1 October/.test(html));
});

test("scorecard email only says 'you're on it' with consent", () => {
  const withConsent = app.scorecardEmailHtml("Jo", 10, "Ready to be found", {}, [], { consent: true });
  const without = app.scorecardEmailHtml("Jo", 10, "Ready to be found", {}, [], { consent: false });
  assert.ok(withConsent.includes("You're on it now"));
  assert.ok(!without.includes("You're on it now"));
  assert.ok(without.includes("reply to this email"));
});

test("computeTier uses the score", () => {
  assert.strictEqual(app.computeTier(80), "Findable. Not yet paid.");
  assert.strictEqual(app.computeTier(75), "Findable. Not yet paid.");
  assert.strictEqual(app.computeTier(50), "Two fixes from findable");
  assert.strictEqual(app.computeTier(10), "Ready to be found");
  assert.strictEqual(app.computeTier(-5), "Ready to be found");
});

test("createRateLimiter refills over time and caps its size", () => {
  const rl = app.createRateLimiter({ capacity: 2, windowMs: 1000, maxKeys: 3 });
  assert.ok(rl.take("a", 0).ok);
  assert.ok(rl.take("a", 0).ok);
  assert.ok(!rl.take("a", 0).ok);
  assert.ok(rl.take("a", 600).ok);
  for (const k of ["b", "c", "d", "e"]) rl.take(k, 700);
  assert.ok(rl.size() <= 3);
});

test("send guard allows one email per address per day", () => {
  const g = app.createSendGuard({ ttlMs: 1000 });
  assert.ok(g.claim("scorecard", "A@example.com", 0));
  assert.ok(!g.claim("scorecard", "a@example.com", 10));
  assert.ok(g.claim("welcome", "a@example.com", 10));
  assert.ok(g.claim("scorecard", "a@example.com", 1001));
});

test("ETag and 304 on a repeat request", async () => {
  const first = await request("GET", "/css/site.css", { headers: { "Accept-Encoding": "gzip" } });
  assert.strictEqual(first.status, 200);
  assert.ok(first.headers.etag);
  assert.strictEqual(first.headers["content-encoding"], "gzip");
  const second = await request("GET", "/css/site.css", { headers: { "If-None-Match": first.headers.etag } });
  assert.strictEqual(second.status, 304);
  assert.strictEqual(second.body, "");
});

test("unknown page is a 404 with the 404 page", async () => {
  const r = await request("GET", "/no-such-page");
  assert.strictEqual(r.status, 404);
  assert.match(r.body, /That page isn't here/);
});
