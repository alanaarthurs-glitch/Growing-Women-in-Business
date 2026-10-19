// Tests for the Build What's Yours sign-in (os-builder.js). No real Notion
// or Resend calls: both are faked, and answers go to a temporary folder.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createOsBuilder } = require("../os-builder");

function str(x) { return typeof x === "string" ? x.trim() : ""; }
function isEmail(e) { return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(e); }
function fakeRes() {
  return {
    status: null, body: null,
    writeHead(s) { this.status = s; }, end(d) { this.body = JSON.parse(d); },
  };
}
function sendJSON(res, status, body) { res.writeHead(status); res.end(JSON.stringify(body)); }

function setup(opts) {
  const o = opts || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "osb-"));
  const sent = [];
  const notionCalls = [];
  const pages = [];
  const invite = o.invite || [{ email: "Amy@Example.com", allowed: true }];
  let clock = 1_000_000;
  const builder = createOsBuilder({
    env: Object.assign({ NOTION_API_KEY: "k", RESEND_API_KEY: "r", RESEND_FROM_EMAIL: "a@b.co", OS_BUILDER_DIR: dir }, o.env || {}),
    dataDir: dir,
    contentFile: path.join(__dirname, "..", "private", "os-builder-content.js"),
    now: () => clock,
    str, isEmail, sendJSON,
    notionRequest: async (url, method, payload) => {
      notionCalls.push({ url, method, payload });
      if (url.endsWith("/query")) {
        return { results: invite.map((r, i) => ({ id: "page" + i, properties: { Email: { email: r.email }, Allowed: { checkbox: r.allowed } } })) };
      }
      return {};
    },
    resendSend: async (msg) => { sent.push(msg); return true; },
    createNotionPage: async (db, props) => { pages.push({ db, props }); return {}; },
    upsertCrmContact: async () => {},
    emailCapOk: () => true,
  });
  const call = async (route, body) => { const res = fakeRes(); await builder.routes["/api/os/" + route]({}, res, body); return res; };
  const codeFrom = () => sent[sent.length - 1].subject.match(/(\d{6})/)[1];
  return { builder, call, sent, notionCalls, pages, codeFrom, dir, tick: (ms) => { clock += ms; } };
}

async function signIn(t, email) {
  await t.call("start", { email });
  const res = await t.call("verify", { email, code: t.codeFrom() });
  return res;
}

test("someone not on the invite list gets not-invited and no email", async () => {
  const t = setup();
  const res = await t.call("start", { email: "stranger@example.com" });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.reason, "not-invited");
  assert.strictEqual(t.sent.length, 0);
});

test("an invited email gets a code, even typed with different capitals", async () => {
  const t = setup();
  const res = await t.call("start", { email: "  amy@EXAMPLE.com " });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(t.sent.length, 1);
  assert.strictEqual(t.sent[0].to, "amy@example.com");
  assert.match(t.sent[0].subject, /\d{6}/);
});

test("unticked Allowed means no access", async () => {
  const t = setup({ invite: [{ email: "amy@example.com", allowed: false }] });
  const res = await t.call("start", { email: "amy@example.com" });
  assert.strictEqual(res.status, 403);
});

test("wrong code is refused, right code signs in", async () => {
  const t = setup();
  await t.call("start", { email: "amy@example.com" });
  const wrong = await t.call("verify", { email: "amy@example.com", code: "000000" === t.codeFrom() ? "111111" : "000000" });
  assert.strictEqual(wrong.status, 400);
  const right = await t.call("verify", { email: "amy@example.com", code: t.codeFrom() });
  assert.strictEqual(right.status, 200);
  assert.ok(right.body.token);
  assert.strictEqual(right.body.accountSaving, true);
});

test("a code can't be reused and runs out after 10 minutes", async () => {
  const t = setup();
  await t.call("start", { email: "amy@example.com" });
  const code = t.codeFrom();
  assert.strictEqual((await t.call("verify", { email: "amy@example.com", code })).status, 200);
  assert.strictEqual((await t.call("verify", { email: "amy@example.com", code })).status, 400);
  await t.call("start", { email: "amy@example.com" });
  t.tick(11 * 60 * 1000);
  const late = await t.call("verify", { email: "amy@example.com", code: t.codeFrom() });
  assert.strictEqual(late.body.reason, "expired");
});

test("five wrong guesses locks the code", async () => {
  const t = setup();
  await t.call("start", { email: "amy@example.com" });
  const real = t.codeFrom();
  const bad = real === "999999" ? "888888" : "999999";
  for (let i = 0; i < 5; i++) await t.call("verify", { email: "amy@example.com", code: bad });
  const res = await t.call("verify", { email: "amy@example.com", code: real });
  assert.strictEqual(res.body.reason, "expired");
});

test("no more than five codes an hour per email", async () => {
  const t = setup();
  for (let i = 0; i < 5; i++) assert.strictEqual((await t.call("start", { email: "amy@example.com" })).status, 200);
  assert.strictEqual((await t.call("start", { email: "amy@example.com" })).status, 429);
});

test("the questions only come with a valid sign-in", async () => {
  const t = setup();
  assert.strictEqual((await t.call("content", {})).status, 401);
  assert.strictEqual((await t.call("content", { token: "nonsense.token" })).status, 401);
  const { body } = await signIn(t, "amy@example.com");
  const res = await t.call("content", { token: body.token });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.modules.length, 8);
});

test("a tampered token is refused", async () => {
  const t = setup();
  const { body } = await signIn(t, "amy@example.com");
  const [payload, sig] = body.token.split(".");
  const forged = Buffer.from(JSON.stringify({ e: "boss@example.com", x: 9e15 })).toString("base64url") + "." + sig;
  assert.strictEqual((await t.call("load", { token: forged })).status, 401);
  assert.strictEqual((await t.call("load", { token: payload + ".x" + sig })).status, 401);
});

test("answers save, load back, and delete", async () => {
  const t = setup();
  const { body } = await signIn(t, "amy@example.com");
  const save = await t.call("save", { token: body.token, changes: { story: "My story", leak: { pick: 1 }, "Bad Key!": "x" } });
  assert.strictEqual(save.status, 200);
  const load = await t.call("load", { token: body.token });
  assert.deepStrictEqual(load.body.answers, { story: "My story", leak: { pick: 1 } });
  await t.call("save", { token: body.token, changes: { story: null } });
  assert.deepStrictEqual((await t.call("load", { token: body.token })).body.answers, { leak: { pick: 1 } });
  await t.call("delete", { token: body.token });
  assert.deepStrictEqual((await t.call("load", { token: body.token })).body.answers, {});
});

test("an over-long answer is refused", async () => {
  const t = setup();
  const { body } = await signIn(t, "amy@example.com");
  const res = await t.call("save", { token: body.token, changes: { story: "x".repeat(20001) } });
  assert.strictEqual(res.status, 413);
});

test("removing someone from the list locks them out within a minute", async () => {
  const invite = [{ email: "amy@example.com", allowed: true }];
  const t = setup({ invite });
  const { body } = await signIn(t, "amy@example.com");
  invite[0].allowed = false;
  t.tick(61 * 1000);
  assert.strictEqual((await t.call("load", { token: body.token })).status, 403);
});

test("on Railway without a volume, answers are not kept on the server", async () => {
  const t = setup({ env: { OS_BUILDER_DIR: "", RAILWAY_ENVIRONMENT: "production" } });
  const { body } = await signIn(t, "amy@example.com");
  assert.strictEqual(body.accountSaving, false);
  const save = await t.call("save", { token: body.token, changes: { story: "hi" } });
  assert.strictEqual(save.body.accountSaving, false);
});

test("an image request lands in the Notion image requests table", async () => {
  const t = setup();
  const { body } = await signIn(t, "amy@example.com");
  assert.strictEqual((await t.call("image-request", { slot: "Logo", description: "A calm logo" })).status, 401);
  const res = await t.call("image-request", { token: body.token, slot: "Photo of you", description: "Me with my dog by the sea", business: "Amy's Shop", colours: "#112233" });
  assert.strictEqual(res.status, 200);
  const page = t.pages.find((p) => p.db === "860004a52d8648b1a2974b51314034c1");
  assert.ok(page, "request saved to the image requests table");
  assert.strictEqual(page.props["Image for"].select.name, "Photo of you");
  assert.strictEqual(page.props.Email.email, "amy@example.com");
  assert.strictEqual(page.props.Status.select.name, "New");
});

test("an image request needs a description, and an unknown slot becomes Other", async () => {
  const t = setup();
  const { body } = await signIn(t, "amy@example.com");
  assert.strictEqual((await t.call("image-request", { token: body.token, slot: "Logo", description: "" })).status, 400);
  await t.call("image-request", { token: body.token, slot: "<script>", description: "Something nice" });
  assert.strictEqual(t.pages.pop().props["Image for"].select.name, "Other");
});
