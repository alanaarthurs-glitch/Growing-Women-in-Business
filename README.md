# Growing Women in Business, website

The site for [growingwomeninbusiness.com](https://www.growingwomeninbusiness.com/). Plain HTML, CSS and vanilla JS in `public/`, served by a small dependency-free Node server (`index.js`). Push to GitHub, Railway builds and deploys automatically. No build step, no framework, no npm runtime dependencies.

## Pages

| Page | Purpose |
|---|---|
| `public/index.html` | Home: split hero with photo, proof strip, who it's for, what we build, how AI fits, CLIMB (the method behind the day, five steps with a life lane and a business lane each), about, three ways to work with Alana (AI consulting, a day plus thirty days of follow-through, The Circle), final CTA. Loads no PayPal SDK. |
| `public/quiz.html` | The Future Maker archetype quiz, moved off the home page. Loads `/js/config.js` and `/js/quiz.js`. |
| `public/circle.html` | The Circle, £10 a month, PayPal subscription. |
| `public/ai-consulting.html` | AI consulting, one to one: the full offer page behind the homepage card. No price on the page, it is agreed on the free 30-minute call (Calendly findable-call, `utm_campaign=ai-consulting`). |
| `public/cards.html` | Draw a card (`/cards`): two oracle-style decks on a navy band. The Daily Pep (28 cards, 0 to XXVII; the day formula in `cards.js` needs a multiplier coprime with the deck size) shows one card per calendar day, the same for everyone; The Fear Buddy (41 cards) draws at random whenever she needs it; The Lift (15 cards) draws at random and is about lifting someone else. Each deck has a "Share with a friend" button (native share sheet, else copy, else a copy-by-hand box). Every card has a motivational line and one easy action. Under the decks, "Keep going" offers The Circle (button to `circle.html#offer`) or the newsletter (sign-up tagged source "Draw a Card"); that section replaces the usual newsletter panel on this page. Card copy lives in `/js/cards.js`, styles in `/css/cards.css`. |
| `public/push.html` | The Push, currently paused, waitlist only, no prices. |
| `public/apply.html` | The "tell me where you're at" form for one-to-one work. Posts to `/api/apply`. |
| `public/welcome.html` | Post-payment page for The Circle (`?offer=circle`). The `?offer=cohort` branch is dormant since the Cohort came off the site on 25 September 2026. |
| `public/whats-next.html` | Links out to Alana's wider world (alanaarthurs.com, Vector Rope Access). |
| `public/404.html` | Not found page. Not indexed. |
| `public/privacy.html` | Plain-English privacy notice (a draft for Alana to check). Linked from every footer and the scorecard. |

Every page shares one head, topbar, footer and newsletter panel pattern, and loads `/js/nav.js` and `/js/newsletter-panel.js` before `</body>`. The apply, welcome and quiz pages also load `/js/config.js` first, since they read it. The topbar button on every page is "Get my score", pointing at `/scorecard`. Every menu carries "Draw a card" (`/cards`) just before "Work with me"; the standalone scorecard page has no menu.

## Integrations

- **Notion**, three databases under 📥 Website Leads: Applications, Newsletter Signups, CRM — Contacts. Every write is best-effort: if the Notion call fails, the request still succeeds and the lead is logged locally.
- **Resend**, sends the archetype PDF after the quiz, when someone leaves their email against a result.
- **PayPal**: a subscription button for The Circle on `circle.html`, redirecting to `welcome.html` on approval. Nothing server-side touches it; the plan ID and client ID live in the page markup. The home page loads no PayPal SDK and links through to `circle.html` to join.
- **Local JSONL fallback**, written to `data/` (gitignored), one file per form: `applications.jsonl`, `newsletter.jsonl`, `first-actions.jsonl`. This is a backup, not the record of truth; Notion is.

## Environment variables

Set these in Railway → your service → Variables. Never commit them.

| Variable | Purpose | If unset |
|---|---|---|
| `PORT` | Port to listen on. Railway sets this itself. | Falls back to `3000`. |
| `SITE_ORIGIN` | The canonical origin, used to build the redirect target for the bare domain and to derive which host counts as "bare". | Falls back to `https://www.growingwomeninbusiness.com`. |
| `NOTION_API_KEY` | Notion integration token, shared across all three databases. | Notion writes are skipped; local JSONL logging still happens. |
| `NOTION_APPLICATIONS_DB_ID` | The Applications database ID. | Applications and first actions aren't written to Notion. |
| `NOTION_NEWSLETTER_DB_ID` | The Newsletter Signups database ID. | Newsletter signups aren't written to Notion. |
| `NOTION_CRM_DB_ID` | The CRM — Contacts database ID. | No CRM upsert happens on any form. |
| `RESEND_API_KEY` | Resend API key. | The archetype PDF email is skipped. |
| `RESEND_FROM_EMAIL` | The verified "from" address in Resend. | Same as above. |
| `NEXT_COHORT_LINE` | One sentence about the next Cohort date for the scorecard email, for example `The next Future Maker Cohort starts on 12 January.` | The email says nothing about dates. |
| `DATA_DIR` | Where the local JSONL backups go. | `data/` next to `index.js`. |

## The next Cohort date

The date lives in two places, both one line. On the site: `cohortStartLine` in `public/js/config.js` (empty shows "Next cohort: dates announced to the list first"). In the scorecard email: the `NEXT_COHORT_LINE` variable in Railway.

## Tests

```bash
npm test
```

Starts the server on a spare port and checks the security fixes (bad requests get 400s rather than crashing the server, cross-site posts get 403, the rate limit kicks in, emails are escaped) and the caching. Needs Node 18 or later and nothing else.

## Run it locally

**With Node (18 or later):**

```bash
npm start           # then open http://localhost:3000
PORT=4173 npm start # or pick your own port
```

**Without Node**, on a Windows machine, use the PowerShell static server instead. It serves `public/` on `http://localhost:8080/` with the same clean URLs and a 404 page, and stubs every `POST /api/*` call with `{"ok":true}` so forms can be tried end to end without any real Notion or PayPal calls:

```powershell
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
```

`Ctrl+C` stops it. It's a preview tool only, not what Railway runs.

## Changing a price

There's no single source of truth to edit, prices are written into the page copy directly. To change one:

1. `public/circle.html`: the `.price` line in the offer box, and any small print near it ("per month", the refund line).
2. The same file's JSON-LD `Product`/`Offer` block in the `<head>`.
3. The PayPal button: The Circle's subscription plan ID is set by Alana in the PayPal dashboard, not in this repo. Changing the price shown on the page does not change what PayPal actually charges, the two have to be kept in step by hand.
4. Check `public/index.html`, which repeats The Circle's price in the hero, the proof strip and the Circle card. The consulting and day offers show no price: it is agreed on the call.

## The config file

`public/js/config.js` holds the two things Alana hasn't chosen yet:

```js
window.GWIB_CONFIG = {
  bookingUrl: "",    // Calendly / Cal.com / TidyCal / Google booking link
  communityUrl: ""   // Where The Circle actually lives (Skool, Facebook group)
};
```

Leave a value empty and the affected page falls back to plain text ("Alana will call you within 48 hours") instead of showing a broken or dead button. Fill either in once it's decided and every page that needs it picks it up automatically.

## Open decisions (from the brief, section 16)

These aren't blocked on code, they're waiting on Alana:

1. Colour and type direction: keep ink/pink/mint with Cormorant Garamond, or move to the Brand OS's navy/rose/sage with Archivo Black.
2. Confirm £10 a month is the intended Circle price, and update Notion to match (it still says £39 in places).
3. Where The Circle actually lives (Skool, the Facebook group, or elsewhere) and the join link a new subscriber gets.
4. A booking tool for the Cohort welcome call and the Circle discovery call.
5. Whether to add a real instalment payment link for the Cohort's three roughly-£100 payments, or drop the line from the page.
6. Consent to name Babs, Amy and Emma publicly on the site.
7. Whether The Push stays up as a waitlist page or comes down until it reopens.
8. Cohort cadence and the maximum wait between signup and kickoff.
9. Sign-off on the ORBIT and CLIMB letter-by-letter breakdowns, said out loud and confirmed.
10. The root domain redirect: `growingwomeninbusiness.com` (no www) needs forwarding set up in GoDaddy, or adding as a second Railway domain. Nothing in this repo can fix that from the outside.
11. How public the two-tier funding model is, and whether What's Next appears on this site at all.
12. A real newsletter sending platform (Resend here is transactional only).
13. The Vector turnover figure, to be checked against the accounts before it appears anywhere on this site.
14. Smaller flags: the oracle practice and how much of the spiritual side shows publicly, softening the £800-a-night shots figure, the name of the first retail job, and the job-application stat that shouldn't be quoted as fact.

## The pipeline (one-time setup)

1. Create a GitHub repo and push this code to it.
2. Connect the repo to Railway (railway.app → New Project → Deploy from GitHub repo).
3. Railway builds and deploys on every push to `main` from then on.
4. Add the `growingwomeninbusiness.com` domain in Railway → Settings → Domains, then point the DNS at your registrar to what Railway gives you.

## After setup: the daily loop

```bash
git add .
git commit -m "your change"
git push
```

Railway detects the push and redeploys automatically. Watch it in the Railway dashboard → Deployments.

## Security and encryption

- **HTTPS everywhere.** Railway terminates TLS with an automatically renewed certificate for `www.growingwomeninbusiness.com`. Its edge redirects plain HTTP to HTTPS, and `index.js` does the same again using `X-Forwarded-Proto`, so no page is ever served unencrypted.
- **HSTS.** Every HTTPS response carries `Strict-Transport-Security: max-age=31536000; includeSubDomains`, so browsers that have visited once refuse to try HTTP for a year.
- **Content Security Policy.** Scripts, styles, fonts, images, frames, network calls and form targets are locked to this site plus PayPal (`*.paypal.com`, `*.paypalobjects.com`) and Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`). Anything else a browser is asked to load is blocked. `upgrade-insecure-requests` turns any stray `http://` asset into `https://`. To add a new third party (an analytics tag, a booking widget), add its origin to the matching directive in `CONTENT_SECURITY_POLICY` in `index.js`.
- **Other headers.** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, a restrictive `Permissions-Policy`.
- **Secrets.** Notion and Resend keys live only in Railway's Variables, never in this repo. The PayPal client ID and plan IDs in the pages are public identifiers by design. The site sets no cookies.
- **Data in transit to third parties.** Notion, Resend and PayPal are all called over HTTPS.
- **Local lead log.** `data/*.jsonl` is a plain-text fallback copy of form submissions on the Railway container's disk (ephemeral, wiped on redeploy). Notion is the record of truth. If you'd rather keep no plain-text copy at all, remove the `appendLocalLead` calls in `index.js`.
- **Still to do outside the code.** The bare domain `growingwomeninbusiness.com` (no www) still serves GoDaddy's page. Set a permanent forward to `https://www.growingwomeninbusiness.com` in GoDaddy (Domain settings, Forwarding), or add the bare domain as a second custom domain in Railway. Until then the redirect in `index.js` never sees that traffic.
