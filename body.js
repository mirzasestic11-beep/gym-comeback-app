// body.js — the "Body" page: body-weight and waist log with trend charts.
//
// Entries are saved inside your logs as st.body (so Backup includes them):
//   st.body = [{d: "2026-11-14", kg: 82.5, waist: 94}, ...]   one per date
// kg and waist are each optional. Saving the same date again updates it.
//
// The trend line is a 7-day average: for each weigh-in, the average of all
// weigh-ins in the 7 days up to and including that day.

var BRANGE = 30; // days shown: 30, 90 or 0 (= all)
try {
  BRANGE = +(localStorage.getItem("gcBodyRange") || 30);
} catch (e) {}

function bodyList() {
  return Array.isArray(st.body)
    ? st.body.filter(function (b) {
        return b && /^\d{4}-\d\d-\d\d$/.test(b.d);
      })
    : [];
}
function dayNum(s) {
  // "2026-11-14" -> whole days, local time, safe across clock changes
  var p = s.split("-");
  return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5);
}
function todayStr() {
  var d = new Date();
  return (
    d.getFullYear() +
    "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + d.getDate()).slice(-2)
  );
}
function shortDate(s) {
  var p = s.split("-");
  return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}

function bodySave(entry) {
  var list = bodyList(),
    found = false;
  list.forEach(function (b) {
    if (b.d == entry.d) {
      if (entry.kg != null) b.kg = entry.kg;
      if (entry.waist != null) b.waist = entry.waist;
      found = true;
    }
  });
  if (!found) list.push(entry);
  list.sort(function (a, b) {
    return a.d < b.d ? -1 : 1;
  });
  st.body = list;
  save();
}

// Points for one measurement ("kg" or "waist"), oldest first, with trend.
function series(key) {
  var pts = bodyList()
    .filter(function (b) {
      return typeof b[key] == "number";
    })
    .map(function (b) {
      return { d: b.d, x: dayNum(b.d), v: b[key] };
    });
  pts.forEach(function (p) {
    var win = pts.filter(function (q) {
      return q.x <= p.x && q.x > p.x - 7;
    });
    p.t =
      win.reduce(function (s, q) {
        return s + q.v;
      }, 0) / win.length;
  });
  return pts;
}

// Chart over time: faint dots = each entry, bold line = 7-day trend.
function timeChart(title, pts, unit, width) {
  var fig = document.createElement("figure");
  fig.className = "chart";
  var cap = document.createElement("figcaption");
  cap.textContent = title;
  fig.appendChild(cap);
  var Wd = Math.max(200, Math.round(width)),
    Ht = Math.round(remPx() * 10),
    L = 36,
    R = 40,
    T = Math.round(remPx() * 0.875 * 0.75) + 3,
    B = Math.round(remPx() * 0.875 + 14);
  var x0 = pts[0].x,
    x1 = pts[pts.length - 1].x;
  if (BRANGE) x0 = Math.min(x0, x1 - BRANGE + 1);
  if (x1 == x0) x0 = x1 - 1;
  var vals = [];
  pts.forEach(function (p) {
    vals.push(p.v, p.t);
  });
  var lo = Math.min.apply(null, vals),
    hi = Math.max.apply(null, vals);
  var step = niceStep(Math.max(hi - lo, 1) / 3);
  var y0 = Math.floor(lo / step) * step,
    y1 = Math.ceil(hi / step) * step;
  if (y1 <= y0) y1 = y0 + step;
  // Margins sized to the real label widths (see labelRoom in progress.js).
  var tickChars = 1;
  for (var tt = y0; tt <= y1 + 1e-9; tt += step) tickChars = Math.max(tickChars, num(tt).length);
  L = labelRoom(tickChars);
  R = labelRoom(num(pts[pts.length - 1].t).length) + 6;
  var X = function (x) {
      return L + ((x - x0) / (x1 - x0)) * (Wd - L - R);
    },
    Y = function (v) {
      return T + ((y1 - v) / (y1 - y0)) * (Ht - T - B);
    };
  var last = pts[pts.length - 1];
  var svg = sv("svg", {
    width: Wd,
    height: Ht,
    viewBox: "0 0 " + Wd + " " + Ht,
    role: "img",
    "aria-label":
      title +
      ". Latest " +
      num(last.v) +
      " " +
      unit +
      ", trend " +
      num(last.t) +
      " " +
      unit +
      ", " +
      pts.length +
      " entries.",
  });
  for (var t = y0; t <= y1 + 1e-9; t += step) {
    sv("line", { x1: L, x2: Wd - R + 6, y1: Y(t), y2: Y(t), class: "grid" }, svg);
    sv(
      "text",
      { x: L - 6, y: Y(t), "text-anchor": "end", "dominant-baseline": "middle", class: "tick" },
      svg,
    ).textContent = num(t);
  }
  // 3 date labels: start, middle, end
  [x0, Math.round((x0 + x1) / 2), x1].forEach(function (x, k) {
    var d = new Date(x * 864e5);
    sv(
      "text",
      {
        x: X(x),
        y: Ht - 5,
        "text-anchor": k == 0 ? "start" : k == 2 ? "end" : "middle",
        class: "tick",
      },
      svg,
    ).textContent = d.toLocaleDateString([], { day: "numeric", month: "short", timeZone: "UTC" });
  });
  var dots = pts.map(function (p) {
    return sv("circle", { cx: X(p.x), cy: Y(p.v), r: 4, class: "dot raw" }, svg);
  });
  if (pts.length > 1)
    sv(
      "polyline",
      {
        points: pts
          .map(function (p) {
            return X(p.x) + "," + Y(p.t);
          })
          .join(" "),
        class: "trend",
      },
      svg,
    );
  sv(
    "text",
    { x: X(last.x) + 8, y: Y(last.t), "dominant-baseline": "middle", class: "endv" },
    svg,
  ).textContent = num(last.t);

  // Tap / hover anywhere: nearest entry is shown.
  var tip = document.createElement("div");
  tip.className = "tip";
  tip.hidden = true;
  var hit = sv(
    "rect",
    { x: L - 10, y: 0, width: Wd - L - R + 20, height: Ht - B, class: "hit" },
    svg,
  );
  function near(ev) {
    var r = svg.getBoundingClientRect(),
      mx = ev.clientX - r.left,
      best = 0;
    pts.forEach(function (p, i) {
      if (Math.abs(X(p.x) - mx) < Math.abs(X(pts[best].x) - mx)) best = i;
    });
    var p = pts[best];
    tip.textContent = shortDate(p.d) + " · " + num(p.v) + " " + unit + " (trend " + num(p.t) + ")";
    tip.style.left = Math.min(Math.max(X(p.x), 90), Wd - 90) + "px";
    tip.style.top = Y(p.v) + 14 + "px";
    tip.hidden = false;
    dots.forEach(function (d, i) {
      d.setAttribute("r", i == best ? 6 : 4);
    });
  }
  hit.addEventListener("pointermove", near);
  hit.addEventListener("click", near);
  hit.addEventListener("pointerleave", function () {
    tip.hidden = true;
    dots.forEach(function (d) {
      d.setAttribute("r", 4);
    });
  });
  fig.appendChild(svg);
  fig.appendChild(tip);
  return fig;
}

function bodySummary(pts, unit, what) {
  var last = pts[pts.length - 1];
  var txt =
    "Latest " +
    what +
    ": " +
    num(last.v) +
    " " +
    unit +
    " (" +
    shortDate(last.d) +
    ") · trend " +
    num(last.t) +
    " " +
    unit;
  // Change of the trend over the last 30 days (needs an entry ~30 days ago)
  var past = pts
    .filter(function (p) {
      return p.x <= last.x - 30;
    })
    .pop();
  var first = past || pts[0];
  if (first !== last) {
    var dlt = last.t - first.t,
      days = last.x - first.x;
    txt +=
      " · " +
      (dlt > 0 ? "+" : dlt < 0 ? "−" : "±") +
      num(Math.abs(dlt)) +
      " " +
      unit +
      " in " +
      days +
      " day" +
      (days == 1 ? "" : "s");
  }
  return txt;
}

function bodyPage() {
  var L = document.getElementById("blist");
  L.innerHTML = "";

  // ---- Entry form ----
  var f = document.createElement("div");
  f.className = "card";
  f.innerHTML = "<b>Add today's numbers</b>";
  var row = document.createElement("div");
  row.className = "row brow";
  function inp(label, type, ph) {
    var l = document.createElement("label");
    l.className = "small";
    l.textContent = label;
    var x = document.createElement("input");
    x.type = type;
    if (type == "number") {
      x.inputMode = "decimal";
      x.step = "0.1";
    }
    x.placeholder = ph || "";
    l.appendChild(x);
    row.appendChild(l);
    return x;
  }
  var dIn = inp("Date", "date"),
    kIn = inp("Weight (kg)", "number", "e.g. 82.5"),
    wIn = inp("Waist (cm)", "number", "e.g. 94");
  dIn.value = todayStr();
  dIn.max = todayStr();
  f.appendChild(row);
  var msg = document.createElement("p");
  msg.className = "small";
  var sb = document.createElement("button");
  sb.className = "pill on";
  sb.style.width = "100%";
  sb.style.marginTop = "10px";
  sb.textContent = "Save";
  sb.onclick = function () {
    var kg = parseFloat(String(kIn.value).replace(",", ".")),
      wa = parseFloat(String(wIn.value).replace(",", "."));
    if (!/^\d{4}-\d\d-\d\d$/.test(dIn.value)) return (msg.textContent = "Please pick a date.");
    if (isNaN(kg) && isNaN(wa))
      return (msg.textContent = "Enter your weight, your waist, or both.");
    if (!isNaN(kg) && (kg < 30 || kg > 300))
      return (msg.textContent = "Weight should be between 30 and 300 kg.");
    if (!isNaN(wa) && (wa < 40 || wa > 250))
      return (msg.textContent = "Waist should be between 40 and 250 cm.");
    var e = { d: dIn.value };
    if (!isNaN(kg)) e.kg = Math.round(kg * 10) / 10;
    if (!isNaN(wa)) e.waist = Math.round(wa * 10) / 10;
    bodySave(e);
    bodyPage();
  };
  f.appendChild(sb);
  f.appendChild(msg);
  L.appendChild(f);

  var all = bodyList();
  if (!all.length) {
    L.insertAdjacentHTML(
      "beforeend",
      "<div class='card'><p>No entries yet. Your trend charts appear here after your first entry.</p></div>",
    );
    return;
  }

  // ---- Range buttons ----
  var rg = document.createElement("div");
  rg.className = "pills";
  [
    [30, "30 days"],
    [90, "90 days"],
    [0, "All"],
  ].forEach(function (o) {
    var b = document.createElement("button");
    b.className = "pill" + (BRANGE == o[0] ? " on" : "");
    b.textContent = o[1];
    b.onclick = function () {
      BRANGE = o[0];
      try {
        localStorage.setItem("gcBodyRange", BRANGE);
      } catch (e) {}
      bodyPage();
    };
    rg.appendChild(b);
  });
  L.appendChild(rg);

  // ---- Charts ----
  var lastDay = dayNum(all[all.length - 1].d);
  [
    ["kg", "Body weight (kg)", "kg", "weight"],
    ["waist", "Waist (cm)", "cm", "waist"],
  ].forEach(function (m) {
    var pts = series(m[0]);
    var shown = BRANGE
      ? pts.filter(function (p) {
          return p.x > lastDay - BRANGE;
        })
      : pts;
    var c = document.createElement("div");
    c.className = "card";
    L.appendChild(c);
    if (!shown.length) {
      c.innerHTML =
        "<b>" +
        m[1] +
        "</b><p>" +
        (pts.length ? "No entries in this time range." : "No entries yet.") +
        "</p>";
      return;
    }
    c.appendChild(timeChart(m[1], shown, m[2], c.clientWidth - 30 || 300));
    c.insertAdjacentHTML(
      "beforeend",
      "<div class='blegend small'><span><i class='kdot'></i>Each entry</span><span><i class='kline'></i>Trend (7-day average)</span></div>" +
        "<p>" +
        esc(bodySummary(pts, m[2], m[3])) +
        "</p>",
    );
  });

  // ---- All entries (newest first), with delete ----
  var t = document.createElement("div");
  t.className = "card";
  t.innerHTML =
    "<details><summary>All entries (" +
    all.length +
    ")</summary><table class='ptab'><tbody></tbody></table></details>";
  var tb = t.querySelector("tbody");
  all
    .slice()
    .reverse()
    .forEach(function (b) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<th>" +
        esc(shortDate(b.d)) +
        "</th><td>" +
        [b.kg != null ? num(b.kg) + " kg" : "", b.waist != null ? num(b.waist) + " cm waist" : ""]
          .filter(Boolean)
          .join(" · ") +
        "</td>";
      var td = document.createElement("td");
      td.style.width = "40px";
      var x = document.createElement("button");
      x.className = "bdel";
      x.textContent = "✕";
      x.setAttribute("aria-label", "Delete entry " + shortDate(b.d));
      x.onclick = function () {
        if (!confirm("Delete the entry for " + shortDate(b.d) + "?")) return;
        st.body = bodyList().filter(function (q) {
          return q.d != b.d;
        });
        save();
        bodyPage();
        document.querySelector("#blist details").open = true;
      };
      td.appendChild(x);
      tr.appendChild(td);
      tb.appendChild(tr);
    });
  L.appendChild(t);
}
