// progress.js — the Progress page: charts of each exercise over weeks 1–4.
// It only READS your logs (through setsOf() in app.js); it never changes them.
// Charts are drawn by hand as SVG, so no internet or outside library is needed.

var VIEW = "w"; // "w" = Workout page, "p" = Progress page
try {
  var sv0 = localStorage.getItem("gcView");
  if (sv0 == "p" || sv0 == "b" || sv0 == "e" || sv0 == "y") VIEW = sv0;
} catch (e) {}
var PD = null; // which day the Progress page shows (starts at the workout day)

function setView(v) {
  VIEW = v;
  try {
    localStorage.setItem("gcView", v);
  } catch (e) {}
  showView();
  window.scrollTo(0, 0);
}

function showView() {
  document.getElementById("workoutView").hidden = VIEW != "w";
  document.getElementById("progressView").hidden = VIEW != "p";
  document.getElementById("editorView").hidden = VIEW != "e";
  document.getElementById("bodyView").hidden = VIEW != "b";
  document.getElementById("youView").hidden = VIEW != "y";
  var vs = document.getElementById("views");
  vs.innerHTML = "";
  [
    ["w", "Workout"],
    ["p", "Progress"],
    ["b", "Body"],
    ["e", "Edit plan"],
    ["y", "You"],
  ].forEach(function (o) {
    var b = document.createElement("button");
    b.className = "pill" + (VIEW == o[0] ? " on" : "");
    b.textContent = o[1];
    b.onclick = function () {
      setView(o[0]);
    };
    vs.appendChild(b);
  });
  if (VIEW == "p") progress();
  if (VIEW == "e" && window.editor) editor();
  if (VIEW == "b" && window.bodyPage) bodyPage();
  if (VIEW == "y" && window.youPage) youPage();
}

// Numbers for one exercise, one entry per week (null = nothing ticked that week).
//   top  = heaviest weight of the week's ticked sets
//   reps = all reps of the week added up
//   min  = minutes added up (for timed exercises like the stepper)
function weekStats(d, e) {
  var out = [];
  for (var w = 0; w < 4; w++) {
    var a = setsOf(w, d, e.id);
    if (!a.length) {
      out.push(null);
      continue;
    }
    var top = 0,
      reps = 0,
      min = 0;
    a.forEach(function (v) {
      var kg = parseFloat(v.kg) || 0;
      if (kg > top) top = kg;
      min += kg;
      reps += parseFloat(v.r) || 0;
    });
    out.push({ sets: a, top: top, reps: reps, min: min });
  }
  return out;
}

function niceStep(x) {
  var p = Math.pow(10, Math.floor(Math.log10(x))),
    f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
function num(v) {
  return Math.round(v * 10) / 10 + "";
}

var SVGNS = "http://www.w3.org/2000/svg";
function sv(tag, attrs, parent) {
  var el = document.createElementNS(SVGNS, tag);
  for (var a in attrs) el.setAttribute(a, attrs[a]);
  if (parent) parent.appendChild(el);
  return el;
}

// One small line chart. vals = 4 numbers or nulls (weeks 1–4).
// Room (px) needed for a chart label of n characters at 0.875rem, measured
// from the phone's real text size, so labels never spill outside the chart.
function remPx() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}
function labelRoom(n) {
  return Math.ceil(remPx() * 0.875 * 0.62 * n) + 12;
}
function lineChart(title, vals, unit, width) {
  var fig = document.createElement("figure");
  fig.className = "chart";
  var cap = document.createElement("figcaption");
  cap.textContent = title;
  fig.appendChild(cap);

  var Wd = Math.max(200, Math.round(width)),
    Ht = Math.round(remPx() * 9),
    L = 30,
    R = 30,
    T = Math.round(remPx() * 0.875 * 0.75) + 3,
    B = Math.round(remPx() * 0.875 + 14);
  var pts = [];
  vals.forEach(function (v, i) {
    if (v != null) pts.push({ i: i, v: v });
  });
  var lo = Math.min.apply(
      null,
      pts.map(function (p) {
        return p.v;
      }),
    ),
    hi = Math.max.apply(
      null,
      pts.map(function (p) {
        return p.v;
      }),
    );
  // Rounded axis numbers, about 2–3 steps, never below 0.
  var step = niceStep(Math.max(hi - lo, Math.max(1, hi * 0.2)) / 2);
  var y0 = Math.max(0, Math.floor(lo / step) * step),
    y1 = Math.ceil(hi / step) * step;
  if (y1 <= y0) y1 = y0 + step;
  // Margins sized to the longest axis number (left) and the value written
  // next to the last point (right), so no label spills outside the chart.
  var tickChars = 1;
  for (var tt = y0; tt <= y1 + 1e-9; tt += step) tickChars = Math.max(tickChars, num(tt).length);
  L = labelRoom(tickChars);
  R = labelRoom(num(pts[pts.length - 1].v).length) + 6;
  var X = function (i) {
      return L + (i * (Wd - L - R)) / 3;
    },
    Y = function (v) {
      return T + ((y1 - v) / (y1 - y0)) * (Ht - T - B);
    };

  var svg = sv("svg", {
    width: Wd,
    height: Ht,
    viewBox: "0 0 " + Wd + " " + Ht,
    role: "img",
    "aria-label":
      title +
      ": " +
      vals
        .map(function (v, i) {
          return "week " + (i + 1) + " " + (v == null ? "no data" : num(v) + " " + unit);
        })
        .join(", "),
  });
  // Gridlines + axis numbers
  for (var t = y0; t <= y1 + 1e-9; t += step) {
    sv("line", { x1: L, x2: Wd - R + 6, y1: Y(t), y2: Y(t), class: "grid" }, svg);
    sv(
      "text",
      { x: L - 6, y: Y(t), "text-anchor": "end", "dominant-baseline": "middle", class: "tick" },
      svg,
    ).textContent = num(t);
  }
  for (var i = 0; i < 4; i++)
    sv("text", { x: X(i), y: Ht - 5, "text-anchor": "middle", class: "tick" }, svg).textContent =
      "W" + (i + 1);
  // Line, only between weeks that follow each other (a missing week leaves a gap)
  for (var k = 1; k < pts.length; k++)
    if (pts[k].i == pts[k - 1].i + 1)
      sv(
        "line",
        { x1: X(pts[k - 1].i), y1: Y(pts[k - 1].v), x2: X(pts[k].i), y2: Y(pts[k].v), class: "ln" },
        svg,
      );
  var dots = {};
  pts.forEach(function (p) {
    dots[p.i] = sv("circle", { cx: X(p.i), cy: Y(p.v), r: 4, class: "dot" }, svg);
  });
  // Value next to the latest point
  var last = pts[pts.length - 1];
  sv(
    "text",
    { x: X(last.i) + 8, y: Y(last.v), "dominant-baseline": "middle", class: "endv" },
    svg,
  ).textContent = num(last.v);

  // Tap / hover / keyboard: show the exact number. The tap area is the whole
  // column for that week, so it's easy to hit with a finger.
  var tip = document.createElement("div");
  tip.className = "tip";
  tip.hidden = true;
  function show(p) {
    tip.textContent = "Week " + (p.i + 1) + " · " + num(p.v) + " " + unit;
    tip.style.left = X(p.i) + "px";
    tip.style.top = Y(p.v) + 14 + "px";
    tip.hidden = false;
    for (var j in dots) dots[j].setAttribute("r", j == p.i ? 6 : 4);
  }
  function hide() {
    tip.hidden = true;
    for (var j in dots) dots[j].setAttribute("r", 4);
  }
  var colW = (Wd - L - R) / 3;
  pts.forEach(function (p) {
    var hit = sv(
      "rect",
      {
        x: X(p.i) - colW / 2,
        y: 0,
        width: colW,
        height: Ht - B,
        class: "hit",
        tabindex: 0,
        "aria-label": "Week " + (p.i + 1) + ": " + num(p.v) + " " + unit,
      },
      svg,
    );
    hit.addEventListener("pointerenter", function () {
      show(p);
    });
    hit.addEventListener("click", function () {
      show(p);
    });
    hit.addEventListener("focus", function () {
      show(p);
    });
    hit.addEventListener("pointerleave", hide);
    hit.addEventListener("blur", hide);
  });
  fig.appendChild(svg);
  fig.appendChild(tip);
  return fig;
}

// One-line summary, e.g. "Heaviest: 50 kg (week 3) · +10 kg since week 1"
// Plain-language line above a chart, e.g.
// "Leg Press: 60 → 65 kg since week 1 (+5 kg)".
function plainLine(name, stats, key, unit) {
  var have = [];
  stats.forEach(function (s, i) {
    if (s) have.push({ i: i, v: s[key] });
  });
  var f = have[0],
    l = have[have.length - 1];
  if (have.length == 1)
    return (
      name + ": " + num(f.v) + " " + unit + " in week " + (f.i + 1) + ", your first logged week."
    );
  var d = l.v - f.v;
  return (
    name +
    ": " +
    num(f.v) +
    " → " +
    num(l.v) +
    " " +
    unit +
    " since week " +
    (f.i + 1) +
    " (" +
    (d > 0 ? "+" + num(d) + " " + unit : d < 0 ? "−" + num(-d) + " " + unit : "no change") +
    ")"
  );
}
// Best single set across all weeks: heaviest, then most reps.
function bestSet(stats, unit) {
  var best = null,
    wk = 0;
  stats.forEach(function (s, i) {
    if (!s) return;
    s.sets.forEach(function (v) {
      var kg = parseFloat(v.kg) || 0,
        r = parseFloat(v.r) || 0;
      if (!best || kg > best.kg || (kg == best.kg && r > best.r)) {
        best = { kg: kg, r: r };
        wk = i + 1;
      }
    });
  });
  if (!best) return "";
  if (unit == "min") return "Best: " + num(best.kg) + " min (week " + wk + ")";
  if (unit == "sec") return "Best hold: " + num(best.kg) + " s (week " + wk + ")";
  if (best.kg == 0) return "Best set: " + num(best.r) + " reps, bodyweight (week " + wk + ")";
  return "Best set: " + num(best.kg) + " kg × " + num(best.r) + " (week " + wk + ")";
}

function progress() {
  if (PD == null) PD = D;
  var pd = document.getElementById("pdays");
  pd.innerHTML = "";
  DAYS.forEach(function (d, i) {
    var b = document.createElement("button");
    b.className = "pill" + (i == PD ? " on" : "");
    b.innerHTML =
      "<b>" + d.n + "</b><br><span style='font-size:12px'>" + d.t.split(" (")[0] + "</span>";
    b.onclick = function () {
      PD = i;
      progress();
    };
    pd.appendChild(b);
  });
  var L = document.getElementById("plist");
  L.innerHTML = "";
  // Exercises in the plan first, then removed ones that still have history.
  var active = DAYS[PD].ex.filter(function (e) {
    return !e.removed;
  });
  var removed = DAYS[PD].ex.filter(function (e) {
    return e.removed;
  });
  active.concat(removed).forEach(function (e, n) {
    if (n == active.length)
      L.insertAdjacentHTML(
        "beforeend",
        "<h3 class='psec'>Removed exercises</h3><p class='small'>No longer in your plan. Their history is kept here.</p>",
      );
    var c = document.createElement("div");
    c.className = "card";
    c.innerHTML =
      "<span class='tag'>" + esc(e.muscle || "") + "</span><h3>" + esc(e.name) + "</h3>";
    L.appendChild(c);
    var stats = weekStats(PD, e);
    if (!stats.some(Boolean)) {
      c.insertAdjacentHTML(
        "beforeend",
        "<p>No ticked sets yet. Your chart appears after your first workout with this exercise.</p>",
      );
      return;
    }
    var bs = bestSet(stats, e.unit);
    if (bs) {
      var bp = document.createElement("p");
      bp.className = "pbest";
      bp.textContent = bs;
      c.appendChild(bp);
    }
    var grid = document.createElement("div");
    grid.className = "charts";
    c.appendChild(grid);
    var full = grid.clientWidth || 300; // charts stack, each full width
    var pick = function (k) {
      return stats.map(function (s) {
        return s ? s[k] : null;
      });
    };
    // One block per chart: short heading (the chart's caption), a plain
    // summary sentence, then the chart.
    function block(title, key, unit) {
      var d = document.createElement("div");
      d.className = "pblock";
      var fig = lineChart(title, pick(key), unit, full);
      var p = document.createElement("p");
      p.className = "psum";
      p.textContent = plainLine(e.name, stats, key, unit);
      fig.insertBefore(p, fig.firstChild.nextSibling);
      d.appendChild(fig);
      grid.appendChild(d);
    }
    if (e.unit == "min") block("Minutes", "min", "min");
    else if (e.unit == "sec") block("Hold time", "top", "s");
    else {
      var bodyweight = !stats.some(function (s) {
        return s && s.top > 0;
      });
      if (!bodyweight) block("Weight", "top", "kg");
      block("Reps (all sets)", "reps", "reps");
      if (bodyweight)
        c.insertAdjacentHTML(
          "beforeend",
          "<p class='small'>Bodyweight exercise, so only reps are charted.</p>",
        );
    }
    // Plain table with every ticked set
    var det = document.createElement("details");
    var rows = stats
      .map(function (s, i) {
        return (
          "<tr><th>Week " +
          (i + 1) +
          "</th><td>" +
          (s ? esc(fmtSets(s.sets, e.unit)) : "–") +
          "</td></tr>"
        );
      })
      .join("");
    det.innerHTML = "<summary>Show numbers</summary><table class='ptab'>" + rows + "</table>";
    c.appendChild(det);
  });
}

var _pw = window.innerWidth;
window.addEventListener("resize", function () {
  if (VIEW == "p" && Math.abs(window.innerWidth - _pw) > 30) {
    _pw = window.innerWidth;
    progress();
  }
});

showView();
