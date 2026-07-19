function initFutureMakerQuiz(containerId, source) {
  var ARCHETYPES = {
    wildflower: {
      name: "The Wildflower",
      desc: "You grew in ground nobody would've chosen for you, and did it anyway. You're still growing quietly, whether anyone's watching or not.",
      cta: "Now root down and keep growing on purpose."
    },
    ember: {
      name: "The Ember",
      desc: "You're not loud about it, never have been. Real heat's banked down underneath, waiting for the moment you decide to move.",
      cta: "Now stop banking it down. Let it move."
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
      desc: "You're not behind, you never were. You've built on your own timeline while everyone else made noise about theirs, and you're about to catch up fast.",
      cta: "Now catch up fast, on your own terms."
    },
    firestarter: {
      name: "The Firestarter",
      desc: "You get everyone else moving, every time, and you're always last on your own list.",
      cta: "Now put yourself on your own list."
    },
    sage: {
      name: "The Sage",
      desc: "You already know more than you give yourself credit for. People come to you for the answer because you usually already have it.",
      cta: "Now trust the answer you already have."
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
    }
  ];

  var box = document.getElementById(containerId);
  if (!box) return;

  var current = 0;
  var tally = {};
  var emailCaptured = false;

  function getWinner() {
    var winner = PRIORITY[0];
    var best = -1;
    PRIORITY.forEach(function (key) {
      var score = tally[key] || 0;
      if (score > best) { best = score; winner = key; }
    });
    return ARCHETYPES[winner];
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
    html += '<div class="quiz-question"><h3>Pop your email in to see your result</h3>';
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
          alert("That didn't send. Mind trying again?");
        });
    });
  }

  function renderQuestion() {
    var item = QUESTIONS[current];
    var html = '<div class="quiz-progress">Question ' + (current + 1) + ' of ' + QUESTIONS.length + '</div>';
    html += '<div class="quiz-question"><h3>' + item.q + '</h3><div class="quiz-options">';
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
    html += '<a href="/circle.html" class="btn">Join The Circle</a>';
    html += '<p class="guarantee" style="margin-top:1rem;">Post a Monday commitment for a full month and show up to the live. If you don\'t feel more able to act than day one, that month\'s refunded.</p>';
    html += '<p style="margin-top:1.5rem; font-size:0.85rem; color:var(--soft-ink);">You\'re on the newsletter too — watch your inbox.</p>';
    html += '<a href="#" class="quiz-retake">Retake the quiz</a>';
    html += '</div>';
    box.innerHTML = html;

    box.querySelector(".quiz-retake").addEventListener("click", function (e) {
      e.preventDefault();
      current = 0;
      tally = {};
      emailCaptured = false;
      render();
    });
  }

  render();
}
