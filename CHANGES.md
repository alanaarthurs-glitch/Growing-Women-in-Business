# Growing Women in Business: what changed and why

Base: `main` at `4ffd776` ("Rebuild the homepage around the findable scorecard...").
Everything below was built and tested in a copy (`website-audit/gwib-improved/`). The live repo has not been touched.

## Before and after

All numbers measured on the same machine with the same scripts: the "before" server on port 3101, the "after" server on port 3201. Google Fonts and PayPal are blocked in the test environment in both runs, so font loading isn't part of either set of numbers.

| Check | Before | After |
|---|---|---|
| Crash: `GET /%00` | Yes, server process exits | No. 400, `/healthz` still answers |
| Crash: POST body `null`, `{"email":123}`, `{"email":["a"]}`, `{"firstName":5}` | Yes, process exits | No. 400 each time |
| HTML injection into the scorecard email | Yes (`<img onerror>`, fake links, `<script>`) | No. Every value escaped, unknown categories dropped |
| Rate limit on `/api/*` | None. 121,186 newsletter POSTs accepted in 10 s | 20 per IP per 10 min. Same test: 20 accepted, 256,389 refused with 429 |
| Cross-site POST (`Origin: https://evil.example`) | Accepted | 403 |
| `text/plain` POST | Parsed as JSON | 415 |
| `GET /` 100 connections, 20 s | 1,762 req/s, p99 84 ms | 9,365 req/s, p99 22 ms |
| `GET /` 300 connections, 15 s | 2,046 req/s, p99 254 ms | 9,038 req/s, p99 60 ms |
| `GET /scorecard` 100 connections, 20 s | 857 req/s, p99 148 ms | 3,637 req/s, p99 51 ms |
| Lighthouse mobile `/` (perf / a11y / best practice / SEO) | 96 / 100 / 96 / 100. LCP 2.3 s, Speed Index 4.0 s | 99 / 100 / 96 / 100. LCP 1.7 s, Speed Index 1.4 s |
| Lighthouse mobile `/scorecard` | 98 / 100 / 96 / 100. LCP 1.4 s, Speed Index 3.8 s | 99 / 100 / 96 / 100. LCP 1.6 s, Speed Index 1.5 s |
| Lighthouse mobile `/cohort.html` | 96 / 100 / 96 / 100. LCP 2.3 s, Speed Index 3.9 s | 99 / 100 / 96 / 100. LCP 1.7 s, Speed Index 1.4 s |
| "Get my score" button at 375 x 812 | y = 869 to 923, below the fold | y = 735 to 789, visible without scrolling |
| Scorecard result: main call to action | 1,836 px down the page, two screens below the score | 429 px, straight under the tier name, on the first screen |
| Share button on the result | No | Yes |
| Lowest tier call to action | "Join The Only Way Is Up" linked to the home page | One tap sign-up on the page |
| "Take it again" | Sent a second POST (and a second email) | One POST per visit |
| Logo bytes | 98,326 (512 px PNG shown at 56 to 110 px) | 18,719 on normal screens, 58,923 on retina |
| Home page bytes at 375 (crawl) | 208,656 | 132,215 |
| White text on button gradient, worst point | 2.7 : 1 (fails AA) | 5.9 : 1 (passes AA) |
| Menu button size on phones | 22 x 44 px | 44 x 44 px |
| axe violations (home, scorecard start, question, result) | 2 (no H1 on question and result screens) | 0 |
| Pages that say "1 October" | Home (twice), Cohort, scorecard email | None |
| Horizontal overflow, script errors, broken internal links | 0, 0, 0 | 0, 0, 0 (15 internal links checked) |
| Automated tests | None | 21, all passing (`npm test`) |

Lighthouse "best practice" is 96 in both runs only because the blocked Google Fonts requests log console errors here. The scorecard's LCP moved 0.2 s the other way, inside normal run-to-run noise, and the page is 27 KB heavier (the new logo and the extra script). Load tests ran on a shared 4-core machine, so treat the req/s as a ratio rather than a promise.

## Security fixes (index.js)

1. **The server can no longer be knocked over by one request.** The whole request handler sits in a try/catch and returns a 500 instead of dying. Every async handler has a `.catch()`. `unhandledRejection` and `uncaughtException` are logged and the process carries on. Paths containing a null byte get a 400 before they reach the file system. Before, `GET /%00` or a POST with `null` as the body stopped the site until Railway restarted it.
2. **Bodies are checked before anything uses them.** Only `application/json` is accepted (415 otherwise). Bodies over 32 KB get a 413 (they used to be dropped silently at 1 MB). The body has to be a plain JSON object (400 otherwise). Every field goes through `str()`, so a number or an array becomes an empty string instead of a crash. Email addresses are checked on every form, not only the scorecard.
3. **Other sites can't post to the forms.** If a request carries an `Origin` header it must be the site itself, the request's own host (so Railway preview links still work), or localhost. Anything else gets a 403.
4. **Rate limit.** 20 form posts per IP per 10 minutes, then 429 with a `Retry-After` header. It refills at one every 30 seconds. The memory it uses is pruned every minute and capped at 10,000 IPs.
5. **One email of each kind per address per day.** The scorecard email and the quiz guide email each go to an address at most once in 24 hours, so the forms can't be used to flood someone's inbox through Resend.
6. **Honeypot.** A hidden `website` field. If a bot fills it in, the server says "ok" and does nothing.
7. **Emails are escaped.** A new `escapeHtml()` is used for every value in both email builders. Scorecard categories are rebuilt from the three real area names only, with scores clamped 0 to 100. Quick wins must be text, at most three, 200 characters each. The tier is worked out on the server from the score (75 and over, 40 and over, below 40), never taken from the browser.
8. **The welcome page can't mark anyone as paid.** `/api/first-action` used to set the Notion Stage to "Paid" from a public form. It now sets "Welcome page". The comment in the code explains that a verified PayPal webhook (or Alana checking PayPal) is the right source for "Paid". Notion adds the new option the first time it sees it.
9. **Email copy.** The low-tier email only says "You're on it now" if she ticked the newsletter box. Otherwise it offers "reply to this email with yes and I'll add you". The "starts on 1 October" sentence is gone; set `NEXT_COHORT_LINE` in Railway to add a date line back. If a low-tier lead said she wants help soon, the email also offers the free call, to match the page.
10. **Headers and redirects.** `Cross-Origin-Opener-Policy: same-origin-allow-popups` on every response. HSTS now includes `preload`. The http to https redirect always goes to `SITE_ORIGIN`, never to whatever the Host header says, so it can't be used as an open redirect. The public folder check is now `startsWith(PUBLIC_DIR + path.sep)`, so a sibling folder such as `public-old` can't match. PUT, DELETE and other methods on pages get a 405. HEAD works.
11. **Time limits.** Every call to Notion and Resend gives up after 8 seconds. The server also times out slow request headers (20 s) and bodies (30 s).

## Speed (index.js and the pages)

12. **Static file cache.** Each file is read and gzipped once, then kept in memory with an ETag. A cheap `fs.stat` on each request notices when a file changes on disk. Repeat visits get a 304 with no body. This is where the 5x throughput comes from: before, every request re-read the file and gzipped it again.
13. **Fonts load in parallel.** The `@import` at the top of `site.css` is gone. Every page that uses `site.css` now has the Google Fonts `<link>` (and the two preconnects) in its `<head>`, before `site.css`, so the browser fetches both at once instead of one after the other.
14. **Hero photo preload.** The home page preloads `/images/alana-about.jpg` with high priority, since it's the biggest thing on the first screen.
15. **Smaller logo.** `logo-168.png` (168 px) and `logo-336.png` (336 px, for retina screens) are made from `logo.png`. Every logo `<img>` now uses `srcset` with both and `width`/`height` 84. `logo.png` stays for the JSON-LD and social sharing. Saving: 79,607 bytes (81%) on normal screens, 39,403 bytes (40%) on retina, per page view.

## Content and design

16. **No stale date.** `public/js/config.js` now has `cohortStartLine` (empty) and `cohortSeats` ("ten seats"). The home page proof tile reads "Next cohort / dates announced to the list first", the facts row reads "Next cohort: dates announced to the list first", and the Cohort page line reads the same, followed by "ten seats" and "once the room's full, it's closed". A small script at the bottom of both pages swaps in `cohortStartLine` when it's set. Alana sets the next date in one place. "Ten seats" and "six weeks" are kept.
17. **Button contrast.** The button gradient now runs from `#7E2836` to `#B03A4E` (white text 9.4:1 and 5.9:1). The old rose end `#DF8491` gave 2.7:1. `--grad-deep` ends on `#7E2836` too. Same change in the scorecard, which has its own copy of these colours.
18. **Menu button.** Stays 44 x 44 on phones. A rule at 600 px used to squash it to 22 px wide.
19. **Long text on phones reads left aligned.** Below 560 px these switch from centred to left: the "who it's for" lists, the "what you leave with" cards, the AI section, the offer notes and guarantee, the Cohort and Circle hero text, section intros (`p.lede`), the final call to action text and the newsletter panel intro. Headings and buttons stay centred. I measured which paragraphs were centred and longer than three lines rather than guess.
20. **PayPal cards image.** Alt text shortened to "Cards accepted", with width and height set and overflow hidden, so the alt text no longer spills out when PayPal's image is blocked. The width (140) is an estimate because PayPal's server can't be reached from here. The CSS keeps the real shape once it loads.
21. **Privacy page.** New `public/privacy.html`: what the scorecard, quiz, newsletter, application and welcome forms collect, that it's kept in Notion with a backup on the server and emailed through Resend, that payments go through PayPal, no analytics cookies, and how to unsubscribe or ask for deletion at hello@alanaarthurs.com. **It's a draft for Alana to check.** It has not been reviewed by a lawyer. Check the line on how long details are kept. Linked from every page footer and from the scorecard. Added to `sitemap.xml`.
22. **Not indexed.** `welcome.html` and `404.html` now carry `<meta name="robots" content="noindex">`.

## The scorecard (public/scorecard.html)

23. **Branded, with a way back.** A small bar at the top of the card: the logo and "Growing Women in Business", linking to the home page.
24. **"Get my score" visible on a phone.** The consent label is now "Send me the odd note from Growing Women in Business. Unsubscribe any time." with the privacy line under it (now linking to `/privacy.html`). Empty error lines take no space and the top of the card is tighter on phones. At 375 x 812 the button sits at y 735 to 789.
25. **One H1 per screen.** The question and the result greeting are H1s now, styled at the same size as before. The result sub-headings became H2s so the heading order stays correct.
26. **Main call to action under the tier name.** The same button as before (for example "Book my free 30-minute call") now also sits straight under the tier pill. The one lower down stays.
27. **Hot leads get the call.** If she's in the lowest tier but said "In the next few weeks" or "I'd like some help with this", the main button is "You said you'd like a hand. Book a free 30-minute call", and the newsletter sign-up comes second.
28. **No dead end for the lowest tier.** "Join The Only Way Is Up" used to link to the home page. It's now a one-tap button, "Yes, send me The Only Way Is Up", which signs her up (`/api/newsletter`, source "Findable Scorecard") and changes to "You're on the list. Watch your inbox." If she ticked the box at the start, it just says "You're on the list".
29. **Share my score.** Uses the phone's share sheet where there is one, with "I scored {pct}% on the findable score. Can anybody find what you've built? Two minutes:" and the scorecard link tagged `utm_source=share`. Elsewhere it copies the same text and link and the button reads "Copied" for 2 seconds.
30. **"Take it again" doesn't send again.** The result is posted once per visit.
31. **"Press 1 to 4" tip hidden on touch screens.**
32. **The hidden honeypot field** is sent with both posts.
33. **Long button labels wrap between words** and never overflow the card. Slightly less side padding on phones keeps "Book my free 30-minute call" on one line.
34. External call links open in a new tab, so the result stays open behind Calendly.

## Tests

`tests/server.test.js` uses Node's built-in test runner, no packages. It starts the real server on a spare port and checks: security headers; `/%00` gives 400 and the server still answers; path traversal gives 403; PUT gives 405; HEAD; `null` and wrong-type bodies give 400 on all four forms; `text/plain` gives 415; a 40 KB body gives 413; a foreign Origin gives 403; the honeypot saves nothing; the 21st post from one IP gives 429; stored scorecards have the server's tier and only known categories; `escapeHtml`; the scorecard email escapes an `<img onerror>` name; the "you're on it" line depends on consent; `computeTier`; the rate limiter and send guard; ETag and 304; the 404 page.

Run it with `npm test`. (The script is `node --test tests/*.test.js`. Node 22 no longer accepts a bare folder after `--test`.)

## Things to know before you push

- **The patch doesn't carry the new logo files or the tests.** The diff command leaves out `tests/` and `logo-*.png`. If you use the patch, copy `public/images/logo-168.png`, `public/images/logo-336.png` and the `tests/` folder across as well, or every logo on the site will be a broken image.
- **COOP is `same-origin-allow-popups`, not `same-origin`.** The Circle page uses PayPal's subscription button, which opens a PayPal popup that talks back to the page. Plain `same-origin` cuts that link and can break the checkout. This setting keeps the protection against other sites and lets the PayPal popup work. Try a test subscription after deploying.
- **HSTS preload is only a flag.** The domain joins the browser list only if you submit it at hstspreload.org, and that's slow to undo. Only submit once every subdomain is on HTTPS.
- **The rate limit trusts the first `X-Forwarded-For` value.** If Railway's edge adds to that header rather than replacing it, someone could change their apparent IP. Worth a quick check with Railway. The per-email limit still applies either way.
- **Limits live in memory.** A restart or a second instance resets them. Fine for one small Railway service.
- **The stored JSONL keeps text exactly as typed.** A name like `<img ...>` is saved as plain JSON text, which is harmless on its own. It's escaped wherever it's turned into HTML. Escaping at storage time would turn "O'Brien" into "O&#39;Brien" in Notion.
- **The quiz guide email** now goes once per address per day, so retaking the quiz with the same email on the same day won't send a second PDF.
- **Notion Stage "Welcome page"** is a new option. If you filter Applications by Stage, add it to the view.
- **The privacy page is a draft.** Read it first. Delete the comment at the top once you're happy.
- **Next Cohort date:** set `cohortStartLine` in `public/js/config.js` (for example "Starts 12 January 2027") and `NEXT_COHORT_LINE` in Railway for the email.

## How to apply

Either:

1. Copy the files in `website-audit/gwib-improved/` over the repo (everything except `data/`, which is never committed), or
2. From the repo root: `git apply ../tree-life-happy-joy/website-audit/gwib-improvements.patch` (use the path to the patch on your machine), then copy `public/images/logo-168.png`, `public/images/logo-336.png` and `tests/` from `gwib-improved/`. `patch -p1 < gwib-improvements.patch` works too.

Then:

```bash
npm test     # 21 passing
npm start    # look at /, /scorecard and /cohort.html on a phone-sized window
git add -A && git commit -m "Harden the server, speed up static files, fix the scorecard flow"
git push     # Railway deploys
```

After the deploy: post the scorecard once with your own email, check the email arrives and reads right, and run a test PayPal subscription on the Circle page.
