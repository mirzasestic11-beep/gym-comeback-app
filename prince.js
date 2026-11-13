// prince.js — extras for the "Prince" look (Vegeta style).
// Only used when the Prince look is picked; the Saiyan and Classic looks
// don't call anything in here. Nothing here changes your logs.
//
// - Rank panel ("Current form") with a 7-step ladder and an aura whose
//   colour follows your rank, from Base white up to Ultra Ego purple.
// - "Rival beaten" badges: your rival is the you of last time. A ticked set
//   beats it with more kg, or the same kg and more reps, than the same set
//   last time.
// - Pride lines on the workout report.
// All lines of text here are original, written for this app.

var RANK_COLORS = ["#e8ecff", "#f5c542", "#ffd84a", "#ffb627", "#ff4d5e", "#38c8ff", "#a35bff"];

var PQ = [
  "Yesterday’s numbers are just a rival waiting to fall.",
  "A prince trains when no one is watching.",
  "Pride is earned one clean rep at a time.",
  "Rest is strategy, not weakness.",
  "Bow to no one. Not even last week’s you.",
  "Every set is a step closer to the throne.",
];

function rankIndex() {
  return Math.min(RANKS.length - 1, Math.floor(sess() / 2));
}

// Your most recent earlier week with ticked sets for this exercise (same day).
function lastTime(id) {
  for (var w = W - 1; w >= 0; w--) {
    var a = setsOf(w, D, id);
    if (a.length) return { w: w, sets: a };
  }
  return null;
}

// Did this set beat the same set last time? Returns a short text or "".
// si = which set (0 = first). If last time had fewer sets, compares with
// last time's best set.
function rivalText(id, si, v) {
  if (!v || !v.d) return "";
  var kg = parseFloat(v.kg),
    r = parseFloat(v.r);
  if (isNaN(kg) || isNaN(r)) return "";
  var lt = lastTime(id);
  if (!lt) return "";
  var ref =
    lt.sets[si] ||
    lt.sets.reduce(function (a, b) {
      var ak = parseFloat(a.kg) || 0,
        bk = parseFloat(b.kg) || 0;
      return bk > ak || (bk == ak && (parseFloat(b.r) || 0) > (parseFloat(a.r) || 0)) ? b : a;
    });
  var lk = parseFloat(ref.kg) || 0,
    lr = parseFloat(ref.r) || 0;
  var who = lt.w == W - 1 ? "last week’s you." : "week " + (lt.w + 1) + "’s you.";
  if (kg > lk) return "+" + Math.round((kg - lk) * 10) / 10 + " kg on " + who;
  if (kg == lk && r > lr) {
    var n = Math.round(r - lr);
    return "+" + n + " rep" + (n == 1 ? "" : "s") + " on " + who;
  }
  return "";
}

var RIVS = {}; // badges already shown, so only new ones get the pulse
function rivalBadge(row, id, si, v) {
  var t = rivalText(id, si, v);
  if (!t) return;
  var key = W + "-" + D + "-" + id + "-" + si;
  var b = document.createElement("div");
  b.className = "rival" + (!first && !RIVS[key] ? " pop2" : "");
  RIVS[key] = 1;
  b.innerHTML = "<b>RIVAL BEATEN</b> ";
  b.appendChild(document.createTextNode(t));
  row.appendChild(b);
}

function prideBlock(rivals) {
  if (!rivals.length)
    return "<div class='pride'><b>NO RIVAL FELL TODAY</b>Every prince has days like this. Next time, you take them down.</div>";
  var names =
    rivals.length == 1
      ? rivals[0]
      : rivals.slice(0, -1).join(", ") + " and " + rivals[rivals.length - 1];
  return (
    "<div class='pride'><b>RIVALS DEFEATED: " +
    rivals.length +
    "</b>" +
    esc(names) +
    (rivals.length == 1 ? " beat" : " all beat") +
    " your last numbers. A prince doesn’t stay level.</div>"
  );
}

// Hero: quote, aura colour and the "Current form" rank panel.
function princeHero() {
  var ri = rankIndex(),
    c = RANK_COLORS[ri];
  document.body.style.setProperty("--aura", c);
  document.body.classList.toggle("sparks", ri == 2 || ri == 3);
  var vq = document.getElementById("vq");
  if (vq) vq.textContent = "“" + PQ[(W * 3 + D) % PQ.length].replace(/\.$/, ".") + "”";
  var h = document.getElementById("rankhud");
  if (!h) return;
  var ladder = "";
  for (var i = 0; i < RANKS.length; i++)
    ladder += "<i" + (i <= ri ? " class='on' style='--c:" + RANK_COLORS[i] + "'" : "") + "></i>";
  var next =
    ri < RANKS.length - 1
      ? "Next: " + RANKS[ri + 1] + " at " + (ri + 1) * 2 + " sessions"
      : "Highest form reached";
  h.innerHTML =
    "<div class='lens'></div><div class='rf'><div class='l'>Current form</div><div class='v'>" +
    RANKS[ri] +
    "</div><div class='ladder' aria-hidden='true'>" +
    ladder +
    "</div><div class='nx'>" +
    next +
    "</div></div><div class='p'><div class='l'>Sessions</div><b>" +
    sess() +
    "</b></div>";
  var gw = document.getElementById("gw");
  if (gw) gw.textContent = W + 1;
}
