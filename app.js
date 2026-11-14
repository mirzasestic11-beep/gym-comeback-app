// app.js — everything the app does (screens, logging, report, themes).
// The workout plan itself lives in plan.js.
//
// Saved data (localStorage):
//   gc      all logs as one object. Set keys look like "week-day-exerciseId-setIndex"
//           e.g. "0-1-d2-chest-press-0" = week 1, Day 2, Chest Press, set 1 -> {kg, r, d}
//           plus per-day keys: warm, cool, ci (check-in), co (check-out),
//           wr (wrist), nt (notes), sk:<id> (skipped), xs:<id> (extra sets)
//           Older position-based keys ("0-1-0-0", "0-1-sk0") are kept as they
//           were and copied to the ID keys on load (see upgradeLogs below).
//   gcBeforeIds  one-time safety copy of gc from before the ID upgrade
//   gcW/gcD last opened week/day, gcEF elbow-friendly mode, gcTheme look

var st = {},
  W = 0,
  D = 0,
  FIN = {},
  first = true;
try {
  st = JSON.parse(localStorage.getItem("gc") || "{}");
} catch (e) {}

// ---- Nickname (optional) ----------------------------------------------------
// Kept only on this phone (localStorage "gcNick", max 20 characters) and
// added to backups as "nick", so it comes back when you restore.
var NICK = "";
try {
  NICK = (localStorage.getItem("gcNick") || "").slice(0, 20);
} catch (e) {}
function setNick(v) {
  NICK = String(v == null ? "" : v)
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 20);
  try {
    if (NICK) localStorage.setItem("gcNick", NICK);
    else localStorage.removeItem("gcNick");
  } catch (e) {}
}
// Backup text = a header line with nickname and date, then the data.
// Accepts that format AND old backups that are only the data.
function parseBackupText(t) {
  t = String(t == null ? "" : t).trim();
  try {
    return JSON.parse(t);
  } catch (e) {}
  var i = t.indexOf("{"),
    j = t.lastIndexOf("}");
  if (i > -1 && j > i) {
    try {
      return JSON.parse(t.slice(i, j + 1));
    } catch (e) {}
  }
  return null;
}

// ---- Upgrading old logs to exercise IDs -------------------------------------
// Old versions saved logs by exercise POSITION ("0-1-2-0" = week 1, Day 2,
// 3rd exercise, set 1). Now logs are saved by exercise ID
// ("0-1-d2-triceps-pushdown-0"), so reordering or editing the plan can't mix
// up your history.
// This list is the ORIGINAL order of the plan and must never be changed:
// it is how old position numbers are translated into IDs.
var LEGACY_IDS = [
  [
    "d1-leg-press",
    "d1-seated-leg-curl",
    "d1-leg-extension",
    "d1-stepper-or-bike",
    "d1-floor-crunch",
  ],
  [
    "d2-chest-press",
    "d2-shoulder-press",
    "d2-triceps-pushdown",
    "d2-db-lateral-raise",
    "d2-floor-crunch",
    "d2-lateral-raise-machine",
    "d2-butterfly",
  ],
  [
    "d3-lat-pulldown",
    "d3-seated-cable-row",
    "d3-lateral-raise-machine",
    "d3-hammer-curl",
    "d3-back-extension",
  ],
];
// Copies every old position-based entry to its ID-based twin.
// Safe by design: old entries are never deleted or changed, and an ID entry
// that already exists is never overwritten. Running it twice changes nothing.
// Returns how many entries were copied.
function upgradeLogs(o) {
  var n = 0;
  for (var key in o) {
    var m = key.match(/^(\d+)-(\d+)-(\d+)-(\d+)$/),
      nk = null;
    if (m) {
      var id = (LEGACY_IDS[m[2]] || [])[m[3]];
      if (id) nk = m[1] + "-" + m[2] + "-" + id + "-" + m[4];
    } else if ((m = key.match(/^(\d+)-(\d+)-(sk|xs)(\d+)$/))) {
      var id2 = (LEGACY_IDS[m[2]] || [])[m[4]];
      if (id2) nk = m[1] + "-" + m[2] + "-" + m[3] + ":" + id2;
    }
    if (nk && !(nk in o)) {
      o[nk] = JSON.parse(JSON.stringify(o[key]));
      n++;
    }
  }
  return n;
}
try {
  // One-time safety copy of your data exactly as it was before the upgrade.
  // It is never overwritten or deleted.
  if (localStorage.getItem("gc") && !localStorage.getItem("gcBeforeIds"))
    localStorage.setItem("gcBeforeIds", localStorage.getItem("gc"));
} catch (e) {}
if (upgradeLogs(st)) {
  try {
    localStorage.setItem("gc", JSON.stringify(st));
  } catch (e) {}
}

// ---- Your own plan (made in the Edit plan page, editor.js) -------------------
// plan.js holds the ORIGINAL plan. If you've edited it, your version is saved
// inside your logs as st.plan, so the Backup box includes it automatically.
// Day names always come from plan.js; only the exercise lists are yours.
var DEFAULT_DAYS = JSON.parse(JSON.stringify(DAYS));
function validEx(e) {
  return e && typeof e.id == "string" && typeof e.name == "string" && e.name;
}
function loadPlan() {
  var p = st.plan;
  DAYS = DEFAULT_DAYS.map(function (d, i) {
    var mine = p && p.days && p.days[i] && p.days[i].ex;
    var ex = Array.isArray(mine) && mine.every(validEx) ? mine : d.ex;
    return { n: d.n, t: d.t, ex: JSON.parse(JSON.stringify(ex)) };
  });
}
loadPlan();
try {
  W = Math.min(3, +localStorage.getItem("gcW") || 0);
  D = Math.min(2, +localStorage.getItem("gcD") || 0);
} catch (e) {}
function save() {
  try {
    localStorage.setItem("gc", JSON.stringify(st));
  } catch (e) {}
  // keep the backup status and monthly reminder up to date (backup.js)
  if (typeof bkNudge == "function") bkNudge();
}
function k(a) {
  return W + "-" + D + "-" + a;
}
function g(a) {
  return st[k(a)] || {};
}
function put(a, f, v) {
  var o = st[k(a)] || {};
  o[f] = v;
  st[k(a)] = o;
  save();
}
function mkTr(id, dt, di, ds) {
  var v = g(id),
    r = document.createElement("div");
  r.style.marginTop = "8px";
  var q = document.createElement("div");
  q.className = "row";
  [
    ["t", "Minutes", dt],
    ["i", "Incline %", di],
    ["sp", "Speed km/h", ds],
  ].forEach(function (f) {
    var cell = document.createElement("label");
    cell.className = "small";
    cell.style.cssText = "flex:1;text-align:center";
    cell.textContent = f[1];
    var x = document.createElement("input");
    x.type = "number";
    x.inputMode = "decimal";
    x.placeholder = f[1];
    x.value = v[f[0]] !== undefined ? v[f[0]] : f[2];
    x.onchange = function () {
      put(id, f[0], x.value);
    };
    x.style.textAlign = "center";
    x.style.marginTop = "4px";
    cell.appendChild(x);
    q.appendChild(cell);
  });
  r.appendChild(q);
  return r;
}
var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
// Look: "saiyan", "prince" (Vegeta style, see prince.js) or "classic".
// SY = any Saiyan-style look (animations, gravity wording); PR = Prince look.
var THEME = "saiyan";
try {
  var t0 = localStorage.getItem("gcTheme");
  if (t0 == "classic" || t0 == "prince") THEME = t0;
} catch (e) {}
var SY = THEME != "classic",
  PR = THEME == "prince";
var RANKS = [
  "Base",
  "Super Saiyan",
  "Super Saiyan 2",
  "Super Saiyan 3",
  "Super Saiyan God",
  "Super Saiyan Blue",
  "Ultra Ego",
];
function applyTheme() {
  SY = THEME != "classic";
  PR = THEME == "prince";
  document.body.className = PR ? "sy pr" : SY ? "sy" : "";
  // Look picker: three buttons
  var t = document.getElementById("theme");
  if (!t) return;
  t.innerHTML = "";
  [
    ["saiyan", "Saiyan"],
    ["prince", "Prince"],
    ["classic", "Classic"],
  ].forEach(function (o) {
    var b = document.createElement("button");
    b.className = "pill" + (THEME == o[0] ? " on" : "");
    b.textContent = o[1];
    b.setAttribute("aria-label", o[1] + " look");
    b.onclick = function () {
      THEME = o[0];
      try {
        localStorage.setItem("gcTheme", THEME);
      } catch (e) {}
      applyTheme();
      render();
      if (typeof showView == "function") showView();
    };
    t.appendChild(b);
  });
}
function ripple(x, y) {
  if (RM || !SY) return;
  var d = document.createElement("div");
  d.className = "ripple";
  d.style.left = x + "px";
  d.style.top = y + "px";
  document.body.appendChild(d);
  setTimeout(function () {
    d.remove();
  }, 800);
}
function powerUp() {
  if (RM || !SY) return;
  var d = document.createElement("div");
  d.className = "burst";
  document.body.appendChild(d);
  var m = document.querySelector("main");
  m.classList.add("shake");
  setTimeout(function () {
    d.remove();
    m.classList.remove("shake");
  }, 1100);
}
var VQ = [
  "Pride of a Saiyan: never lose to yesterday’s you.",
  "A Saiyan prince doesn’t skip training.",
  "Push past your limit, then push again.",
  "Surpass the you of last week.",
];
// One glass orb as a small drawing: amber glass with an inner glow, a light
// reflection and n sparkle marks in a neat pattern. Not yet collected = dark glass.
var ORB_PIPS = [
  [[20, 20]],
  [
    [15, 15],
    [25, 25],
  ],
  [
    [20, 13],
    [14, 24],
    [26, 24],
  ],
  [
    [14, 14],
    [26, 14],
    [14, 26],
    [26, 26],
  ],
  [
    [14, 14],
    [26, 14],
    [20, 20],
    [14, 26],
    [26, 26],
  ],
  [
    [14, 12],
    [26, 12],
    [14, 20],
    [26, 20],
    [14, 28],
    [26, 28],
  ],
  [
    [20, 11],
    [28, 15.5],
    [28, 24.5],
    [20, 29],
    [12, 24.5],
    [12, 15.5],
    [20, 20],
  ],
];
function orbSVG(n, on) {
  var id = "o" + n + (on ? "a" : "b"),
    r = n > 5 ? 3.6 : 4.4, // sparkle size
    pip = "";
  ORB_PIPS[n - 1].forEach(function (p) {
    var x = p[0],
      y = p[1];
    // four-point sparkle
    pip +=
      "<path d='M" +
      x +
      " " +
      (y - r) +
      " Q" +
      x +
      " " +
      y +
      " " +
      (x + r) +
      " " +
      y +
      " Q" +
      x +
      " " +
      y +
      " " +
      x +
      " " +
      (y + r) +
      " Q" +
      x +
      " " +
      y +
      " " +
      (x - r) +
      " " +
      y +
      " Q" +
      x +
      " " +
      y +
      " " +
      x +
      " " +
      (y - r) +
      "Z'/>";
  });
  var glass = on
    ? "<stop offset='0' stop-color='#fff2c2'/><stop offset='.28' stop-color='#ffc444'/><stop offset='.72' stop-color='#ee8410'/><stop offset='1' stop-color='#9c4300'/>"
    : "<stop offset='0' stop-color='#5b6488'/><stop offset='.5' stop-color='#2a3157'/><stop offset='1' stop-color='#141833'/>";
  // Marks: dark mahogany with a thin light edge, so they stay easy to count
  // against both the amber glass and the white shine.
  var marks = on
    ? "fill='#6e1d00' stroke='#fff3cf' stroke-width='.7' stroke-linejoin='round'"
    : "fill='#9aa3c7' fill-opacity='.55'";
  return (
    "<svg viewBox='0 0 40 40' aria-hidden='true'><defs><radialGradient id='" +
    id +
    "' cx='38%' cy='32%' r='70%'>" +
    glass +
    "</radialGradient></defs>" +
    "<circle cx='20' cy='20' r='18.5' fill='url(#" +
    id +
    ")'/>" +
    "<circle cx='20' cy='20' r='18' fill='none' stroke='" +
    (on ? "#ffe3a0" : "#7a84ad") +
    "' stroke-opacity='.55' stroke-width='1'/>" +
    "<g " +
    marks +
    ">" +
    pip +
    "</g>" +
    // small shine up at the top-left edge, clear of the marks
    "<ellipse cx='10.5' cy='8.8' rx='4.2' ry='2.2' transform='rotate(-40 10.5 8.8)' fill='#fff' fill-opacity='" +
    (on ? ".8" : ".3") +
    "'/></svg>"
  );
}
function balls() {
  var el = document.getElementById("balls"),
    vq = document.getElementById("vq");
  if (!el) return;
  if (vq) vq.textContent = VQ[(W * 3 + D) % VQ.length];
  var n = Math.min(7, sess());
  el.innerHTML = "";
  for (var i = 0; i < 7; i++) {
    var b = document.createElement("span");
    b.className = "orb" + (i < n ? " on" : "");
    b.setAttribute("role", "img");
    b.setAttribute(
      "aria-label",
      "Orb " + (i + 1) + (i < n ? ", collected" : ", not collected yet"),
    );
    b.innerHTML = orbSVG(i + 1, i < n);
    el.appendChild(b);
  }
  if (n >= 7) {
    var s = document.createElement("div");
    s.className = "sh";
    s.textContent = "All 7 Dragon Balls collected. Summon Shenron!";
    el.appendChild(s);
  }
}
// Finished cards fold into one short "DONE" row: big check, name and a
// summary. The input boxes are hidden, so nothing can be typed into a
// finished exercise by accident. "Edit" unfolds it; "Close" folds it again.
var OPEN = {}; // finished cards you've unfolded to edit
function doneBar(el, key, title, summary) {
  var open = !!OPEN[key];
  el.classList.add(open ? "opened" : "closed");
  var d = document.createElement("div");
  d.className = "donebar";
  d.innerHTML =
    "<span class='dchk' aria-hidden='true'>✓</span><div class='dtx'><b></b><span class='dsum'></span></div>";
  d.querySelector("b").textContent = open ? "Finished · editing" : title;
  d.querySelector(".dsum").textContent = (open ? "" : "DONE · ") + summary;
  var bt = document.createElement("button");
  bt.className = "pill dedit";
  bt.textContent = open ? "Close" : "Edit";
  bt.setAttribute("aria-label", (open ? "Close " : "Edit ") + title);
  bt.onclick = function () {
    if (open) delete OPEN[key];
    else OPEN[key] = 1;
    render();
  };
  d.appendChild(bt);
  el.insertBefore(d, el.firstChild);
}
function doneOv(el, key, on, title, summary) {
  if (!on) {
    delete FIN[key];
    delete OPEN[key];
    return;
  }
  el.classList.add("fin");
  if (!FIN[key]) {
    FIN[key] = 1;
    if (!first) el.classList.add("pop", "stamp");
  }
  doneBar(el, key, title, summary);
}
var EF = false;
try {
  EF = localStorage.getItem("gcEF") == "1";
} catch (e) {}
// Hidden from the workout: removed from the plan, or elbow-heavy in Elbow-friendly mode.
function hid(e) {
  return !!(e && (e.removed || (EF && e.elbow)));
}
function applyEF() {
  var t = document.getElementById("ef");
  if (t) t.textContent = EF ? "Elbow-friendly mode: ON" : "Elbow-friendly mode: OFF";
}
function rec() {
  var r = document.getElementById("rec");
  if (!r) return;
  var v = (st[k("wr")] || {}).v;
  r.innerHTML =
    v == "A bit sore" || v == "Pain, stopped early"
      ? "<div class='rec'><span class='bean'></span><b>Recovering mode.</b> Rest days are part of the plan. Keep today light, then come back pain-free for a Zenkai Boost.</div>"
      : "";
}
function zen(co, wr) {
  if (wr != "Fine") return 0;
  var best = 0,
    pw = "";
  for (var q in st) {
    var m = q.match(/^(\d+)-(\d+)-co$/);
    if (m && st[q].v && st[q].v < co && st[q].v > best) {
      best = st[q].v;
      pw = (st[m[1] + "-" + m[2] + "-wr"] || {}).v;
    }
  }
  if (!best) return 0;
  var gap = (new Date(co).setHours(0, 0, 0, 0) - new Date(best).setHours(0, 0, 0, 0)) / 864e5;
  return gap >= 2 && (pw == "A bit sore" || pw == "Pain, stopped early") ? 1 : 0;
}
function sess() {
  var n = 0;
  for (var q in st) {
    if (/-co$/.test(q) && st[q].v) n++;
  }
  return n;
}
function cnt(R) {
  var rk = W + "_" + D;
  window.RS = window.RS || {};
  var fresh = !RS[rk];
  RS[rk] = 1;
  if (RM || !fresh || !SY) return;
  R.querySelectorAll(".cnt").forEach(function (el) {
    var n = +el.dataset.n,
      t0 = performance.now();
    (function f(t) {
      var p = Math.min(1, (t - t0) / 1400);
      el.textContent = Math.round(n * p);
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  });
  R.classList.add("scan");
  if (R.querySelector(".zb")) {
    var z = document.createElement("div");
    z.className = "zflash";
    document.body.appendChild(z);
    setTimeout(function () {
      z.remove();
    }, 1500);
  }
  setTimeout(function () {
    R.classList.remove("scan");
  }, 1800);
}
function fmt(ms) {
  var m = Math.round(ms / 60000);
  return m >= 60 ? Math.floor(m / 60) + " h " + (m % 60) + " min" : m + " min";
}
function tm(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function sget(w, d, a) {
  return st[w + "-" + d + "-" + a] || {};
}
function setsOf(w, d, id) {
  var o = [];
  for (var s = 0; s < 14; s++) {
    var v = sget(w, d, id + "-" + s);
    if (v.d) o.push(v);
  }
  return o;
}
function fmtSets(a, t) {
  return a
    .map(function (v) {
      return t == "kg"
        ? (v.kg || "?") + " kg × " + (v.r || "?")
        : (v.kg || "?") + (t == "sec" ? " s" : " min");
    })
    .join(", ");
}
// "Last time" for one set: the same set number in the most recent earlier
// week with ticked sets for this exercise (same day). Returns "" if none.
function lastSetText(id, s, t) {
  for (var w = W - 1; w >= 0; w--) {
    var a = setsOf(w, D, id);
    if (a.length) return a[s] ? "Last (week " + (w + 1) + "): " + fmtSets([a[s]], t) : "";
  }
  return "";
}
function esc(x) {
  return String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
function tIn(lbl, key) {
  var w = document.createElement("label");
  w.className = "small";
  w.style.flex = "1";
  w.style.textAlign = "center";
  w.textContent = lbl;
  var x = document.createElement("input");
  x.type = "time";
  x.style.cssText =
    "width:100%;padding:9px;border:1px solid var(--bd);border-radius:10px;background:var(--bg);color:var(--tx);font:inherit;text-align:center";
  var t = (st[k(key)] || {}).v;
  if (t) {
    var d0 = new Date(t);
    x.value = ("0" + d0.getHours()).slice(-2) + ":" + ("0" + d0.getMinutes()).slice(-2);
  }
  x.onchange = function () {
    if (!x.value) {
      put(key, "v", 0);
      render();
      return;
    }
    var p = x.value.split(":"),
      d = new Date();
    d.setHours(+p[0], +p[1], 0, 0);
    put(key, "v", d.getTime());
    render();
  };
  w.appendChild(x);
  return w;
}
function clock() {
  var c = document.getElementById("clock"),
    ci = (st[k("ci")] || {}).v,
    co = (st[k("co")] || {}).v;
  c.innerHTML = "<b>Gym time</b>";
  var p = document.createElement("p");
  p.className = "small";
  p.style.margin = "4px 0 8px";
  var b = document.createElement("button");
  b.className = "pill";
  b.style.width = "100%";
  if (!ci) {
    p.textContent = "Not checked in yet";
    b.textContent = SY ? "Enter gravity chamber" : "Check in";
    b.onclick = function () {
      put("ci", "v", Date.now());
      powerUp();
      render();
    };
  } else if (!co) {
    p.textContent = "Checked in at " + tm(ci) + " · " + fmt(Date.now() - ci) + " so far";
    b.textContent = SY ? "Leave chamber (check out)" : "Check out";
    b.onclick = function () {
      put("co", "v", Date.now());
      render();
    };
  } else {
    p.textContent = "In " + tm(ci) + " · out " + tm(co) + " · total " + fmt(co - ci);
    b.textContent = "Reset times";
    b.onclick = function () {
      put("ci", "v", 0);
      put("co", "v", 0);
      render();
    };
  }
  c.appendChild(p);
  c.appendChild(b);
  var rr = document.createElement("div");
  rr.className = "row";
  rr.style.marginTop = "10px";
  rr.appendChild(tIn("In (edit time)", "ci"));
  rr.appendChild(tIn("Out (edit time)", "co"));
  c.appendChild(rr);
}
function trs(o, t, i, s) {
  return (
    (o.t !== undefined ? o.t : t) +
    " min · " +
    (o.i !== undefined ? o.i : i) +
    "% incline · " +
    (o.sp !== undefined ? o.sp : s) +
    " km/h"
  );
}
function report() {
  var R = document.getElementById("report");
  R.innerHTML = "";
  var ci = (st[k("ci")] || {}).v,
    co = (st[k("co")] || {}).v;
  if (!co || !g("warm").d) return;
  var ex = DAYS[D].ex,
    n = SETS[W],
    vol = 0,
    sets = 0,
    rows = "",
    rivals = []; // Prince look: exercises where you beat your last numbers
  for (var ei = 0; ei < ex.length; ei++) {
    var e = ex[ei];
    if (hid(e)) continue;
    var sk = (st[k("sk:" + e.id)] || {}).v,
      xs = (st[k("xs:" + e.id)] || {}).v || 0,
      ns = e.unit == "min" ? 1 : n + xs;
    if (sk) {
      rows +=
        "<div class='rx'><div class='n'>" +
        e.name +
        "</div><span class='chip sk'>Skipped</span></div>";
      continue;
    }
    var a = setsOf(W, D, e.id);
    if (a.length < ns) return;
    sets += a.length;
    if (e.unit == "kg")
      a.forEach(function (v) {
        vol += (parseFloat(v.kg) || 0) * (parseFloat(v.r) || 0);
      });
    var beat =
      PR && e.unit == "kg"
        ? a.map(function (v, si) {
            return !!rivalText(e.id, si, v);
          })
        : [];
    if (beat.indexOf(true) > -1) rivals.push(e.name);
    rows +=
      "<div class='rx'><div class='n'>" +
      e.name +
      "</div>" +
      a
        .map(function (v, si) {
          return (
            "<span class='chip" +
            (beat[si] ? " up" : "") +
            "'>" +
            (e.unit == "kg"
              ? (v.kg || "?") + " kg × " + (v.r || "?")
              : (v.kg || "?") + (e.unit == "sec" ? " s" : " min")) +
            (beat[si] ? " ▲" : "") +
            "</span>"
          );
        })
        .join("") +
      "</div>";
  }
  var wv = g("warm"),
    cv = g("cool"),
    wr = (st[k("wr")] || {}).v,
    nt = (st[k("nt")] || {}).v;
  var h =
    "<div class='rep'><div class='rh'>" +
    (PR
      ? "<div class='beam'></div><div class='k'>Workout complete</div><h3>Final blow landed" +
        (NICK ? ", " + esc(NICK) : "") +
        "</h3>"
      : "<h3>Workout complete" + (NICK ? ", " + esc(NICK) : "") + " 💪</h3>") +
    "<div>Week " +
    (W + 1) +
    " · " +
    DAYS[D].n +
    ": " +
    DAYS[D].t +
    "</div><div>" +
    new Date(co).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" }) +
    "</div></div>";
  h +=
    "<div class='stats'><div class='stat'><b>" +
    (ci ? fmt(co - ci) : "–") +
    "</b><span>Gym time</span></div><div class='stat'><b>" +
    Math.round(vol) +
    " kg</b><span>Weight lifted</span></div><div class='stat'><b>" +
    sets +
    "</b><span>Sets done</span></div></div>";
  var zb = zen(co, wr),
    pw = Math.round((vol * 1.5 + sets * 100) * (zb ? 1.2 : 1)),
    rkn = RANKS[Math.min(RANKS.length - 1, Math.floor(sess() / 2))];
  h +=
    (zb
      ? "<div class='zb'>ZENKAI BOOST<small>You came back from a hurt and trained pain-free. +20% power.</small></div>"
      : "") +
    "<div class='pl'><span>SCOUTER READING</span><b class='cnt' data-n='" +
    pw +
    "'>" +
    pw +
    "</b>" +
    (pw > 9000 ? "<em>It’s over 9000!</em>" : "") +
    "<div class='rk'>Rank: " +
    rkn +
    (PR && rkn == "Ultra Ego" ? " · <i>Ultra Ego unlocked</i>" : "") +
    "</div></div>" +
    (PR ? prideBlock(rivals) : "");
  h +=
    "<div class='rx'><div class='n'>Warm-up walk</div><span class='chip'>" +
    trs(wv, 20, 9, 5.5) +
    "</span></div>" +
    rows;
  if (cv.d)
    h +=
      "<div class='rx'><div class='n'>Finisher walk</div><span class='chip'>" +
      trs(cv, 10, 7, 5) +
      "</span></div>";
  if (wr || nt) {
    h += "<div class='rx'><div class='n'>Wrist and notes</div>";
    if (wr) h += "<span class='chip'>" + esc(wr) + "</span>";
    if (nt) h += "<p>" + esc(nt) + "</p>";
    h += "</div>";
  }
  if (typeof achBlock == "function") h += achBlock();
  h +=
    "<div class='rx small'>Next session these numbers show under each set as ‘Last’.</div></div>";
  R.innerHTML = h;
  cnt(R);
}
function render() {
  window.CUR = 0;
  try {
    localStorage.setItem("gcW", W);
    localStorage.setItem("gcD", D);
  } catch (e) {}
  var wk = document.getElementById("weeks");
  wk.innerHTML = "";
  for (var i = 0; i < 4; i++) {
    var b = document.createElement("button");
    b.className = "pill" + (i == W ? " on" : "");
    if (PR) b.innerHTML = "<b>" + (i + 1) + "x</b><span>Week " + (i + 1) + "</span>";
    else b.textContent = SY ? i + 1 + "x" : "W" + (i + 1);
    b.onclick = (function (i) {
      return function () {
        W = i;
        render();
      };
    })(i);
    wk.appendChild(b);
  }
  var dy = document.getElementById("days");
  dy.innerHTML = "";
  DAYS.forEach(function (d, i) {
    var b = document.createElement("button");
    b.className = "pill" + (i == D ? " on" : "");
    b.innerHTML =
      "<b>" + d.n + "</b><br><span style='font-size:12px'>" + d.t.split(" (")[0] + "</span>";
    b.onclick = function () {
      D = i;
      render();
    };
    dy.appendChild(b);
  });
  var n = SETS[W];
  document.getElementById("rule").innerHTML =
    "<b>Week " +
    (W + 1) +
    ":</b> " +
    n +
    " sets per exercise, 10–12 reps each (the plank is timed). Stop each set with 2–3 reps still in the tank. " +
    (W == 3
      ? "If everything felt easy, add a small amount of weight."
      : "Keep the weights light and just get the movement right.");
  var L = document.getElementById("list");
  L.innerHTML = "";
  var w = document.createElement("div");
  w.className = "card";
  var wd = !!g("warm").d;
  w.innerHTML = "<span class='tag'>Warm-up</span><h3>Incline walk</h3><p>" + WARM + "</p>";
  var wb = document.createElement("button");
  wb.className = "chk" + (wd ? " on" : "");
  wb.textContent = wd ? "✓" : "";
  wb.style.marginTop = "8px";
  wb.onclick = function () {
    put("warm", "d", !g("warm").d);
    render();
  };
  w.appendChild(mkTr("warm", 20, 9, 5.5));
  w.appendChild(wb);
  doneOv(w, "w" + W + D, wd, "Warm-up walk", trs(g("warm"), 20, 9, 5.5));
  L.appendChild(w);
  var tot = 1,
    done = wd ? 1 : 0;
  if (EF) {
    var nc = document.createElement("div");
    nc.className = "rec";
    nc.innerHTML =
      "<span class='bean'></span><b>Elbow-friendly mode.</b> Elbow-heavy exercises are hidden. Warm up, train what’s left, and go easy.";
    L.appendChild(nc);
  }
  DAYS[D].ex.forEach(function (e, ei) {
    if (hid(e)) return;
    var c = document.createElement("div");
    c.className = "card";
    c.innerHTML =
      "<span class='tag'>" +
      e.muscle +
      "</span><h3>" +
      e.name +
      "</h3><p>" +
      e.how +
      "</p><p><b>Wrist tip:</b> " +
      e.tip +
      "</p><p><b>Suggested start:</b> " +
      e.start +
      " <span class='small'>(adjust to what feels easy)</span></p>";
    var sk = (st[k("sk:" + e.id)] || {}).v;
    var ed = 0;
    var xs = (st[k("xs:" + e.id)] || {}).v || 0;
    var ns = e.unit == "min" ? 1 : n + xs;
    for (var s = 0; s < (sk ? 0 : ns); s++) {
      (function (s) {
        var id = e.id + "-" + s,
          v = g(id);
        tot++;
        if (v.d) {
          done++;
          ed++;
        }
        var r = document.createElement("div");
        r.className = "set";
        r.innerHTML = "<span>Set " + (s + 1) + "</span>";
        var kg = document.createElement("input");
        kg.type = "number";
        kg.inputMode = "decimal";
        kg.placeholder = e.unit == "sec" ? "seconds" : e.unit == "min" ? "minutes" : "kg";
        kg.value = v.kg || "";
        kg.onchange = function () {
          put(id, "kg", kg.value);
          report();
        };
        var rp = document.createElement("input");
        rp.type = "number";
        rp.inputMode = "numeric";
        rp.placeholder = "reps";
        rp.value = v.r || "";
        rp.onchange = function () {
          put(id, "r", rp.value);
          report();
        };
        var ch = document.createElement("button");
        ch.className = "chk" + (v.d ? " on" : "");
        ch.textContent = v.d ? "✓" : "";
        ch.onclick = function (ev) {
          var nd = !g(id).d;
          put(id, "d", nd);
          if (nd && ev) ripple(ev.clientX, ev.clientY);
          render();
          // Ticking a weighted set starts the rest timer (timer.js)
          if (nd && e.unit == "kg" && window.startRest) startRest();
        };
        r.appendChild(kg);
        if (e.unit == "kg") {
          r.appendChild(rp);
        } else {
          kg.style.gridColumn = "span 2";
        }
        r.appendChild(ch);
        // Under the row, full width: last time's numbers for this set, then
        // the Prince look's "Rival beaten" badge (never inside the grid).
        var blk = document.createElement("div");
        blk.className = "setblk";
        blk.appendChild(r);
        var lt = lastSetText(e.id, s, e.unit);
        // After 14+ days off: suggest about 90% of last time (features.js)
        if (lt && e.unit == "kg" && typeof easeHint == "function") lt += easeHint(e.id, s);
        if (lt) {
          var ll = document.createElement("div");
          ll.className = "setlast";
          ll.textContent = lt;
          blk.appendChild(ll);
        }
        if (PR && e.unit == "kg") rivalBadge(blk, e.id, s, v);
        c.appendChild(blk);
      })(s);
    }
    var br = document.createElement("div");
    br.className = "row";
    br.style.marginTop = "10px";
    if (!sk && e.unit != "min") {
      var ad = document.createElement("button");
      ad.className = "pill";
      ad.textContent = "+ Add set";
      ad.onclick = function () {
        put("xs:" + e.id, "v", xs + 1);
        render();
      };
      br.appendChild(ad);
    }
    var sb = document.createElement("button");
    sb.className = "pill";
    sb.textContent = sk ? "Undo skip" : "Skip exercise";
    sb.onclick = function () {
      put("sk:" + e.id, "v", !sk);
      render();
    };
    br.appendChild(sb);
    if (sk) {
      c.style.opacity = ".55";
      c.classList.add("skp");
    }
    if (!sk && ed < ns) {
      delete FIN[e.id + "_" + W + "_" + D];
      if (!window.CUR) {
        window.CUR = 1;
        c.classList.add("cur");
      }
    }
    if (!sk && ns > 0 && ed == ns) {
      c.classList.add("fin");
      if (!FIN[e.id + "_" + W + "_" + D]) {
        FIN[e.id + "_" + W + "_" + D] = 1;
        if (!first) c.classList.add("pop", "stamp");
      }
      var doneTxt = setsOf(W, D, e.id).map(function (v) {
        return e.unit == "kg"
          ? (v.kg || "?") + "×" + (v.r || "?")
          : (v.kg || "?") + (e.unit == "sec" ? " s" : " min");
      });
      doneBar(c, e.id + "_" + W + "_" + D, e.name, doneTxt.join(" · "));
    } else delete OPEN[e.id + "_" + W + "_" + D];
    c.appendChild(br);
    L.appendChild(c);
  });
  var cd = document.createElement("div");
  cd.className = "card";
  cd.innerHTML =
    "<span class='tag'>Cool-down</span><h3>Incline walk + stretch</h3><p>10–15 minutes on the treadmill at incline 6–8, an easy pace where you can still talk. This is your fat-loss finisher, so build it up to 20 minutes over the weeks. Then gently stretch your forearms: arm straight, palm up, pull the fingers back with the other hand for 20 seconds each side.</p>";
  var cb = document.createElement("button");
  var cdn = !!g("cool").d;
  cb.className = "chk" + (cdn ? " on" : "");
  cb.textContent = cdn ? "✓" : "";
  cb.style.marginTop = "8px";
  cb.onclick = function () {
    put("cool", "d", !g("cool").d);
    render();
  };
  cd.appendChild(mkTr("cool", 10, 7, 5));
  cd.appendChild(cb);
  doneOv(cd, "c" + W + D, cdn, "Cool-down walk", trs(g("cool"), 10, 7, 5));
  L.appendChild(cd);
  document.getElementById("fill").style.width = (tot ? (done / tot) * 100 : 0) + "%";
  document.getElementById("prog").textContent = done + " of " + tot + " sets done";
  var wr = document.getElementById("wrist"),
    nt = document.getElementById("note");
  wr.value = (st[k("wr")] || {}).v || "";
  nt.value = (st[k("nt")] || {}).v || "";
  wr.onchange = function () {
    put("wr", "v", wr.value);
    report();
    rec();
  };
  nt.onchange = function () {
    put("nt", "v", nt.value);
    report();
  };
  clock();
  report();
  balls();
  rec();
  if (PR) princeHero();
  if (window.bkNudge) bkNudge();
  if (typeof featRender == "function") featRender();
  first = false;
}
// Restore a backup object (from the text box or a backup file).
// Before replacing anything, the current data is kept in "gcBeforeRestore"
// so a mistaken restore can be undone. Returns true if it worked.
function restoreFrom(o) {
  if (!o || typeof o != "object" || Array.isArray(o)) return false;
  if (typeof o.nick == "string") {
    if (o.nick.trim()) setNick(o.nick);
    delete o.nick;
  }
  try {
    localStorage.setItem("gcBeforeRestore", JSON.stringify(st));
  } catch (e) {}
  upgradeLogs(o);
  // An older backup has no saved plan: keep the plan you have now.
  if (!o.plan && st.plan) o.plan = st.plan;
  // Same for your body-weight/waist log.
  if (!o.body && st.body) o.body = st.body;
  // Same for gym days, break mode and active rest (features.js).
  ["sched", "brk", "breaks", "rest"].forEach(function (key) {
    if (o[key] === undefined && st[key] !== undefined) o[key] = st[key];
  });
  st = o;
  save();
  loadPlan();
  render();
  if (typeof showView == "function") showView();
  return true;
}
document.getElementById("bki").onclick = function () {
  var o = parseBackupText(document.getElementById("bk").value);
  if (!restoreFrom(o)) alert("That text is not a valid backup.");
  else if (window.backupMsg) backupMsg("Backup restored.");
};
applyEF();
document.getElementById("ef").onclick = function () {
  EF = !EF;
  try {
    localStorage.setItem("gcEF", EF ? "1" : "0");
  } catch (e) {}
  applyEF();
  render();
};
applyTheme();
render();

// ---- Installable offline app (PWA) -----------------------------------------
// Start the offline helper (sw.js). Skipped quietly where it isn't supported,
// e.g. when the file is opened directly instead of from a website.
if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
  navigator.serviceWorker.register("sw.js").catch(function () {});
}
// Ask the browser to never auto-delete saved data (logs) when space is low.
try {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
} catch (e) {}
// Show the "Install app" button only when the browser offers installing.
var installPrompt = null;
window.addEventListener("beforeinstallprompt", function (ev) {
  ev.preventDefault();
  installPrompt = ev;
  document.getElementById("install").hidden = false;
});
document.getElementById("install").onclick = function () {
  if (!installPrompt) return;
  installPrompt.prompt();
  installPrompt = null;
  document.getElementById("install").hidden = true;
};
window.addEventListener("appinstalled", function () {
  document.getElementById("install").hidden = true;
});
