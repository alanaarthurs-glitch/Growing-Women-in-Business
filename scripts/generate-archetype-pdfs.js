const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const OUT_DIR = path.join(__dirname, "..", "assets", "pdfs");
fs.mkdirSync(OUT_DIR, { recursive: true });

const PINK = "#ad1457";
const INK = "#241a22";
const SOFT_INK = "#6e5d6b";
const MINT = "#5f9f7d";

const ARCHETYPES = [
  {
    key: "wildflower",
    emoji: "🌾",
    name: "The Wildflower",
    who: "She grew in ground nobody would've chosen for her, and did it anyway. Not the tidy row, not the greenhouse, just whatever soil she landed in. She's still growing quietly, whether anyone's watching or not, and she's never once needed an audience to keep going.",
    pain: [
      "She's built real resilience but doesn't count it as a skill, just as “getting on with it.”",
      "Quietly compares her own tangled, hard-won growth to women who look like they had it easier.",
      "Worries that if she stands out, she'll get uprooted again, so she stays small on purpose.",
      "Rarely gets told she's impressive, because nobody saw the ground she actually grew in.",
    ],
    tips: [
      "Write down, in plain words, the actual conditions you grew in. Read it back like it belongs to someone else. That's the skill you keep discounting.",
      "Practice being seen in small doses: one post, one comment, one moment a week where you let something show instead of growing quietly in the corner.",
      "Find one person and deliberately let them watch you grow, on purpose. Not everyone. Just one.",
      "Stop measuring your soil against someone else's. Nobody else grew where you grew.",
    ],
  },
  {
    key: "ember",
    emoji: "🔥",
    name: "The Ember",
    who: "She's not loud about it, never has been. Real heat's banked down underneath, waiting for the moment she decides to move. People who don't know her well assume there's not much going on. They're wrong.",
    pain: [
      "Gets mistaken for uninterested or passive, when really she's holding real intensity back on purpose.",
      "Keeps waiting for the “right moment” to let the heat out, and the right moment keeps not arriving.",
      "Worried that if she actually showed what's underneath, it would be too much for the room.",
      "Quietly resents being underestimated, but rarely says so out loud.",
    ],
    tips: [
      "Let a small amount of heat out on purpose, every week. One direct sentence. One decisive email. You don't need the whole bonfire yet.",
      "Tell one person, plainly: “there's more in me than you think.” Just see how it feels to say it.",
      "Set an actual date for the thing you're banking down for. “Someday” doesn't hold heat, a deadline does.",
      "Notice the exact moment you bank it back down, and name it out loud when it happens.",
    ],
  },
  {
    key: "pearl",
    emoji: "🦪",
    name: "The Pearl",
    who: "Whatever she's been carrying has been under pressure a long time, and it's turned into something worth showing. She's just been keeping it inside the shell, because that's where it's always felt safest.",
    pain: [
      "Carries something real, grief, responsibility, a hard past, and rarely gets credit for what it took to hold it.",
      "Worries that showing it will look like complaining, or oversharing, so she keeps it shut.",
      "The shell has quietly become an identity of its own, safer than being open, even when it's not needed anymore.",
      "Assumes nobody wants to hear it, so she never finds out that they do.",
    ],
    tips: [
      "Write the pressure story down once, just for you, before you ever think about sharing it with anyone else.",
      "Pick one person you trust completely, and open the shell for them first. Not the whole room. One person.",
      "Reframe it: it's not “what I survived,” it's “what I now actually know how to do.”",
      "The shell can stay. You get to crack it open on your own terms, in your own time, not all at once.",
    ],
  },
  {
    key: "mademoiselle",
    emoji: "🎀",
    name: "Mademoiselle",
    who: "She's got standards, and she's not sorry for them. She's not waiting because she's scared, she's waiting for the right room, and she gets to decide when that room's ready. Nobody else gets a vote.",
    pain: [
      "Gets labelled “too picky” or precious for having standards other people wouldn't bother holding.",
      "The wait can quietly tip into perfectionism, procrastination wearing a nicer outfit.",
      "Fears that no room will ever feel entirely “ready enough,” so she keeps waiting past the point it was actually time.",
      "Rarely tells anyone what “ready” would actually look like, so nobody can help her get there.",
    ],
    tips: [
      "Set a real deadline for “ready,” a date, not a feeling. Feelings can wait forever, dates can't.",
      "Separate “I have high standards” from “I'm avoiding the risk of being seen actually trying.” They're not the same thing.",
      "Pick the smallest room available to you right now, and treat it as practice, not the final stage.",
      "Write down exactly what “ready” looks like in specifics. Not a vibe. An actual list.",
    ],
  },
  {
    key: "latebloomer",
    emoji: "🌅",
    name: "The Late Bloomer",
    who: "She's not behind, she never was. She's built on her own timeline while everyone else made noise about theirs, and she's about to catch up fast, on terms that are actually hers.",
    pain: [
      "Compares her timeline to peers who “made it” earlier, and quietly absorbs shame about the gap.",
      "Carries the 2am whisper: is it too late to start now?",
      "Assumes the years she spent building elsewhere don't count, because they don't look like a straight line on a CV.",
      "Worries that catching up means rushing, rather than just moving at her own real pace.",
    ],
    tips: [
      "Write an actual timeline of what you were doing in the years you think of as “behind.” It's rarely nothing.",
      "Ask someone further along how long it actually took them. It's almost always longer than it looked from the outside.",
      "Set 90-day sprints for yourself instead of comparing to someone else's decade.",
      "Remind yourself plainly: catching up fast is still a real speed. It's not a myth you're telling yourself.",
    ],
  },
  {
    key: "firestarter",
    emoji: "🔥",
    name: "The Firestarter",
    who: "She gets everyone else moving, every single time, and she's always last on her own list. If there's a fire that needs lighting for somebody else, she's already there with the match.",
    pain: [
      "Burns out quietly from constantly being the one who starts things for everyone but herself.",
      "Feels guilty the moment she tries to put her own priority first, like she's stealing time that belongs to someone else.",
      "The people around her can resist when she finally stops lighting fires for them, which makes stopping feel even harder.",
      "Nobody's ever really asked her what she'd start, if it were just for her.",
    ],
    tips: [
      "Put your own name on the list. Literally, in writing, this week. Not at the bottom. Somewhere near the top.",
      "Block one hour that's non-negotiable, and treat it exactly like you'd treat someone else's emergency.",
      "Notice the guilt spike the moment you say no to someone else's fire. Say no anyway, once, and see what actually happens.",
      "Find a fear buddy whose whole job is to start fires for you, for once.",
    ],
  },
  {
    key: "sage",
    emoji: "🧠",
    name: "The Sage",
    who: "She already knows more than she gives herself credit for. People come to her for the answer because she usually already has it, whether or not she believes that herself yet.",
    pain: [
      "Carries real self-doubt despite being right more often than she admits.",
      "Feels like an imposter when people seek her out, as if she's about to be caught not actually knowing.",
      "Hesitates to act on her own knowledge the exact same way she'd confidently tell a friend to.",
      "Hedges out loud, softening things she's actually sure about, so nobody notices how sure she is.",
    ],
    tips: [
      "Before Googling it or asking someone else, write down what you already think is true. Check it against the answer after.",
      "Keep a running “called it” list, every time your gut turned out to be right. Read it back when you doubt yourself.",
      "Take your own advice once this week. The exact advice you'd give a friend in your situation.",
      "Stop hedging out loud on the things you already know. Just say the sentence straight.",
    ],
  },
  {
    key: "livewire",
    emoji: "⚡",
    name: "The Live Wire",
    who: "Ten ideas before breakfast and the energy to match. She just needs one push to actually start, because the ideas were never the problem, finishing one of them is.",
    pain: [
      "Energy goes in ten directions and very little gets finished, which quietly wears down her own confidence.",
      "Gets read by others as flaky or scattered, when really she's just overflowing with more than one outlet can hold.",
      "Feels overwhelmed by her own ideas rather than excited by them, once there are too many at once.",
      "Chases the next shiny idea the moment the current one gets hard, and never notices the pattern.",
    ],
    tips: [
      "Pick one idea and give it a real, slightly boring deadline before you let yourself think about the next one.",
      "Write new ideas down to park them, don't chase them the second they arrive. They'll still be there later.",
      "Find a fear buddy whose job is to hold you to finishing, not to starting. You don't need help starting.",
      "Aim for the first ugly version of the thing, not the polished one. Finished and rough beats perfect and unstarted.",
    ],
  },
  {
    key: "anchor",
    emoji: "⚓",
    name: "The Anchor",
    who: "Everyone leans on her, and she's built a life around holding it together. She needs to learn she's allowed to lean on someone too, even though nobody's ever really shown her how.",
    pain: [
      "Her identity has quietly become “the one who's needed,” which makes it terrifying to imagine being anything else.",
      "Fears she'd be a burden if she ever actually asked for help, so she simply doesn't ask.",
      "One-way support builds a quiet resentment she rarely admits to, even to herself.",
      "Doesn't actually know how to receive help gracefully, because she's never had the practice.",
    ],
    tips: [
      "Practice saying “actually, I need help with this” out loud, to one person, once this week.",
      "Notice the discomfort the moment someone helps you, and let it happen anyway instead of deflecting it.",
      "Find a fear buddy whose actual job is to check in on you, not the other way around.",
      "Write down what you'd tell a friend who never let anyone help her. Then take your own advice.",
    ],
  },
];

function drawList(doc, items, x, width) {
  items.forEach((item) => {
    const y = doc.y;
    doc.fillColor(PINK).font("Helvetica-Bold").fontSize(11).text("•", x, y, { continued: false });
    doc.fillColor(SOFT_INK).font("Helvetica").fontSize(11).text(item, x + 14, y, { width: width - 14 });
    doc.moveDown(0.4);
  });
}

ARCHETYPES.forEach((a) => {
  const doc = new PDFDocument({ size: "A4", margins: { top: 60, bottom: 60, left: 60, right: 60 } });
  const outPath = path.join(OUT_DIR, `${a.key}.pdf`);
  doc.pipe(fs.createWriteStream(outPath));

  const contentWidth = doc.page.width - 120;

  // Header
  doc.fillColor(PINK).font("Helvetica-Bold").fontSize(10)
    .text("GROWING WOMEN IN BUSINESS", 60, 60, { characterSpacing: 1 });
  doc.moveDown(1.5);

  // Archetype name
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(30)
    .text(a.name, { width: contentWidth });
  doc.moveDown(0.3);
  doc.fillColor(SOFT_INK).font("Helvetica").fontSize(12)
    .text("Your Future Maker type", { width: contentWidth });
  doc.moveDown(1.2);

  // Who she is
  doc.fillColor(PINK).font("Helvetica-Bold").fontSize(13).text("WHO YOU ARE");
  doc.moveDown(0.4);
  doc.fillColor(INK).font("Helvetica").fontSize(12).text(a.who, { width: contentWidth, lineGap: 3 });
  doc.moveDown(1.2);

  // Pain points
  doc.fillColor(PINK).font("Helvetica-Bold").fontSize(13).text("YOUR PAIN POINTS");
  doc.moveDown(0.5);
  drawList(doc, a.pain, 60, contentWidth);
  doc.moveDown(0.8);

  // Tips
  doc.fillColor(PINK).font("Helvetica-Bold").fontSize(13).text("TIPS AND TRICKS FOR YOU");
  doc.moveDown(0.5);
  drawList(doc, a.tips, 60, contentWidth);

  // Footer (flows naturally after the content instead of a forced absolute
  // position, which was pushing a blank page 2 once content ran long)
  doc.moveDown(2);
  doc.fillColor(MINT).font("Helvetica-Bold").fontSize(10)
    .text("growingwomeninbusiness.com", 60, doc.y, { width: contentWidth, align: "center" });
  doc.fillColor(SOFT_INK).font("Helvetica").fontSize(9)
    .text("@growingwomeninbusiness", { width: contentWidth, align: "center" });

  doc.end();
});

console.log(`Generated ${ARCHETYPES.length} PDFs in ${OUT_DIR}`);
