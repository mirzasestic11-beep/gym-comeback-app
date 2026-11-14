// editor.js — the "Edit plan" page: rename, edit, reorder, add, swap and
// remove exercises, and reset to the original plan.
//
// Safety rules (your history is never deleted):
// - Renaming/editing keeps the exercise's id, so its history continues.
// - Removing an exercise that has ANY logs only marks it "removed": it
//   disappears from the workout but its history stays (shown on the Progress
//   page) and you can put it back. Only never-logged exercises are deleted.
// - Swapping = removing the old one (same rule) + a new one in its place.
// Your plan is saved inside your logs (st.plan) by savePlan().

var ED = null; // day shown in the editor
var FORM = null; // open form: {mode: "edit"|"add"|"swap", i: index}

function clean(s, max) {
  return String(s == null ? "" : s)
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max || 600);
}

function newId(name) {
  var slug = clean(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + "-" + slug;
}

// Does this exercise have any logs in any week on this day?
function hasHistory(d, id) {
  for (var key in st) {
    for (var w = 0; w < 4; w++) {
      var pre = w + "-" + SD(d) + "-"; // this plan's own day numbers
      if (key.indexOf(pre + id + "-") === 0 || key === pre + "sk:" + id || key === pre + "xs:" + id)
        return true;
    }
  }
  return false;
}

function savePlan() {
  var same =
    JSON.stringify(
      DAYS.map(function (d) {
        return d.ex;
      }),
    ) ==
    JSON.stringify(
      DEFAULT_DAYS.map(function (d) {
        return d.ex;
      }),
    );
  var mine = {
    v: 1,
    days: DAYS.map(function (d) {
      return { ex: d.ex };
    }),
  };
  // The 3-day plan keeps using st.plan (as before); other plans st.plans[days].
  if (DPW == 3) {
    if (same) delete st.plan;
    else st.plan = mine;
  } else {
    st.plans = st.plans || {};
    if (same) delete st.plans[DPW];
    else st.plans[DPW] = mine;
    if (!Object.keys(st.plans).length) delete st.plans;
  }
  save();
  render(); // update the Workout page too
}

function unitName(u) {
  return u == "min" ? "Minutes" : u == "sec" ? "Seconds (timed hold)" : "Weight × reps";
}

function btn(label, fn, cls) {
  var b = document.createElement("button");
  b.className = "pill" + (cls ? " " + cls : "");
  b.textContent = label;
  b.onclick = fn;
  return b;
}

function editor() {
  if (ED == null || ED > DAYS.length - 1) ED = Math.min(D, DAYS.length - 1);
  var pd = document.getElementById("edays");
  pd.innerHTML = "";
  DAYS.forEach(function (d, i) {
    var b = document.createElement("button");
    b.className = "pill" + (i == ED ? " on" : "");
    b.innerHTML =
      "<b>" + d.n + "</b><br><span style='font-size:12px'>" + d.t.split(" (")[0] + "</span>";
    b.onclick = function () {
      ED = i;
      FORM = null;
      editor();
    };
    pd.appendChild(b);
  });

  var L = document.getElementById("elist");
  L.innerHTML = "";
  var ex = DAYS[ED].ex;

  ex.forEach(function (e, i) {
    if (e.removed) return;
    if (FORM && FORM.i == i && FORM.mode != "add") {
      L.appendChild(form(FORM.mode, e, i));
      return;
    }
    var c = document.createElement("div");
    c.className = "card erow";
    c.innerHTML =
      "<b>" +
      esc(e.name) +
      "</b><div class='small'>" +
      esc(e.muscle || "") +
      " · " +
      unitName(e.unit) +
      (e.elbow ? " · elbow-heavy" : "") +
      "</div>";
    var r = document.createElement("div");
    r.className = "row ebtns";
    var up = btn(
      "↑",
      function () {
        move(i, -1);
      },
      "earr",
    );
    up.setAttribute("aria-label", "Move up");
    var dn = btn(
      "↓",
      function () {
        move(i, 1);
      },
      "earr",
    );
    dn.setAttribute("aria-label", "Move down");
    r.appendChild(up);
    r.appendChild(dn);
    r.appendChild(
      btn("Edit", function () {
        FORM = { mode: "edit", i: i };
        editor();
      }),
    );
    r.appendChild(
      btn("Swap", function () {
        FORM = { mode: "swap", i: i };
        editor();
      }),
    );
    r.appendChild(
      btn("Remove", function () {
        remove(i);
      }),
    );
    c.appendChild(r);
    L.appendChild(c);
  });

  if (FORM && FORM.mode == "add") L.appendChild(form("add", null, -1));
  else
    L.appendChild(
      btn(
        "+ Add exercise",
        function () {
          FORM = { mode: "add", i: -1 };
          editor();
        },
        "eadd",
      ),
    );

  var gone = [];
  ex.forEach(function (e, i) {
    if (e.removed) gone.push(i);
  });
  if (gone.length) {
    var g = document.createElement("div");
    g.className = "card";
    g.innerHTML =
      "<b>Removed (history kept)</b><p class='small'>Their logs are still saved and shown on the Progress page.</p>";
    gone.forEach(function (i) {
      var r = document.createElement("div");
      r.className = "row";
      r.style.marginTop = "8px";
      var n = document.createElement("span");
      n.style.flex = "1";
      n.textContent = ex[i].name;
      r.appendChild(n);
      var pb = btn("Put back", function () {
        delete ex[i].removed;
        savePlan();
        editor();
      });
      pb.style.flex = "0 0 auto";
      pb.style.padding = "8px 14px";
      r.appendChild(pb);
      g.appendChild(r);
    });
    L.appendChild(g);
  }

  var rs = document.createElement("div");
  rs.className = "card";
  rs.innerHTML =
    "<b>Start over</b><p class='small'>Go back to the original plan for all 3 days. Logs are never deleted; exercises you added that have logs stay under Removed.</p>";
  rs.appendChild(btn("Reset to original plan", resetPlan));
  L.appendChild(rs);
}

// Move up/down past the next exercise that is still in the plan.
function move(i, dir) {
  var ex = DAYS[ED].ex,
    j = i + dir;
  while (j >= 0 && j < ex.length && ex[j].removed) j += dir;
  if (j < 0 || j >= ex.length) return;
  var t = ex[i];
  ex[i] = ex[j];
  ex[j] = t;
  FORM = null;
  savePlan();
  editor();
}

// Remove: keep it (marked removed) if it has logs, otherwise really delete it.
function dropAt(i) {
  var ex = DAYS[ED].ex;
  if (hasHistory(ED, ex[i].id)) ex[i].removed = true;
  else ex.splice(i, 1);
}
function remove(i) {
  var e = DAYS[ED].ex[i];
  var kept = hasHistory(ED, e.id);
  if (
    !confirm(
      "Remove " +
        e.name +
        " from " +
        DAYS[ED].n +
        "?" +
        (kept ? "\n\nIts logged history is kept and you can put it back later." : ""),
    )
  )
    return;
  dropAt(i);
  FORM = null;
  savePlan();
  editor();
}

function resetPlan() {
  if (!confirm("Go back to the original plan? Your logs are kept.")) return;
  DAYS.forEach(function (d, di) {
    var defIds = DEFAULT_DAYS[di].ex.map(function (e) {
      return e.id;
    });
    var keep = d.ex.filter(function (e) {
      return defIds.indexOf(e.id) < 0 && hasHistory(di, e.id);
    });
    d.ex = JSON.parse(JSON.stringify(DEFAULT_DAYS[di].ex)).concat(
      keep.map(function (e) {
        e.removed = true;
        return e;
      }),
    );
  });
  FORM = null;
  savePlan();
  editor();
}

// The form used for Edit, Add and Swap.
function form(mode, e, i) {
  var c = document.createElement("div");
  c.className = "card eform";
  var title =
    mode == "edit"
      ? "Edit " + e.name
      : mode == "swap"
        ? "Swap " + e.name + " for…"
        : "Add an exercise to " + DAYS[ED].n;
  c.innerHTML = "<b></b>";
  c.firstChild.textContent = title;
  var locked = mode == "edit" && hasHistory(ED, e.id);
  var v = e
    ? JSON.parse(JSON.stringify(e))
    : { name: "", muscle: "", how: "", tip: "", start: "", unit: "kg" };
  if (mode == "swap") v = { name: "", muscle: "", how: "", tip: "", start: "", unit: "kg" };

  var fields = {};
  function field(key, label, kind) {
    var l = document.createElement("label");
    l.className = "small flab";
    l.textContent = label;
    var x;
    if (kind == "area") {
      x = document.createElement("textarea");
      x.rows = 4;
    } else if (kind == "unit") {
      x = document.createElement("select");
      ["kg", "min", "sec"].forEach(function (u) {
        var o = document.createElement("option");
        o.value = u;
        o.textContent = unitName(u);
        x.appendChild(o);
      });
      if (locked) {
        x.disabled = true;
        l.appendChild(document.createTextNode(" (fixed because this exercise has logs)"));
      }
    } else {
      x = document.createElement("input");
      x.type = "text";
    }
    x.value = v[key] || (kind == "unit" ? "kg" : "");
    fields[key] = x;
    l.appendChild(x);
    c.appendChild(l);
  }

  // Add/Swap: pick from the built-in list to fill the form in.
  if (mode != "edit") {
    var pl = document.createElement("label");
    pl.className = "small flab";
    pl.textContent = "Pick from the list, or write your own below";
    var sel = document.createElement("select");
    sel.innerHTML = "<option value=''>Write my own</option>";
    var groups = {};
    LIBRARY.forEach(function (x, k) {
      if (!groups[x.area]) {
        groups[x.area] = document.createElement("optgroup");
        groups[x.area].label = x.area;
        sel.appendChild(groups[x.area]);
      }
      var o = document.createElement("option");
      o.value = k;
      o.textContent = x.name;
      groups[x.area].appendChild(o);
    });
    sel.onchange = function () {
      var x = sel.value === "" ? { unit: "kg" } : LIBRARY[+sel.value];
      ["name", "muscle", "how", "tip", "start"].forEach(function (k) {
        fields[k].value = x[k] || "";
      });
      fields.unit.value = x.unit || "kg";
      elb.checked = !!x.elbow;
    };
    pl.appendChild(sel);
    c.appendChild(pl);
  }

  field("name", "Name");
  field("muscle", "Muscle (small tag)");
  field("how", "How to do it (plain English)", "area");
  field("tip", "Wrist tip");
  field("start", "Suggested start");
  field("unit", "What you log", "unit");
  var el = document.createElement("label");
  el.className = "small echk";
  var elb = document.createElement("input");
  elb.type = "checkbox";
  elb.checked = !!v.elbow;
  el.appendChild(elb);
  el.appendChild(document.createTextNode(" Elbow-heavy (hidden in Elbow-friendly mode)"));
  c.appendChild(el);

  var msg = document.createElement("p");
  msg.className = "small";
  msg.style.color = "var(--wat)";
  c.appendChild(msg);

  var r = document.createElement("div");
  r.className = "row";
  r.style.marginTop = "8px";
  r.appendChild(
    btn(
      mode == "swap" ? "Swap" : "Save",
      function () {
        var name = clean(fields.name.value, 80);
        if (!name) {
          msg.textContent = "Please give it a name.";
          return;
        }
        var out = {
          name: name,
          muscle: clean(fields.muscle.value, 60),
          how: clean(fields.how.value),
          tip: clean(fields.tip.value, 200),
          start: clean(fields.start.value, 80),
          unit: fields.unit.value,
        };
        if (elb.checked) out.elbow = true;
        var ex = DAYS[ED].ex;
        if (mode == "edit") {
          out.id = e.id; // same id = history continues
          if (locked) out.unit = e.unit;
          ex[i] = out;
        } else {
          out.id = newId(name);
          if (mode == "add") ex.push(out);
          else {
            ex.splice(i, 0, out); // new one takes the old one's place
            dropAt(i + 1);
          }
        }
        FORM = null;
        savePlan();
        editor();
      },
      "on",
    ),
  );
  r.appendChild(
    btn("Cancel", function () {
      FORM = null;
      editor();
    }),
  );
  c.appendChild(r);
  return c;
}
