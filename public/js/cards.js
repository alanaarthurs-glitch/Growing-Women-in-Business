/* The two oracle decks on /cards. The Daily Pep shows one card per calendar
   day (the same card for everyone that day); The Fear Buddy draws at random,
   without repeats until the whole deck has been seen. */

(function () {
  'use strict';

  // Line drawings for the card faces, drawn on a 64 by 64 grid.
  var MOTIFS = {
    sunrise: '<path d="M8 46h48"/><path d="M18 46a14 14 0 0 1 28 0"/><path d="M32 18v6M15 25l4 4M49 25l-4 4M10 37h5M49 37h5"/><path d="M22 53h20"/>',
    cup: '<path d="M16 24h28v10a14 14 0 0 1-28 0z"/><path d="M44 27h3a5 5 0 0 1 0 10h-4"/><path d="M14 52h32"/><path d="M25 12c-2 3 2 5 0 8M33 10c-2 3 2 5 0 8"/>',
    path: '<path d="M26 58c-10-5 10-11 2-18s12-9 6-16 8-8 6-14"/><path d="M10 58h44"/><circle cx="41" cy="6" r="2.5"/>',
    wave: '<path d="M8 24c4-5 8-5 12 0s8 5 12 0 8-5 12 0 8 5 12 0"/><path d="M8 34c4-5 8-5 12 0s8 5 12 0 8-5 12 0 8 5 12 0"/><path d="M8 44c4-5 8-5 12 0s8 5 12 0 8-5 12 0 8 5 12 0"/>',
    mirror: '<ellipse cx="32" cy="25" rx="13" ry="16"/><ellipse cx="32" cy="25" rx="8.5" ry="11"/><path d="M32 41v13M25 55h14"/>',
    spiral: '<path d="M30 32a2 2 0 1 1 4 0a5 5 0 1 1-10 0a8 8 0 1 1 16 0a11 11 0 1 1-22 0a14 14 0 1 1 28 0a17 17 0 1 1-34 0"/>',
    feather: '<path d="M46 10C28 12 18 28 18 50c14-2 26-14 28-40z"/><path d="M18 50l-6 6"/><path d="M40 18L22 46"/>',
    flame: '<path d="M32 56c-9 0-15-6-15-15 0-9 8-13 9-25 6 4 9 10 9 15 2-2 3-5 3-8 5 4 9 11 9 18 0 9-6 15-15 15z"/><path d="M32 56c-4 0-6-3-6-7 0-4 4-6 5-11 3 3 7 6 7 11 0 4-2 7-6 7z"/>',
    sparkle: '<path d="M32 8c2 14 10 22 24 24-14 2-22 10-24 24-2-14-10-22-24-24 14-2 22-10 24-24z"/><path d="M52 8v6M49 11h6"/><path d="M12 48v5M9.5 50.5h5"/>',
    smile: '<circle cx="32" cy="32" r="15"/><path d="M25 35c3 5 11 5 14 0"/><path d="M25 28c1-2 3-2 4 0M35 28c1-2 3-2 4 0"/><path d="M32 6v6M32 52v6M6 32h6M52 32h6M14 14l4 4M46 46l4 4M50 14l-4 4M14 50l4-4"/>',
    ladder: '<path d="M22 6v52M42 6v52M22 14h20M22 24h20M22 34h20M22 44h20M22 54h20"/>',
    pause: '<path d="M23.6 11.7h16.8l11.9 11.9v16.8l-11.9 11.9H23.6l-11.9-11.9V23.6z"/><path d="M27 25v14M37 25v14"/>',
    door: '<path d="M20 56V24a12 12 0 0 1 24 0v32"/><path d="M12 56h40"/><circle cx="38" cy="40" r="1.6"/><path d="M48 30l7-3M48 40h8M48 50l7 3"/>',
    tree: '<path d="M32 40V26"/><path d="M32 30c-9 0-15-5-15-12S24 8 32 8s15 3 15 10-6 12-15 12z"/><path d="M12 42h40"/><path d="M32 40v6c-3 4-8 6-12 7M32 46c3 4 8 6 12 7M32 46v10"/>',
    heart: '<path d="M32 52S12 40 12 25a10 10 0 0 1 20-4 10 10 0 0 1 20 4c0 15-20 27-20 27z"/><path d="M50 6v6M47 9h6"/>',
    envelope: '<rect x="10" y="18" width="44" height="30" rx="2"/><path d="M10 20l22 16 22-16"/>',
    compass: '<circle cx="32" cy="32" r="22"/><path d="M32 14l6 18-6 18-6-18z"/><circle cx="32" cy="32" r="2"/><path d="M32 4v4M32 56v4M4 32h4M56 32h4"/>',
    star: '<path d="M32 8l5.8 16.1 17 .5-13.5 10.4 4.8 16.4L32 41.8l-14.1 9.6 4.8-16.4L9.2 24.6l17-.5z"/><path d="M54 4v6M51 7h6M10 6v5M7.5 8.5h5"/>',
    moon: '<path d="M40 10a22 22 0 1 0 14 34A18 18 0 0 1 40 10z"/><path d="M50 18v5M47.5 20.5h5M56 30v4M54 32h4"/>',
    sun: '<circle cx="32" cy="32" r="11"/><circle cx="32" cy="32" r="5"/><path d="M32 6v8M32 50v8M6 32h8M50 32h8M13.6 13.6l5.6 5.6M44.8 44.8l5.6 5.6M50.4 13.6l-5.6 5.6M19.2 44.8l-5.6 5.6"/>',
    bell: '<path d="M18 44c2-4 2-8 2-14a12 12 0 0 1 24 0c0 6 0 10 2 14z"/><path d="M14 44h36"/><path d="M28 49a4 4 0 0 0 8 0"/><path d="M32 14v4"/><path d="M52 18c3 3 4 7 3 11M12 18c-3 3-4 7-3 11"/>',
    mountain: '<path d="M4 54l18-28 9 12 9-16 20 32z"/><path d="M35 31l3 2 2-3 2 3 3-2"/><path d="M40 22V10l8 3-8 3"/>',
    eye: '<path d="M6 34s10-15 26-15 26 15 26 15-10 15-26 15S6 34 6 34z"/><circle cx="32" cy="34" r="7"/><circle cx="32" cy="34" r="2"/><path d="M32 6v5M18 10l2.5 4.5M46 10l-2.5 4.5"/>',
    echo: '<circle cx="14" cy="32" r="4"/><path d="M24 22a14 14 0 0 1 0 20M32 16a22 22 0 0 1 0 32M40 10a30 30 0 0 1 0 44"/>',
    bridge: '<path d="M4 40h56"/><path d="M8 40c6-14 14-20 24-20s18 6 24 20"/><path d="M16 40v-9M24 40V24M32 40V20M40 40V24M48 40v-9"/><path d="M6 50c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0"/>',
    hourglass: '<path d="M18 8h28M18 56h28"/><path d="M21 8c0 12 22 12 22 24S21 44 21 56"/><path d="M43 8c0 12-22 12-22 24s22 12 22 24"/><path d="M26 52h12l-6-5z"/>',
    list: '<rect x="16" y="8" width="32" height="48" rx="3"/><path d="M24 20h16M24 30h16M24 40h10"/><path d="M23 48l3 3 6-6"/>',
    plane: '<path d="M8 30l48-20-12 44-12-16z"/><path d="M32 38l24-28"/><path d="M32 38v12l6-6"/>',
    rings: '<circle cx="24" cy="34" r="14"/><circle cx="40" cy="34" r="14"/><path d="M32 6v6M29 9h6"/>',
    wind: '<path d="M8 24h28a6 6 0 1 0-6-6"/><path d="M8 34h40a6 6 0 1 1-6 6"/><path d="M8 44h20a5 5 0 1 1-5 5"/>',
    coin: '<circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="15"/><path d="M32 22l2.6 7.1h7.5l-6 4.5 2.3 7.2-6.4-4.4-6.4 4.4 2.3-7.2-6-4.5h7.5z"/>',
    key: '<circle cx="18" cy="32" r="9"/><circle cx="18" cy="32" r="3"/><path d="M27 32h29M48 32v8M54 32v6"/>',
    medal: '<circle cx="32" cy="24" r="14"/><path d="M32 16l2.4 5h5.4l-4.3 3.4 1.6 5.4-5.1-3.2-5.1 3.2 1.6-5.4-4.3-3.4h5.4z"/><path d="M24 36l-6 20 8-4 4 7 2-9M40 36l6 20-8-4-4 7-2-9"/>',
    stairs: '<path d="M8 54h12V44h12V34h12V24h12"/><path d="M50 18V6M45 11l5-5 5 5"/>',
    seed: '<path d="M12 50h40"/><path d="M32 50V34"/><path d="M32 38c-8 0-12-6-12-12 7 0 12 5 12 12z"/><path d="M32 34c0-8 5-13 12-13 0 7-5 13-12 13z"/><ellipse cx="32" cy="55" rx="5" ry="2.5"/>'
  };

  var PEP = [
    { n: "0", name: "The Beginning", motif: "sunrise",
      message: "You don't have to feel ready to start. Ready usually turns up halfway through.",
      action: "Pick the smallest piece of the thing you keep putting off and do only that piece before lunch." },
    { n: "I", name: "The Morning", motif: "cup",
      message: "The first ten minutes of your day set the tone for the rest. Give them to yourself before you give them to anyone else.",
      action: "Tomorrow, leave your phone in another room for the first ten minutes. Tonight, decide which room." },
    { n: "II", name: "The Walk", motif: "path",
      message: "Fear sits in the body before it reaches your head. Move your body and your head usually follows.",
      action: "Go for a ten-minute walk with nothing in your ears. Notice what you can see and hear." },
    { n: "III", name: "The Shake", motif: "wave",
      message: "Shake it to wake it. It looks daft and it works, which makes it one of the best tools you've got.",
      action: "Put one song on and shake your whole body out until it finishes." },
    { n: "IV", name: "The Mirror", motif: "mirror",
      message: "Listen to the words you use on yourself today. You'd never speak to a friend like that.",
      action: "Catch one unkind thing you say about yourself. Write it down, then write what you'd say to a friend instead." },
    { n: "V", name: "The Hard Drive", motif: "spiral",
      message: "Whatever you repeat most becomes what you believe. So choose what goes on repeat.",
      action: "Write one thing you've already done this year on a sticky note and put it where you'll see it every morning." },
    { n: "VI", name: "The Voice", motif: "feather",
      message: "That voice telling you not to bother is usually borrowed. Once you know whose it is, it loses its grip.",
      action: "Catch Yourself Thinking. Write down the next ‘you can’t’ in your head, and next to it, whose voice it really is." },
    { n: "VII", name: "The One Thing", motif: "flame",
      message: "A long list makes you feel busy. One thing done makes you feel brave.",
      action: "Write today's list and circle the one thing that matters most. Do that before anything else." },
    { n: "VIII", name: "The Space", motif: "sparkle",
      message: "You're allowed to take up room. Your ideas deserve the same space you give everyone else's.",
      action: "Block one hour in your diary this week that belongs only to your business, and give it a name." },
    { n: "IX", name: "The Laugh", motif: "smile",
      message: "It's very hard to panic and laugh at the same time. Laughing tells your body you're safe.",
      action: "Ring the friend who always makes you laugh. Five minutes, no business talk." },
    { n: "X", name: "The Ladder", motif: "ladder",
      message: "The only way is up, one rung at a time. The small rungs count, even when nobody claps.",
      action: "Write down one thing you did this week that moved you forward, however small it looks." },
    { n: "XI", name: "The Halt", motif: "pause",
      message: "Nothing good gets decided in a panic. Halt first. The decision will still be there in five minutes.",
      action: "Next time your chest tightens today, put both feet flat on the floor and take five slow breaths before you reply." },
    { n: "XII", name: "The Door", motif: "door",
      message: "The door you're scared of is usually lighter than it looks. You only find out by pushing it.",
      action: "Send the message you've been drafting in your head for days. Two lines is plenty." },
    { n: "XIII", name: "The Roots", motif: "tree",
      message: "Build the woman first. The business grows out of her, not the other way round.",
      action: "Before you open your laptop, do one thing that's purely for you. No apologising for it." },
    { n: "XIV", name: "The Thank You", motif: "heart",
      message: "Gratitude isn't fluffy. It points your attention at what's already working.",
      action: "Write down one thing that went right yesterday and who helped. Then tell them." },
    { n: "XV", name: "The Post", motif: "envelope",
      message: "Someone out there needs exactly what you know. They can't find you if you stay quiet.",
      action: "Share one useful thing online today. It doesn't need to be perfect, it needs to be helpful." },
    { n: "XVI", name: "The Compass", motif: "compass",
      message: "You know more than you think you do. Get quiet enough to hear it.",
      action: "Sit for two minutes with your eyes closed and ask yourself what the next right step is. Write down the first answer." },
    { n: "XVII", name: "The Star", motif: "star",
      message: "You are not behind. You're on your own timeline, and it's a good one.",
      action: "Mute one account today that leaves you feeling like you're losing a race." },
    { n: "XVIII", name: "The Moon", motif: "moon",
      message: "Rest is part of the work. Tired women make scared decisions.",
      action: "Set an alarm for the time you'll stop working tonight, and stop when it goes." },
    { n: "XIX", name: "The Sun", motif: "sun",
      message: "Look how far you've come. The woman you were a year ago would be proud of you.",
      action: "Write a few lines to yourself from a year ago, telling her one thing that's happened since." },
    { n: "XX", name: "The Ask", motif: "bell",
      message: "Asking for help isn't weakness. It's how strong women get so much done.",
      action: "Ask one person for one specific thing today. Be clear about what you need." },
    { n: "XXI", name: "The Mountain", motif: "mountain",
      message: "Hard things get easier the more you do them. You've done hard things before.",
      action: "Give the hardest job on your list twenty minutes first thing. You're allowed to stop after that." }
  ];

  var FEAR = [
    { n: "I", name: "The Witness", motif: "eye",
      message: "You're not doing this into thin air. I see you, and I'm watching for the win.",
      action: "Text someone you trust the scary thing you're doing today and the time you'll have done it by." },
    { n: "II", name: "The Rehearsal", motif: "echo",
      message: "Say it to me first. Once it's been out loud once, the second time is easier.",
      action: "Record a voice note of the sentence that scares you and send it to a friend before you say it for real." },
    { n: "III", name: "The Other Side", motif: "bridge",
      message: "Fear only shows you the worst bit. It never shows you the other side, and the other side is usually fine.",
      action: "Write down what you're scared will happen, then what's most likely to happen. Read the second one out loud." },
    { n: "IV", name: "The Ten Minutes", motif: "hourglass",
      message: "You don't have to be brave all day. Ten minutes will do.",
      action: "Set a timer for ten minutes and make a start on the scary thing. Badly is fine. Stop when it rings." },
    { n: "V", name: "The Bucket List", motif: "list",
      message: "This is a game, not a test. Every scary thing you do goes on the list.",
      action: "Start your scary-things list. Write down what you'd love to tick off this month, then circle the easiest." },
    { n: "VI", name: "The Send Button", motif: "plane",
      message: "I'll read it before you post it. Then you press the button, not me.",
      action: "Send the draft you've been sitting on to a friend for a one-word reply. Then publish it." },
    { n: "VII", name: "The Kind Word", motif: "rings",
      message: "If your fear buddy did this exact thing, what would you tell her? Tell yourself the same.",
      action: "Write that sentence down in your own words and read it out loud before you start." },
    { n: "VIII", name: "The Breath", motif: "wind",
      message: "Your body thinks this is danger. It isn't. Give it a minute to catch up.",
      action: "Breathe in for four and out for six, five times over. Then go." },
    { n: "IX", name: "The Price", motif: "coin",
      message: "Say the price to me before you say it to her. It's a number, not an apology.",
      action: "Say your price out loud to a friend or the mirror. No ‘just’ in front of it and no laugh after it." },
    { n: "X", name: "The Small Yes", motif: "key",
      message: "One yes to the scary thing is enough for today. Tomorrow can look after itself.",
      action: "Say yes to the thing you've been dithering over. Work out the how afterwards." },
    { n: "XI", name: "The Win", motif: "medal",
      message: "Did it? Then tell me. A win nobody sees is easy to forget.",
      action: "Tell someone what you did today and how it actually went, not how you feared it would go." },
    { n: "XII", name: "The Next One", motif: "stairs",
      message: "You've done one. The next one is already smaller than it looked.",
      action: "Pick tomorrow's scary thing now, while you still feel brave, and write it down." },
    { n: "XIII", name: "The Not Yet", motif: "seed",
      message: "Didn't do it today? That isn't failure, it's information. We go again tomorrow.",
      action: "Write down the exact moment you backed off. That's the bit we'll make smaller." }
  ];

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HALF_TURN_MS = reduceMotion ? 0 : 420;
  var FULL_TURN_MS = reduceMotion ? 0 : 860;

  function today() {
    var d = new Date();
    return {
      date: d,
      dayNumber: Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)
    };
  }

  // 7 shares no factor with 22, so this walks the whole deck in a mixed-up
  // order before any card comes round again.
  function pepForToday() {
    var n = PEP.length;
    return PEP[((today().dayNumber * 7 + 3) % n + n) % n];
  }

  var fearQueue = [];
  var lastFear = -1;

  function shuffled(count) {
    var a = [];
    for (var i = 0; i < count; i++) a.push(i);
    for (var j = a.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }

  function nextFear() {
    if (!fearQueue.length) {
      fearQueue = shuffled(FEAR.length);
      if (fearQueue[0] === lastFear) fearQueue.push(fearQueue.shift());
    }
    lastFear = fearQueue.shift();
    return FEAR[lastFear];
  }

  function setupDeck(root, draw, onShown) {
    var card = root.querySelector('.oracle-card');
    var back = root.querySelector('.oracle-back');
    var front = root.querySelector('.oracle-front');
    var again = root.querySelector('.deck-again');
    var slots = {
      n: front.querySelector('.oc-numeral'),
      motif: front.querySelector('.oc-motif'),
      name: front.querySelector('.oc-name'),
      message: front.querySelector('.oc-message'),
      action: front.querySelector('.oc-action')
    };
    var busy = false;

    function fill(c) {
      slots.n.textContent = c.n;
      slots.motif.innerHTML = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">' + MOTIFS[c.motif] + '</svg>';
      slots.name.textContent = c.name;
      slots.message.textContent = c.message;
      slots.action.textContent = c.action;
    }

    function faceUp() {
      card.classList.add('is-flipped');
      back.setAttribute('aria-hidden', 'true');
      back.tabIndex = -1;
      front.removeAttribute('aria-hidden');
      slots.name.focus({ preventScroll: true });
      if (onShown) onShown();
    }

    back.addEventListener('click', function () {
      if (busy || card.classList.contains('is-flipped')) return;
      fill(draw());
      faceUp();
    });

    if (!again) return;

    again.addEventListener('click', function () {
      if (busy) return;
      busy = true;
      again.disabled = true;
      front.setAttribute('aria-hidden', 'true');
      card.classList.remove('is-flipped');
      setTimeout(function () { fill(draw()); }, HALF_TURN_MS);
      setTimeout(function () {
        faceUp();
        again.disabled = false;
        busy = false;
      }, FULL_TURN_MS);
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function showNext(deck) {
    var link = deck.querySelector('.deck-next');
    if (link) link.hidden = false;
  }

  ready(function () {
    var pep = document.querySelector('[data-deck="pep"]');
    var fear = document.querySelector('[data-deck="fear"]');

    if (pep) {
      setupDeck(pep, pepForToday, function () {
        var when = today().date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        pep.querySelector('.deck-note').textContent = "That's your card for " + when.replace(',', '') + '. A new one turns up at midnight.';
        showNext(pep);
      });
    }

    if (fear) {
      setupDeck(fear, nextFear, function () {
        fear.querySelector('.deck-note').textContent = 'Do the action, then tell someone you did it.';
        fear.querySelector('.deck-again').hidden = false;
        showNext(fear);
      });
    }
  });
})();
