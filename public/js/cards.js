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
    sea: '<circle cx="32" cy="22" r="8"/><path d="M32 7v4M19 13l2.5 2.5M45 13l-2.5 2.5"/><path d="M8 38c4-4 8-4 12 0s8 4 12 0 8-4 12 0 8 4 12 0"/><path d="M8 47c4-4 8-4 12 0s8 4 12 0 8-4 12 0 8 4 12 0"/><path d="M14 56h36"/>',
    note: '<circle cx="22" cy="46" r="6"/><path d="M28 46V12l18 6v8l-18-6"/><path d="M50 36v6M47 39h6"/>',
    notes: '<circle cx="18" cy="48" r="5"/><circle cx="42" cy="42" r="5"/><path d="M23 48V18l24-6v30"/><path d="M23 26l24-6"/><path d="M8 14l4 4M56 52l-4-4M54 16l-3 3"/>',
    chair: '<path d="M20 30V10h24v20"/><path d="M16 30h32v6H16z"/><path d="M18 36v18M46 36v18M20 46h24"/>',
    question: '<circle cx="32" cy="32" r="24"/><path d="M24 22a8 8 0 1 1 11.3 7.3c-2.3 1.4-3.3 3.6-3.3 6.7v4"/><circle cx="32" cy="47" r="1.8"/>',
    phone: '<rect x="18" y="8" width="24" height="48" rx="4"/><path d="M27 50h6"/><path d="M48 24a10 10 0 0 1 0 14M53 19a17 17 0 0 1 0 24"/>',
    camera: '<rect x="8" y="20" width="48" height="32" rx="4"/><path d="M22 20l4-6h12l4 6"/><circle cx="32" cy="36" r="9"/><circle cx="32" cy="36" r="4"/>',
    no: '<circle cx="32" cy="32" r="20"/><path d="M18 46L46 18"/>',
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
      action: "Give the hardest job on your list twenty minutes first thing. You're allowed to stop after that." },
    { n: "XXII", name: "The Raise", motif: "stairs",
      message: "Your price speaks before you've said a word. Practise saying a bigger number.",
      action: "Write your price 20% higher and read it out loud until it stops sounding scary. You don't have to charge it yet." },
    { n: "XXIII", name: "The Stretch Room", motif: "bridge",
      message: "If you're the most experienced person in every room, you've stopped growing. Find a bigger room.",
      action: "Find one free event or networking group this month where you'd normally feel out of your depth, and book your place." },
    { n: "XXIV", name: "The Dawn", motif: "sea",
      message: "A sunrise doesn't ask anything of you. It just reminds you that every day gets a fresh start.",
      action: "Set an alarm for sunrise one morning this week and watch it, phone in your pocket." },
    { n: "XXV", name: "The Volunteer", motif: "rings",
      message: "Giving your skill away for an hour reminds you how much it's worth.",
      action: "Offer one hour of what you're good at to a local cause or charity this month." },
    { n: "XXVI", name: "The Speech", motif: "echo",
      message: "You'd stand up for a friend's talent in a heartbeat. Do the same for your own.",
      action: "Stand in front of the mirror and say ‘I'm good at what I do, and here's why’ out loud, three times." },
    { n: "XXVII", name: "The Phone Call", motif: "phone",
      message: "A text is easy to hide behind. A voice is how people know you meant it.",
      action: "Ring someone you've been meaning to thank or make up with, instead of sending a text." }
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
      action: "Write down the exact moment you backed off. That's the bit we'll make smaller." },
    { n: "XIV", name: "The Sea", motif: "sea",
      message: "Cold water is loud for about thirty seconds. After that you're just a woman in the sea, grinning.",
      action: "Get in the sea this week, somewhere safe and with someone on the shore. Count to thirty out loud, then tell me how it felt." },
    { n: "XV", name: "The Silly One", motif: "smile",
      message: "Nobody is watching you as closely as you think. The ones who are wish they had the nerve.",
      action: "Do one daft thing in public today. Skip a few steps down the street or wave at a stranger, and let yourself look silly." },
    { n: "XVI", name: "The Dance", motif: "notes",
      message: "Your body remembers how to be free. Loud music gets it there faster than thinking does.",
      action: "Put your favourite song on loud and dance round the kitchen like nobody's in. Then do it again with somebody in." },
    { n: "XVII", name: "The Song", motif: "note",
      message: "Loud and proud. A voice that's allowed to sing is a voice that's allowed to ask for the sale.",
      action: "Sing one whole song at full volume today, in the car or the shower. Bonus point if someone hears you." },
    { n: "XVIII", name: "The Compliment", motif: "heart",
      message: "Kindness out loud takes more nerve than you'd think. It also makes two people's day.",
      action: "Tell a stranger one thing you genuinely like about them, then walk on. No waiting for a reaction." },
    { n: "XIX", name: "The Front Row", motif: "chair",
      message: "The back row feels safe because nobody can see you. That's exactly the problem.",
      action: "At the next talk, class or meeting, sit right at the front." },
    { n: "XX", name: "The Question", motif: "question",
      message: "Half the room wants to ask the same thing. Be the one who does.",
      action: "Put your hand up and ask one question in a room full of people. Then tell me what you asked." },
    { n: "XXI", name: "The Live", motif: "phone",
      message: "You know this stuff. Two minutes of you talking about it beats a perfect post you never make.",
      action: "Go live on Instagram for two minutes about something you know. No script, no retakes." },
    { n: "XXII", name: "The No", motif: "no",
      message: "Every guilty yes costs time you could spend on your own thing. No is a full sentence.",
      action: "Say no to one thing you'd normally agree to out of guilt. Don't explain it." },
    { n: "XXIII", name: "The Selfie", motif: "camera",
      message: "People buy from people. Let them see the woman behind the business.",
      action: "Post a photo of yourself, no filter, with one line about what you do." },
    { n: "XXIV", name: "The Big Ask", motif: "envelope",
      message: "The people you admire were all beginners once. Most of them remember it.",
      action: "Email someone you look up to with one specific question. The worst they can do is not reply." },
    { n: "XXV", name: "The Dream Out Loud", motif: "star",
      message: "A goal kept in your head stays a wish. Said out loud, it starts to become a plan.",
      action: "Tell one person the big goal you've never said out loud. Say it plainly, no laughing it off." },
    { n: "XXVI", name: "The Pitch", motif: "bell",
      message: "Someone out there is waiting for exactly what you sell. They can't say yes to an offer they never hear.",
      action: "Send one message today offering your thing to someone who could actually buy it." }
  ];

  var LIFT = [
    { n: "I", name: "The Name", motif: "cup",
      message: "Most people go a whole day without hearing their name said kindly. You can change that in two seconds.",
      action: "Use the name of the person who serves you today and thank them properly, eyes up from your phone." },
    { n: "II", name: "The Note", motif: "envelope",
      message: "A few kind words from a stranger can carry someone for a week.",
      action: "Leave a kind note where a stranger will find it, in a library book or on a café table." },
    { n: "III", name: "The Review", motif: "star",
      message: "Small businesses live on reviews. Yours could be the one that keeps them going.",
      action: "Write a glowing review for a small local business you love, and name the person who looked after you." },
    { n: "IV", name: "The Shout-Out", motif: "echo",
      message: "Another woman's win takes nothing away from yours. Cheering her on makes the whole room bigger.",
      action: "Post about another woman's business and tag her. Say exactly what she's brilliant at." },
    { n: "V", name: "The Voice Note", motif: "phone",
      message: "Hearing someone say they're proud of you lands differently from reading it.",
      action: "Send a friend a 30-second voice note telling her why you're proud of her." },
    { n: "VI", name: "The Introduction", motif: "rings",
      message: "You know people who should know each other. Connecting them costs you one message.",
      action: "Introduce two people who should meet, with one line on why you thought of them." },
    { n: "VII", name: "The Referral", motif: "key",
      message: "A recommendation from you opens a door she couldn't knock on herself.",
      action: "Recommend someone's work to a person who could hire her. Copy her in so she knows." },
    { n: "VIII", name: "The Celebration", motif: "sparkle",
      message: "Launching something is terrifying. The first person to show up is never forgotten.",
      action: "Find a woman who's just launched something and be her first comment, share or sale." },
    { n: "IX", name: "The Open Door", motif: "door",
      message: "The lesson that cost you a year could save someone else one.",
      action: "Share one thing you learned the hard way, in a post or a message, so someone else doesn't have to." },
    { n: "X", name: "The Cheerleader", motif: "heart",
      message: "Women starting out often post into silence. One real comment can be the reason they keep going.",
      action: "Comment properly on three posts from women just starting out. A real sentence, not an emoji." },
    { n: "XI", name: "The Smile Back", motif: "smile",
      message: "A smile costs nothing and travels further than you'd think.",
      action: "Smile at five strangers today and count how many smile back." },
    { n: "XII", name: "The Gratitude Round", motif: "sun",
      message: "Good things get bigger when you say them out loud together.",
      action: "At dinner or on a call, ask everyone for one good thing from their day. Go first." },
    { n: "XIII", name: "The Elder", motif: "tree",
      message: "Older people carry stories nobody asks about any more. Asking is a gift.",
      action: "Ring an older relative or neighbour and ask them a question about their life. Then listen." },
    { n: "XIV", name: "The Lift Home", motif: "path",
      message: "Someone near you is stretched thin and won't ask. Offer before they have to.",
      action: "Offer an hour of your time to someone who's struggling, whether that's the school run or a meal." },
    { n: "XV", name: "The Pass It On", motif: "plane",
      message: "Kindness grows when it moves. Keep it moving.",
      action: "When someone helps you today, help someone else before bed and tell them where it came from." }
  ];

  var BREAK = [
    { n: "I", name: "The Shake Off", motif: "wave", label: "Do it now",
      message: "Fear gets stuck in the body. Shake it loose and your head follows.",
      action: "Shake your hands, arms and legs hard for thirty seconds, like a dog coming out of the sea." },
    { n: "II", name: "The Power Pose", motif: "star", label: "Do it now",
      message: "Stand like you've already won and your body starts to believe it.",
      action: "Stand like a superhero, hands on hips and chin up, for one full minute." },
    { n: "III", name: "The Jump", motif: "stairs", label: "Do it now",
      message: "You can't spiral and do star jumps at the same time. Try it.",
      action: "Do ten star jumps right now, wherever you are." },
    { n: "IV", name: "The Cold Splash", motif: "sea", label: "Do it now",
      message: "Cold water snaps you back into the room. The spiral can't follow you there.",
      action: "Run cold water over your wrists or splash your face, then take one slow breath." },
    { n: "V", name: "The Stretch", motif: "bridge", label: "Do it now",
      message: "A scared body curls in. Make yourself big and the fear gets smaller.",
      action: "Reach both arms as high as they'll go and hold for five big breaths." },
    { n: "VI", name: "The Silly Voice", motif: "smile", label: "Do it now",
      message: "It's hard to believe a worry when a cartoon says it.",
      action: "Say the scary thought out loud in a cartoon voice. Then say it again, sillier." },
    { n: "VII", name: "The Count Back", motif: "hourglass", label: "Do it now",
      message: "Your brain can't panic and do maths at the same time.",
      action: "Count backwards from 100 in sevens, out loud if you can." },
    { n: "VIII", name: "The Five Things", motif: "eye", label: "Do it now",
      message: "Fear lives in the future. Your senses only work in the here and now.",
      action: "Name five things you can see, four you can hear and three you can touch." },
    { n: "IX", name: "The Stop Word", motif: "no", label: "Do it now",
      message: "A spiral needs your attention to keep going. Take it back.",
      action: "Pick a word like ‘Next’ or ‘Nope’ and say it out loud the second the spiral starts." },
    { n: "X", name: "The Rename", motif: "question", label: "Do it now",
      message: "Give the fear a daft name and it becomes a visitor, not the boss.",
      action: "Name your fear something silly, then greet it: ‘Oh, it's Doris again.’" },
    { n: "XI", name: "The Room Swap", motif: "chair", label: "Do it now",
      message: "New surroundings give your brain something new to think about.",
      action: "Get up and go to a different room, or step outside for one minute." },
    { n: "XII", name: "The Song Switch", motif: "notes", label: "Do it now",
      message: "One song can change how you feel in three minutes flat.",
      action: "Put on the one song that always lifts you, and turn it up loud." },
    { n: "XIII", name: "The Hum", motif: "echo", label: "Do it now",
      message: "Humming slows your breathing, and a slower breath tells your body it's safe.",
      action: "Hum any tune for thirty seconds, low and slow." },
    { n: "XIV", name: "The Laugh", motif: "bell", label: "Do it now",
      message: "Your body can't really tell a fake laugh from a real one. It just feels better.",
      action: "Fake laugh for thirty seconds. It usually turns into a real one." },
    { n: "XV", name: "The Text", motif: "phone", label: "Do it now",
      message: "A spiral shrinks the second someone else knows about it.",
      action: "Send your fear buddy one word, ‘spiralling’, and let her send one back." },
    { n: "XVI", name: "The Other Way", motif: "path", label: "Do it today",
      message: "Autopilot keeps you safe and keeps you small. Wake up the part of you that notices.",
      action: "Take a completely different route to somewhere you go every week. Tell me one thing you saw." },
    { n: "XVII", name: "The Wrong Hand", motif: "mirror", label: "Do it today",
      message: "You do most of your day without thinking. Feeling clumsy for a minute shows you how much.",
      action: "Brush your teeth or make your tea with your other hand today, and laugh at yourself while you do it." },
    { n: "XVIII", name: "The Swap", motif: "sun", label: "Do it today",
      message: "Your best hours go to the easy stuff because it feels productive. Give them to the hard thing instead.",
      action: "Do your hardest task at the time of day you'd normally save for the easy ones." },
    { n: "XIX", name: "The Silent Morning", motif: "sunrise", label: "Do it today",
      message: "Your own thoughts are hard to hear over everyone else's. Give them a morning.",
      action: "No phone, radio or podcast until 10am tomorrow. Just you and what you think." },
    { n: "XX", name: "The Yes Day", motif: "sparkle", label: "Do it today",
      message: "No keeps you comfortable. Yes takes you somewhere you haven't been.",
      action: "Say yes to the first new thing anyone suggests today, as long as it's safe and free." },
    { n: "XXI", name: "The Opposite", motif: "moon", label: "Do it today",
      message: "The things you always say about yourself aren't facts. They're habits.",
      action: "Write down one thing you always say about yourself, then spend today acting as if the opposite were true." },
    { n: "XXII", name: "The Delete", motif: "feather", label: "Do it today",
      message: "Half your to-do list belongs to someone else's idea of who you should be.",
      action: "Find one ‘should’ on your list that nobody asked you for, and cross it off for good." },
    { n: "XXIII", name: "The Stranger's Eyes", motif: "compass", label: "Do it today",
      message: "You're too close to your own business to see it clearly. Step back.",
      action: "Look at your business as if you'd just found it online. Write down the first thing you'd change." },
    { n: "XXIV", name: "The Fresh Start", motif: "door", label: "Do it today",
      message: "Some of what you do is only there because it always has been.",
      action: "If you started your business again tomorrow, what wouldn't you bother with? Stop one of those things this week." },
    { n: "XXV", name: "The Retired Excuse", motif: "pause", label: "Do it today",
      message: "Your favourite excuse has had a long career. Time it retired.",
      action: "Pick the excuse you use most and retire it out loud: ‘I'm not using that one any more.’ Tell me which one it was." },
    { n: "XXVI", name: "The Beginner", motif: "ladder", label: "Do it today",
      message: "Being bad at something new keeps you humble and hungry.",
      action: "Spend twenty minutes learning something you're rubbish at, like a dance or a language." },
    { n: "XXVII", name: "The New Voice", motif: "spiral", label: "Do it today",
      message: "If everyone you follow agrees with you, you've stopped learning.",
      action: "Follow five people who think completely differently from you and read what they post for a week." },
    { n: "XXVIII", name: "The Wrong Room", motif: "mountain", label: "Do it today",
      message: "The best ideas often come from rooms that have nothing to do with your work.",
      action: "Go to a free event outside your industry and start a conversation with one person there." },
    { n: "XXIX", name: "The Unplugged Hour", motif: "tree", label: "Do it today",
      message: "Your best ideas are waiting for a quiet moment. Screens never give them one.",
      action: "Spend one hour with no screen at all. Keep a pen handy for whatever turns up." },
    { n: "XXX", name: "The Burn It Down", motif: "flame", label: "Do it today",
      message: "The thing you'd never change might be the thing holding you back.",
      action: "Write down the one part of your business you'd never change, then spend ten minutes imagining you've been forced to." }
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

  // 11 shares no factor with 28, so this walks the whole deck in a mixed-up
  // order before any card comes round again. Change it if the deck size does.
  function pepForToday() {
    var n = PEP.length;
    return PEP[((today().dayNumber * 11 + 3) % n + n) % n];
  }

  function shuffled(count) {
    var a = [];
    for (var i = 0; i < count; i++) a.push(i);
    for (var j = a.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }

  // Draws at random without repeats until the whole deck has been seen.
  function randomDrawer(deck) {
    var queue = [];
    var last = -1;
    return function () {
      if (!queue.length) {
        queue = shuffled(deck.length);
        if (queue[0] === last) queue.push(queue.shift());
      }
      last = queue.shift();
      return deck[last];
    };
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return copyByHand(text); });
    }
    return copyByHand(text);
  }

  function copyByHand(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) { resolve(); } else { reject(new Error('copy failed')); }
    });
  }

  function setupDeck(root, draw, onShown) {
    var card = root.querySelector('.oracle-card');
    var back = root.querySelector('.oracle-back');
    var front = root.querySelector('.oracle-front');
    var again = root.querySelector('.deck-again');
    var share = root.querySelector('.deck-share');
    var deckName = root.querySelector('.deck-head h2').textContent;
    var slots = {
      n: front.querySelector('.oc-numeral'),
      motif: front.querySelector('.oc-motif'),
      name: front.querySelector('.oc-name'),
      message: front.querySelector('.oc-message'),
      action: front.querySelector('.oc-action'),
      label: front.querySelector('.oc-action-label')
    };
    var busy = false;
    var current = null;

    function fill(c) {
      current = c;
      slots.n.textContent = c.n;
      slots.motif.innerHTML = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">' + MOTIFS[c.motif] + '</svg>';
      slots.name.textContent = c.name;
      slots.message.textContent = c.message;
      slots.action.textContent = c.action;
      if (c.label) slots.label.textContent = c.label;
    }

    function faceUp() {
      card.classList.add('is-flipped');
      back.setAttribute('aria-hidden', 'true');
      back.tabIndex = -1;
      front.removeAttribute('aria-hidden');
      slots.name.focus({ preventScroll: true });
      if (share) share.hidden = false;
      if (onShown) onShown();
    }

    back.addEventListener('click', function () {
      if (busy || card.classList.contains('is-flipped')) return;
      fill(draw());
      faceUp();
    });

    if (share) {
      var shareLabel = share.textContent;
      share.addEventListener('click', function () {
        if (!current) return;
        var url = location.origin + '/cards' + (root.id ? '#' + root.id : '');
        var text = deckName + ', ' + current.name + ': “' + current.message + '” ' + current.action + ' Draw your own card here:';
        if (navigator.share) {
          navigator.share({ title: current.name + ' | ' + deckName, text: text, url: url }).catch(function () {});
          return;
        }
        copyText(text + ' ' + url).then(function () {
          share.textContent = 'Copied. Paste it to a friend';
        }, function () {
          window.prompt('Copy this and send it to a friend:', text + ' ' + url);
        }).then(function () {
          setTimeout(function () { share.textContent = shareLabel; }, 2500);
        });
      });
    }

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
    var lift = document.querySelector('[data-deck="lift"]');
    var brk = document.querySelector('[data-deck="break"]');

    if (pep) {
      setupDeck(pep, pepForToday, function () {
        var when = today().date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        pep.querySelector('.deck-note').textContent = "That's your card for " + when.replace(',', '') + '. A new one turns up at midnight.';
        showNext(pep);
      });
    }

    if (fear) {
      setupDeck(fear, randomDrawer(FEAR), function () {
        fear.querySelector('.deck-note').textContent = 'Do the action, then tell someone you did it.';
        fear.querySelector('.deck-again').hidden = false;
        showNext(fear);
      });
    }

    if (lift) {
      setupDeck(lift, randomDrawer(LIFT), function () {
        lift.querySelector('.deck-note').textContent = 'Pass it on, then notice how you feel.';
        lift.querySelector('.deck-again').hidden = false;
        showNext(lift);
      });
    }

    if (brk) {
      setupDeck(brk, randomDrawer(BREAK), function () {
        brk.querySelector('.deck-note').textContent = 'Do it, then notice what changed.';
        brk.querySelector('.deck-again').hidden = false;
        showNext(brk);
      });
    }
  });
})();
