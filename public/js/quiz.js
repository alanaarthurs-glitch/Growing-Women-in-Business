function initFutureMakerQuiz(containerId, source) {
  var ARCHETYPES = {
    wildflower: {
      name: "The Wildflower",
      desc: "You grew in ground nobody would've chosen for you, and did it anyway. You're still quietly getting on with it, whether anyone's watching or not.",
      cta: "Now root down and keep growing on purpose."
    },
    ember: {
      name: "The Ember",
      desc: "You're not loud about it, never have been. There's real heat underneath, waiting for the moment you say go.",
      cta: "Now stop holding it back. Let it move."
    },
    pearl: {
      name: "The Pearl",
      desc: "Whatever you've been carrying has been under pressure a long time, and it's turned into something worth showing. You've just been keeping it inside the shell.",
      cta: "Now let the room see what's been forming."
    },
    mademoiselle: {
      name: "Mademoiselle",
      desc: "You've got standards, and you're not sorry for them. You're not waiting because you're scared, you're waiting for the right room, and you get to decide when that room's ready.",
      cta: "Now decide the room's ready. It is."
    },
    latebloomer: {
      name: "The Late Bloomer",
      desc: "You're not behind, you never were. You've built on your own timeline while everyone else made noise about theirs. Now you're ready to go faster.",
      cta: "Now pick up the pace, on your own terms."
    },
    firestarter: {
      name: "The Firestarter",
      desc: "You get everyone else moving, every time, and you're always last on your own list.",
      cta: "Now put yourself on your own list."
    },
    sage: {
      name: "The Sage",
      desc: "You already know more than you give yourself credit for. People come to you because you usually have the answer.",
      cta: "Now trust what you already know."
    },
    livewire: {
      name: "The Live Wire",
      desc: "Ten ideas before breakfast and the energy to match. You just need one push to actually start.",
      cta: "Now point all that energy at one thing."
    },
    anchor: {
      name: "The Anchor",
      desc: "Everyone leans on you, and you've built a life around holding it together. You need to learn you're allowed to lean on someone too.",
      cta: "Now let someone hold it with you."
    }
  };

  var PROMPTS = {
    wildflower: "I've grown without much support and I keep growing quietly. Ask me five questions, one at a time, to find the one thing I've built that deserves to be seen. Then help me write two sentences about it that I'd be proud to post.",
    ember: "There's something I really want to do and I keep holding it back. Ask me what it is, then give me the smallest first step I can take in ten minutes today, and help me do it right now.",
    pearl: "I've been carrying something for a long time that could help other people. Interview me about it, one question at a time, then turn my answers into a short post I can share this week.",
    mademoiselle: "I'm waiting for the right room. Help me describe it: who's in it, what it feels like and what my standards are. Then suggest one real room I could walk into this month, and a first line to say when I get there.",
    latebloomer: "Here's what I've built over the years, in my own time: [list it]. Show me how it adds up to proof that I'm further along than I feel, then give me one bold next step to take this week.",
    firestarter: "I spend my time getting everyone else moving. My own goal is [your goal]. Help me protect one hour this week just for it, and plan the first three things I'll do in that hour.",
    sage: "People ask me for answers all the time. Ask me the five questions I get asked most, then help me turn my answers into short tips I can share, so people can find my advice without having to ask.",
    livewire: "Here are all my ideas right now: [paste them]. Help me pick the one worth doing first, turn it into a three-step plan I can finish by Friday, and park the rest on a list for later.",
    anchor: "I carry a lot for other people. Help me list everything on my plate, pick one thing I can hand over or ask for help with, and draft a short, kind message asking for that help."
  };
  Object.keys(PROMPTS).forEach(function (key) { ARCHETYPES[key].prompt = PROMPTS[key]; });

  var PRIORITY = ["wildflower","ember","pearl","mademoiselle","latebloomer","firestarter","sage","livewire","anchor"];

  var QUESTIONS = [
    {
      q: "When it comes to starting the thing you keep putting off, which sounds most like you?",
      options: [
        { t: "I've grown wherever I've been planted, this would just be one more place.", a: "wildflower" },
        { t: "I'm not loud about it. It's more that something's building quietly underneath.", a: "ember" },
        { t: "Whatever I've been carrying has been under pressure a long time now.", a: "pearl" }
      ]
    },
    {
      q: "What's actually been stopping you?",
      options: [
        { t: "I'm not scared, I'm just waiting for the right room.", a: "mademoiselle" },
        { t: "Everyone else made noise about their timeline. I've been building on mine.", a: "latebloomer" },
        { t: "I'm too busy getting everyone else moving to put myself on the list.", a: "firestarter" }
      ]
    },
    {
      q: "How does the fear actually show up for you?",
      options: [
        { t: "I already know the answer, I just don't give myself credit for it.", a: "sage" },
        { t: "I've got ten ideas before breakfast, I just need one push to start.", a: "livewire" },
        { t: "Everyone leans on me. I've never really let myself lean on anyone.", a: "anchor" }
      ]
    },
    {
      q: "If you finally did the scary thing, what would it prove?",
      options: [
        { t: "That I keep growing, whether anyone's watching or not.", a: "wildflower" },
        { t: "That I get to decide when the room's ready, not anyone else.", a: "mademoiselle" },
        { t: "That people have been right to come to me for the answer all along.", a: "sage" }
      ]
    },
    {
      q: "What's the quiet truth underneath it all?",
      options: [
        { t: "There's real heat under here, it's just banked down for now.", a: "ember" },
        { t: "I'm not behind. I'm about to catch up fast.", a: "latebloomer" },
        { t: "I've got the energy, I just haven't pointed it anywhere yet.", a: "livewire" }
      ]
    },
    {
      q: "What do you actually need right now?",
      options: [
        { t: "Somewhere to finally show what's been forming under pressure.", a: "pearl" },
        { t: "Someone to put me on my own list for once.", a: "firestarter" },
        { t: "Permission to lean on someone else for a change.", a: "anchor" }
      ]
    },
    {
      q: "What don't people realise about you?",
      options: [
        { t: "That I'm not behind. I'm just building at my own pace, and it's about to pay off.", a: "latebloomer" },
        { t: "That I already have the answer. I just don't say it as loud as I should.", a: "sage" },
        { t: "That what looks calm on the outside took real pressure to get here.", a: "pearl" }
      ]
    },
    {
      q: "What does a genuinely good day actually look like for you?",
      options: [
        { t: "Everyone I love had a good day, mostly because of something I did.", a: "firestarter" },
        { t: "Same as any other day. I just keep growing, quietly, wherever I've landed.", a: "wildflower" },
        { t: "Nobody needed me to hold anything together, for once.", a: "anchor" }
      ]
    },
    {
      q: "How would you describe your pace right now?",
      options: [
        { t: "Slow-burning. Building toward something I haven't said out loud yet.", a: "ember" },
        { t: "Exactly as fast as I choose. I'm not running anyone else's race.", a: "mademoiselle" },
        { t: "Fast. Too fast, maybe. I just need to point it somewhere.", a: "livewire" }
      ]
    }
  ];

  var box = document.getElementById(containerId);
  if (!box) return;

  var current = 0;
  var tally = {};
  var emailCaptured = false;
  var cachedWinner = null;

  // Picking randomly among tied archetypes only makes sense once, right after
  // the last question — re-running it later (email gate vs. result screen)
  // could otherwise hand back a different archetype than the one just emailed.
  function getWinner() {
    if (cachedWinner) return cachedWinner;
    var best = -1;
    PRIORITY.forEach(function (key) {
      var score = tally[key] || 0;
      if (score > best) best = score;
    });
    var tied = PRIORITY.filter(function (key) { return (tally[key] || 0) === best; });
    var winnerKey = tied[Math.floor(Math.random() * tied.length)];
    cachedWinner = ARCHETYPES[winnerKey];
    return cachedWinner;
  }

  function render() {
    if (current < QUESTIONS.length) {
      renderQuestion();
    } else if (!emailCaptured) {
      renderEmailGate();
    } else {
      renderResult();
    }
  }

  function renderEmailGate() {
    var html = '<div class="quiz-progress">Almost there</div>';
    html += '<div class="quiz-question"><h2>Pop your email in to see your result</h2>';
    html += '<p class="lede" style="text-align:center; margin-bottom:1.5rem;">You\'ll get your Future Maker type straight away, plus the odd note from the newsletter.</p>';
    html += '<form class="quiz-email-gate-form" style="display:flex; flex-direction:column; gap:0.75rem; align-items:center;">';
    html += '<input type="email" placeholder="you@email.com" required style="width:100%; max-width:320px; font-family:\'Inter\',sans-serif; padding:0.8rem 1rem; border:1px solid var(--blush-deep);" />';
    html += '<button type="submit" class="btn">See my result</button>';
    html += '</form></div>';
    box.innerHTML = html;

    box.querySelector(".quiz-email-gate-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var thisForm = this;
      var emailValue = thisForm.querySelector('input[type="email"]').value;
      var submitBtn = thisForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "Just a sec…";

      var result = getWinner();
      fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue, archetype: result.name, source: source })
      })
        .then(function (r) { return r.json(); })
        .then(function () {
          emailCaptured = true;
          render();
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = "See my result";
          var em=document.createElement("p");em.className="form-error";em.setAttribute("role","alert");em.textContent="That didn't send. Check your email address and try again.";if(!thisForm.querySelector(".form-error"))thisForm.appendChild(em);
        });
    });
  }

  function renderQuestion() {
    var item = QUESTIONS[current];
    var html = '<div class="quiz-progress">Question ' + (current + 1) + ' of ' + QUESTIONS.length + '</div>';
    html += '<div class="quiz-question"><h2>' + item.q + '</h2><div class="quiz-options">';
    item.options.forEach(function (opt) {
      html += '<button type="button" class="quiz-option" data-archetype="' + opt.a + '">' + opt.t + '</button>';
    });
    html += '</div></div>';
    box.innerHTML = html;

    var buttons = box.querySelectorAll(".quiz-option");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var a = btn.getAttribute("data-archetype");
        tally[a] = (tally[a] || 0) + 1;
        current++;
        render();
      });
    });
  }

  function renderResult() {
    var result = getWinner();

    var html = '<div class="quiz-result">';
    html += '<div class="quiz-progress">Your result</div>';
    html += '<div class="archetype-name">' + result.name + '</div>';
    html += '<p class="archetype-desc">' + result.desc + '</p>';
    html += '<p class="archetype-cta">' + result.cta + '</p>';
    html += '<div class="archetype-prompt">';
    html += '<div class="archetype-prompt-label">Your first prompt. Copy it into Claude or ChatGPT.</div>';
    html += '<p class="archetype-prompt-text">' + result.prompt + '</p>';
    html += '<button type="button" class="archetype-prompt-copy">Copy prompt</button>';
    html += '</div>';
    html += '<a href="/circle.html" class="btn">Join The Circle</a>';
    html += '<p style="margin-top:1.25rem; font-size:0.85rem; color:var(--soft-ink);">You\'re on the newsletter too.</p>';
    html += '<a href="#" class="quiz-retake">Retake the quiz</a>';
    html += '</div>';
    box.innerHTML = html;

    var copyBtn = box.querySelector(".archetype-prompt-copy");
    copyBtn.addEventListener("click", function () {
      var promptEl = box.querySelector(".archetype-prompt-text");
      var done = function () {
        copyBtn.textContent = "Copied";
        setTimeout(function () { copyBtn.textContent = "Copy prompt"; }, 1800);
      };
      var fallback = function () {
        try {
          var range = document.createRange();
          range.selectNodeContents(promptEl);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand("copy");
          sel.removeAllRanges();
          done();
        } catch (err) {
          copyBtn.textContent = "Select and copy";
        }
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(promptEl.textContent).then(done, fallback);
        } else {
          fallback();
        }
      } catch (err) {
        fallback();
      }
    });

    box.querySelector(".quiz-retake").addEventListener("click", function (e) {
      e.preventDefault();
      current = 0;
      tally = {};
      emailCaptured = false;
      cachedWinner = null;
      render();
    });
  }

  render();
}
