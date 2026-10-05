# The Future Maker Cohort, saved for later

Taken off the site on 25 September 2026 at Alana's request ("Remove the cohort and have the offer as the AI consultant and the community", then "those need to be saved so that we can add them at a different time"). Nothing in this folder is served. It is here so the cohort can go back up without rebuilding it.

Everything is also in git history: commit `4ffd776` (25 September 2026) is the last version with the cohort live.

## What is in this folder

- `cohort.html`: the full cohort page exactly as it was live, including the PayPal pay-now form (hosted button `TA72HYXXK745N`, £297, one payment), the CLIMB block with where each step happens in the six weeks, the Product OS guarantee wording, "how the six weeks run", the About Me section and the "Book a free 30-minute call first" button.
- The homepage pieces below, word for word.

## To put the cohort back

1. Copy `cohort.html` to `public/cohort.html`.
2. Remove the redirect in `index.js` (the block at the top of `serveStatic` that sends `/cohort` and `/cohort.html` to `/#offer`).
3. Add `https://www.growingwomeninbusiness.com/cohort.html` back to `public/sitemap.xml`.
4. Put the nav link back on each page: `<li><a href="/cohort.html" class="navlink">The Cohort</a></li>` (the pages currently carry `<li><a href="/#offer" class="navlink">Work with me</a></li>` in that slot).
5. Restore whichever homepage pieces below you want. The CSS for them (`.offer-hero-card`, `.facts-row`, `.offer-actions`, `.quiet-row`, `.climb-*`) is still in `public/css/site.css`.
6. Check the date, seat count and price against the Product OS before it goes live. The saved copy says "Starts 1 October 2026", ten seats, £297.
7. Put the cohort sentence back in the scorecard result email in `index.js` (see below).

## Homepage pieces removed on 25 September 2026

### Meta description (head, og:description and the JSON-LD description)

```
AI consultant and mentor Alana Arthurs helps women who've built everyone else's thing build a business with their own name on it. Six weeks, a website, one offer, a plan. Start with the free two-minute findable score.
```

### Hero subhead

```
I'm Alana. In six weeks you build a website, one clear thing to sell and a plan for showing up, with AI doing the heavy lifting and me making sure you actually use it.
```

### Nav (homepage)

```html
<li><a href="#what-you-get" class="navlink">What you get</a></li>
<li><a href="#method" class="navlink">How it works</a></li>
<li><a href="#about" class="navlink">About Alana</a></li>
<li><a href="#offer" class="navlink">The Cohort</a></li>
```

### Proof strip tile

```html
<div class="proof-tile">
  <span class="figure">1 October</span>
  <p>the first Future Maker Cohort starts. Ten seats.</p>
</div>
```

### "What you leave with" (the six-week version)

```html
<section class="white" id="what-you-get">
  <div class="inner center-head">
    <span class="eyebrow">What you leave with</span>
    <h2>Six weeks from now, this is yours</h2>
    <div class="leave-grid">
      <div class="leave-card">
        <h3>A website people can find</h3>
        <p>Built by you in our weekly sessions, with AI writing the first draft of every page. This site was made the same way.</p>
      </div>
      <div class="leave-card">
        <h3>One thing to buy, with a price on it</h3>
        <p>Not five ideas. One sentence: I help ___ with ___ for &pound;___. We get it out of your head and on to the page.</p>
      </div>
      <div class="leave-card">
        <h3>A plan for showing up</h3>
        <p>What to post and when, plus the prompts that write the rough draft, so you only have to be brave, not clever.</p>
      </div>
      <div class="leave-card">
        <h3>A fear buddy and a room</h3>
        <p>Another woman in the group, paired with you, to do the scary things beside you. Posting. Pricing. Putting yourself out there.</p>
      </div>
      <div class="leave-card">
        <h3>Everything, kept</h3>
        <p>Every recording, every prompt, the finished site and offer, and a month of me on WhatsApp after it ends.</p>
      </div>
    </div>
    <p class="leave-closing">The practical work and the fear work run together, not one after the other. That's the difference from a course.</p>
  </div>
</section>
```

### CLIMB (homepage version)

```html
<section class="white" id="method">
  <div class="inner center-head">
    <span class="eyebrow">The method</span>
    <h2>The method underneath it: CLIMB</h2>
    <p class="lede">The practical step, on top of the part nobody else touches: your nervous system and the daily habits already deciding whether you follow through.</p>
    <div class="climb-word" aria-hidden="true">
      <span class="climb-letter-big">C</span>
      <span class="climb-letter-big">L</span>
      <span class="climb-letter-big">I</span>
      <span class="climb-letter-big">M</span>
      <span class="climb-letter-big">B</span>
    </div>
    <div class="climb-grid">
      <div class="climb-step">
        <span class="letter">C</span>
        <h3>Calm the Body</h3>
        <p>Bring the nervous system down, together. You can't do the brave thing from fight-or-flight.</p>
      </div>
      <div class="climb-step">
        <span class="letter">L</span>
        <h3>Land It</h3>
        <p>Say the actual thing, out loud, in public. Not the vague version, the actual number, post, or conversation.</p>
      </div>
      <div class="climb-step">
        <span class="letter">I</span>
        <h3>In It Together</h3>
        <p>Never done alone. A fear buddy watches the scary thing happen, and says so.</p>
      </div>
      <div class="climb-step">
        <span class="letter">M</span>
        <h3>Move</h3>
        <p>Do it now. The smallest true version, today. Smaller still counts.</p>
      </div>
      <div class="climb-step">
        <span class="letter">B</span>
        <h3>Bank It</h3>
        <p>Prove it worked. Log it, in public, proof the other side wasn't as bad as it looked.</p>
      </div>
    </div>
  </div>
</section>
```

### The Cohort offer card (homepage) and the quiet row under it

```html
<span class="eyebrow">The offer</span>
<h2>The Future Maker Cohort</h2>
<div class="offer-hero-card">
  <ul class="facts-row">
    <li>Starts 1 October 2026</li>
    <li>ten seats</li>
    <li>six weeks</li>
    <li>an hour a week on Zoom</li>
    <li>1:1 help when you're stuck</li>
  </ul>
  <p class="price">&pound;297</p>
  <p class="price-note">one payment</p>
  <p class="offer-note">There's no cash refund. But if you turn up to the kickoff, come to the weekly calls and do the paired work with your buddy, and you still haven't done the one big scary thing you came here to do by day 42, I'll keep working with you 1:1, free, by WhatsApp or email, until you have.</p>
  <p class="offer-note">Bring a friend free. Every paid seat can bring one woman in at no cost.</p>
  <p class="offer-note">This is the first time I'm running it in this shape. I'd rather say that than pretend otherwise.</p>
  <div class="offer-actions">
    <a href="https://calendly.com/alana-arthurs/findable-call?utm_source=website&amp;utm_medium=offer&amp;utm_campaign=findable-call" class="btn" target="_blank" rel="noopener">Book a free 30-minute call first</a>
    <form action="https://www.paypal.com/ncp/payment/TA72HYXXK745N" method="post" target="_blank" class="pay-form">
      <button type="submit" class="btn btn-secondary">Pay &pound;297 now</button>
      <img src="https://www.paypalobjects.com/images/Debit_Credit_APM.svg" alt="Visa, Mastercard, American Express and PayPal accepted" class="pay-cards" />
    </form>
  </div>
  <a href="/cohort.html" class="offer-details-link">See full details</a>
</div>

<div class="quiet-row">
  <div class="quiet-card">
    <h3>The Circle</h3>
    <p>The floor under you. A weekly live, a Monday commitment, Friday wins, a fear buddy.</p>
    <p class="quiet-price">&pound;10 a month</p>
    <a href="/circle.html#offer" class="quiet-link">Join on the Circle page</a>
  </div>
  <div class="quiet-card">
    <h3>The Only Way Is Up</h3>
    <p>Alana's newsletter, every other Sunday. One true story about fear, one thing to do before Monday.</p>
    <p class="quiet-price">Free</p>
    <form class="newsletter-panel-form" data-source="Free Newsletter Card">
      <label for="nl-card-email" class="visually-hidden">Email address</label>
      <input id="nl-card-email" type="email" name="email" placeholder="you@email.com" required autocomplete="email" />
      <button type="submit" class="btn">Sign up</button>
    </form>
  </div>
</div>
```

### Scorecard result email, the cohort sentence (in `index.js`, `scorecardEmailHtml`)

```
The next Future Maker Cohort starts on 1 October, and this is the conversation that decides whether it's right for you.
```

It now reads: "That's also where we work out how I can help, if you want it: one to one, a day together, or The Circle at £10 a month."

### The Push page

`push.html` used to say the Push was "the same nervous-system-plus-practical method behind the six-week Future Maker Cohort". It now says "the same nervous-system-plus-practical method Alana uses one to one".

## Things that were never removed

- The Notion Product OS for the cohort (2 September 2026) and the Lead Magnet Plan (24 September 2026) still describe the cohort as the product. They need updating or a dated note, not deleting.
- `welcome.html` still has its `?offer=cohort` branch and `/api/first-action` still works; nothing links to them.
- The PDFs, the archetype quiz and the scorecard are untouched.
