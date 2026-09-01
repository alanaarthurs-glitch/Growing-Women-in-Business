# Growing Women in Business, website

The site for [growingwomeninbusiness.com](https://www.growingwomeninbusiness.com/). Plain HTML, CSS and vanilla JS in `public/`, served by a small dependency-free Node server (`index.js`). Push to GitHub, Railway builds and deploys automatically. No build step, no framework, no npm runtime dependencies.

## Pages

| Page | Purpose |
|---|---|
| `public/index.html` | Home: hero, who it's for, the method, about, the quiz, ways in, final CTA. |
| `public/circle.html` | The Circle, £10 a month, PayPal subscription. |
| `public/cohort.html` | The Future Maker Cohort, £297 for six weeks, PayPal pay-now. |
| `public/push.html` | The Push, currently paused, waitlist only, no prices. |
| `public/apply.html` | The fit-check form for the Cohort. Posts to `/api/apply`. |
| `public/welcome.html` | Post-payment page for both offers (`?offer=circle` or `?offer=cohort`). The Cohort side posts to `/api/first-action`. |
| `public/whats-next.html` | Links out to Alana's wider world (alanaarthurs.com, Vector Rope Access). |
| `public/404.html` | Not found page. |

Every page shares one head, topbar, footer and newsletter panel pattern, and loads `/js/nav.js` and `/js/newsletter-panel.js` before `</body>`. The apply and welcome pages also load `/js/config.js` first, since they read it.

## Integrations

- **Notion**, three databases under 📥 Website Leads: Applications, Newsletter Signups, CRM — Contacts. Every write is best-effort: if the Notion call fails, the request still succeeds and the lead is logged locally.
- **Resend**, sends the archetype PDF after the quiz, when someone leaves their email against a result.
- **PayPal**: a subscription button for The Circle, a hosted pay-now button for the Cohort. Both redirect to `welcome.html` on approval. Neither is touched by anything server-side; the plan ID and client ID live in the page markup.
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

1. `public/circle.html` or `public/cohort.html`: the `.price` line in the offer box, and any small print near it (instalments, "per month", and so on).
2. The same file's JSON-LD `Product`/`Offer` block in the `<head>`.
3. The PayPal button: The Circle's subscription plan ID and the Cohort's hosted button ID are set by Alana in the PayPal dashboard, not in this repo. Changing the price shown on the page does not change what PayPal actually charges, the two have to be kept in step by hand.
4. Check `public/index.html`'s "Ways in" cards, which repeat both prices.

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
