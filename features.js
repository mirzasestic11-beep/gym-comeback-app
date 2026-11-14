// features.js — gym days + calendar reminder, gym-day banner, badges,
// break mode, active rest and the "ease back in" suggestion.
//
// New keys inside your logs (so Backup includes them; old logs untouched):
//   st.sched   {days: [1, 3, 5], time: "18:00"}   days: 0 = Sun ... 6 = Sat
//   st.brk     {start: "2026-11-14", end: "2026-11-30" or ""}  break now
//   st.breaks  [{start, end}, ...]                 finished breaks
//   st.rest    [{d: "2026-11-14", type: "walk", min: 30}, ...]  active rest
// Per phone only (not in backups): gcGymBanner = day the gym-day banner was
// dismissed. Badges are worked out from your logs, never stored.
// Nothing here ever lowers your rank or changes past workouts.

var WDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  WDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  ICS_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"],
  REST_TYPES = [
    ["walk", "Walk"],
    ["swim", "Swim"],
    ["bike", "Bike"],
    ["other", "Other"],
  ];

function fx(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function fxBtn(label, fn, cls) {
  var b = fx("button", "pill" + (cls ? " " + cls : ""), label);
  b.onclick = fn;
  return b;
}

// ---------------------------------------------------------------- gym days
function sched() {
  var s = st.sched || {};
  return {
    days: Array.isArray(s.days)
      ? s.days.filter(function (d) {
          return d >= 0 && d <= 6;
        })
      : [],
    time: /^\d\d:\d\d$/.test(s.time) ? s.time : "18:00",
  };
}
function saveSched(s) {
  st.sched = { days: s.days.slice().sort(), time: s.time };
  save();
}

// A repeating calendar event (.ics) for the gym days, with an alarm at the
// chosen time. The phone's calendar app does the reminding, so it works
// without internet and without any server.
function makeICS() {
  var s = sched(),
    now = new Date(),
    pad = function (n) {
      return ("0" + n).slice(-2);
    };
  // first chosen day from today on (today counts if the time is still ahead)
  var hm = s.time.split(":"),
    first = null;
  for (var i = 0; i < 8 && !first; i++) {
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, +hm[0], +hm[1]);
    if (s.days.indexOf(d.getDay()) > -1 && d > now) first = d;
  }
  var dt = function (d) {
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      "T" +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      "00"
    );
  };
  var stamp =
    now.getUTCFullYear() +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    "T" +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) +
    "Z";
  var days = s.days
    .slice()
    .sort()
    .map(function (d) {
      return ICS_DAY[d];
    })
    .join(",");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gym Comeback//Gym days//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:gym-comeback-gym-days-" + Date.now() + "@gym-comeback.local",
    "DTSTAMP:" + stamp,
    "DTSTART:" + dt(first),
    "DURATION:PT1H",
    "RRULE:FREQ=WEEKLY;BYDAY=" + days,
    "SUMMARY:Gym session 💪",
    "DESCRIPTION:Time to train. Open Gym Comeback when you get there.",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Gym time",
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
function addToCalendar(msg) {
  var text = makeICS(),
    name = "gym-days.ics",
    file = null;
  function download() {
    var url = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 5000);
    msg.textContent =
      "Saved gym-days.ics. Open it from your notifications or Downloads and tap Add/Save in your calendar.";
  }
  try {
    file = new File([text], name, { type: "text/calendar" });
  } catch (e) {}
  if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] }))
    navigator.share({ files: [file], title: "Gym days" }).then(
      function () {
        msg.textContent = "Sent to your calendar app. Tap Save there to add the reminders.";
      },
      function (err) {
        if (err && err.name == "AbortError")
          msg.textContent = "Not added. Tap the button again when ready.";
        else download();
      },
    );
  else download();
}

// --------------------------------------------------------- sessions, breaks
function sessions() {
  var o = [];
  for (var key in st) {
    var m = key.match(/^(\d+)-(\d+)-co$/);
    if (m && st[key] && st[key].v) {
      var ci = (st[m[1] + "-" + m[2] + "-ci"] || {}).v || st[key].v;
      o.push({ w: +m[1], d: +m[2], co: st[key].v, ci: ci });
    }
  }
  return o.sort(function (a, b) {
    return a.co - b.co;
  });
}
function onBreak() {
  return !!(st.brk && st.brk.start);
}
function startBreak(end) {
  st.brk = { start: todayStr(), end: end || "" };
  save();
}
function finishBreak(endDay) {
  if (!onBreak()) return;
  st.breaks = (st.breaks || []).concat([{ start: st.brk.start, end: endDay || todayStr() }]);
  delete st.brk;
  save();
}
// A break with an end date finishes by itself after that day.
function checkBreakEnd() {
  if (onBreak() && st.brk.end && todayStr() > st.brk.end) finishBreak(st.brk.end);
}
function inBreak(day) {
  var all = (st.breaks || []).slice();
  if (onBreak()) all.push({ start: st.brk.start, end: "9999-12-31" });
  return all.some(function (b) {
    return day >= b.start && day <= b.end;
  });
}

// ---------------------------------------------------------------- badges
// Worked out from your logs every time. "exclude" leaves one session out,
// so the report can tell which badge this workout just earned.
function achievements(exclude) {
  var ss = sessions().filter(function (s) {
    return !(exclude && s.w + "-" + s.d == exclude);
  });
  var hour = function (t) {
    return new Date(t).getHours();
  };
  var early = ss.filter(function (s) {
      return hour(s.co) < 8;
    }).length,
    night = ss.filter(function (s) {
      return hour(s.co) >= 21;
    }).length;
  var planned = DAYS.length * 4,
    doneDays = {};
  ss.forEach(function (s) {
    if (s.w < 4 && s.d < DAYS.length) doneDays[s.w + "-" + s.d] = 1;
  });
  var comeback = 0;
  for (var i = 1; i < ss.length; i++) if ((ss[i].ci - ss[i - 1].co) / DAY >= 7) comeback = 1;
  var travelDays = {};
  (st.rest || []).forEach(function (r) {
    if (inBreak(r.d)) travelDays[r.d] = 1;
  });
  return [
    {
      id: "early",
      icon: "🌅",
      name: "Early Bird",
      desc: "Finish 5 workouts before 8 am",
      n: Math.min(early, 5),
      of: 5,
    },
    {
      id: "night",
      icon: "🦉",
      name: "Night Owl",
      desc: "Finish 5 workouts after 9 pm",
      n: Math.min(night, 5),
      of: 5,
    },
    {
      id: "clock",
      icon: "⏱️",
      name: "Clockwork",
      desc: "Finish every planned day for 4 weeks",
      n: Object.keys(doneDays).length,
      of: planned,
    },
    {
      id: "comeback",
      icon: "🔥",
      name: "Comeback",
      desc: "Come back after 7+ days off",
      n: comeback,
      of: 1,
    },
    {
      id: "travel",
      icon: "🧭",
      name: "Travel Arc",
      desc: "Log 5 active-rest days during a break",
      n: Math.min(Object.keys(travelDays).length, 5),
      of: 5,
    },
  ];
}

// Workout report: badges earned (marked NEW if this workout earned them)
// and a positive message when this workout is a comeback.
function achBlock() {
  var cur = W + "-" + D,
    now = achievements(),
    before = achievements(cur);
  var ss = sessions(),
    idx = -1;
  ss.forEach(function (s, i) {
    if (s.w + "-" + s.d == cur) idx = i;
  });
  var h = "<div class='rx ach'><div class='n'>Badges</div>";
  if (idx > 0) {
    var gap = Math.floor((ss[idx].ci - ss[idx - 1].co) / DAY);
    if (gap >= 7)
      h +=
        "<p class='cmsg'><b>Welcome back! 🔥</b> First workout after " +
        gap +
        " days off. Showing up again is the hardest rep, and you just did it.</p>";
  }
  var earned = now.filter(function (a) {
    return a.n >= a.of;
  });
  if (!earned.length) h += "<p>No badges yet. They'll show up here as you earn them.</p>";
  earned.forEach(function (a) {
    var isNew = !before.some(function (b) {
      return b.id == a.id && b.n >= b.of;
    });
    h +=
      "<span class='chip badge" +
      (isNew ? " new" : "") +
      "'>" +
      a.icon +
      " " +
      a.name +
      (isNew ? " · NEW" : "") +
      "</span>";
  });
  return h + "</div>";
}

// -------------------------------------------------- 14+ days off: ease in
function easeInfo() {
  if ((st[k("co")] || {}).v) return null; // this session is already done
  var cur = W + "-" + D,
    ss = sessions().filter(function (s) {
      return s.w + "-" + s.d != cur;
    });
  if (!ss.length) return null;
  var days = Math.floor((Date.now() - ss[ss.length - 1].co) / DAY);
  return days >= 14 ? { days: days } : null;
}
function roundKg(kg) {
  // round DOWN (to 0.5 kg for light weights, 2.5 kg otherwise), so the
  // suggestion is never above 90% of last time
  return kg < 10 ? Math.floor(kg * 2) / 2 : Math.floor(kg / 2.5) * 2.5;
}
// Added to a set's "Last" line, e.g. " · try about 55 kg today (90%)"
function easeHint(id, s) {
  if (!easeInfo()) return "";
  for (var w = W - 1; w >= 0; w--) {
    var a = setsOf(w, D, id);
    if (a.length) {
      var kg = a[s] ? parseFloat(a[s].kg) : NaN;
      return kg > 0 ? " · try about " + roundKg(kg * 0.9) + " kg today (90%)" : "";
    }
  }
  return "";
}

// --------------------------------------------- banners on the Workout page
function nextSession() {
  for (var w = 0; w < 4; w++)
    for (var d = 0; d < DAYS.length; d++)
      if (!(st[w + "-" + d + "-co"] || {}).v)
        return "Week " + (w + 1) + " · " + DAYS[d].n + ": " + DAYS[d].t.split(" (")[0];
  return "";
}
function trainedToday() {
  var t = todayStr();
  for (var key in st) {
    if (/^\d+-\d+-(ci|co)$/.test(key) && st[key] && st[key].v) {
      var d = new Date(st[key].v);
      var ds =
        d.getFullYear() +
        "-" +
        ("0" + (d.getMonth() + 1)).slice(-2) +
        "-" +
        ("0" + d.getDate()).slice(-2);
      if (ds == t) return true;
    }
  }
  return false;
}
function featRender() {
  checkBreakEnd();
  var box = document.getElementById("featban");
  if (!box) return;
  box.innerHTML = "";
  if (onBreak()) {
    var b = fx("div", "card fban brkban");
    var p = fx("p");
    p.innerHTML = "<b>🌴 On a break</b>";
    p.appendChild(
      document.createTextNode(
        (st.brk.end ? " until " + shortDate(st.brk.end) : "") +
          ". Rest well. Your rank and history stay exactly where they are.",
      ),
    );
    b.appendChild(p);
    b.appendChild(
      fxBtn("I'm back", function () {
        finishBreak();
        render();
      }),
    );
    box.appendChild(b);
  } else {
    var s = sched(),
      today = new Date().getDay(),
      off = "";
    try {
      off = localStorage.getItem("gcGymBanner") || "";
    } catch (e) {}
    if (s.days.indexOf(today) > -1 && !trainedToday() && off != todayStr()) {
      var g = fx("div", "card fban gymban");
      var gp = fx("p");
      gp.innerHTML = "<b>💪 It's a gym day.</b> ";
      var nx = nextSession();
      gp.appendChild(document.createTextNode(nx ? "Next up: " + nx + "." : "Time to train."));
      g.appendChild(gp);
      g.appendChild(
        fxBtn("Got it", function () {
          try {
            localStorage.setItem("gcGymBanner", todayStr());
          } catch (e) {}
          featRender();
        }),
      );
      box.appendChild(g);
    }
  }
  var ei = easeInfo();
  if (ei) {
    var e = fx("div", "card fban easeban");
    var ep = fx("p");
    ep.innerHTML = "<b>Welcome back! It's been " + ei.days + " days since your last workout.</b> ";
    ep.appendChild(
      document.createTextNode(
        "Today's sets suggest about 90% of last time's weights. Muscles come back fast, but tendons and joints need a session or two to catch up. Go by feel.",
      ),
    );
    e.appendChild(ep);
    box.appendChild(e);
  }
}

// ------------------------------------------------------------ the You page
function youPage() {
  checkBreakEnd();
  var L = document.getElementById("ylist");
  if (!L) return;
  L.innerHTML = "";

  // --- settings: nickname (only on this phone, included in backups)
  var c0 = fx("div", "card ycard");
  c0.appendChild(fx("h3", "", "Nickname"));
  c0.appendChild(
    fx(
      "p",
      "small",
      "Optional. Shown on your progress, workout reports and rival lines. Stored only on this phone and included in your backups.",
    ),
  );
  var nl = fx("label", "ylab", "Your nickname");
  var ni = document.createElement("input");
  ni.type = "text";
  ni.maxLength = 20;
  ni.value = NICK;
  ni.placeholder = "e.g. Mirza";
  ni.autocomplete = "nickname";
  nl.appendChild(ni);
  c0.appendChild(nl);
  var nmsg = fx("p", "small ymsg");
  nmsg.setAttribute("role", "status");
  c0.appendChild(
    fxBtn(
      "Save nickname",
      function () {
        setNick(ni.value);
        lsSet("gcNickAsked", "1");
        render();
        youPage();
        var m = document.querySelector("#ylist .ymsg");
        if (m) m.textContent = NICK ? "Saved. Hi, " + NICK + "!" : "Nickname removed.";
      },
      "on ywide",
    ),
  );
  c0.appendChild(nmsg);
  L.appendChild(c0);

  // --- gym days + reminder
  var s = sched();
  var c1 = fx("div", "card ycard");
  c1.appendChild(fx("h3", "", "Gym days & reminder"));
  c1.appendChild(fx("p", "small", "Pick up to 5 days and the time you want to be reminded."));
  var row = fx("div", "ydays");
  [1, 2, 3, 4, 5, 6, 0].forEach(function (d) {
    var on = s.days.indexOf(d) > -1;
    var b = fx("button", "pill yday" + (on ? " on" : ""), WDAY[d]);
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.setAttribute("aria-label", WDAY_LONG[d]);
    if (!on && s.days.length >= 5) b.disabled = true;
    b.onclick = function () {
      var cur = sched();
      var i = cur.days.indexOf(d);
      if (i > -1) cur.days.splice(i, 1);
      else if (cur.days.length < 5) cur.days.push(d);
      saveSched(cur);
      youPage();
      featRender();
    };
    row.appendChild(b);
  });
  c1.appendChild(row);
  c1.appendChild(
    fx(
      "p",
      "small ylim",
      s.days.length >= 5
        ? "That's 5 days, the most you can pick."
        : s.days.length + " of 5 days picked.",
    ),
  );
  var tl = fx("label", "ylab", "Reminder time");
  var ti = document.createElement("input");
  ti.type = "time";
  ti.value = s.time;
  ti.onchange = function () {
    if (!/^\d\d:\d\d$/.test(ti.value)) return;
    var cur = sched();
    cur.time = ti.value;
    saveSched(cur);
  };
  tl.appendChild(ti);
  c1.appendChild(tl);
  var msg = fx("p", "small ymsg");
  msg.setAttribute("role", "status");
  var cal = fxBtn(
    "Add to my calendar",
    function () {
      addToCalendar(msg);
    },
    "on ywide",
  );
  if (!s.days.length) {
    cal.disabled = true;
    msg.textContent = "Pick at least one day first.";
  }
  c1.appendChild(cal);
  c1.appendChild(msg);
  c1.appendChild(
    fx(
      "p",
      "small",
      "Your calendar app shows the reminder, even without internet. On a gym day, the Workout page also shows a small banner.",
    ),
  );
  L.appendChild(c1);

  // --- break mode
  var c2 = fx("div", "card ycard");
  c2.appendChild(fx("h3", "", "Break mode"));
  if (onBreak()) {
    c2.appendChild(
      fx(
        "p",
        "",
        "On a break since " +
          shortDate(st.brk.start) +
          (st.brk.end ? ", until " + shortDate(st.brk.end) : "") +
          ". Gym-day banners are paused. Your rank and history never go down.",
      ),
    );
    c2.appendChild(
      fxBtn(
        "I'm back",
        function () {
          finishBreak();
          youPage();
          render();
        },
        "on ywide",
      ),
    );
  } else {
    c2.appendChild(
      fx(
        "p",
        "small",
        "Travelling, ill or just resting? Pause the gym-day banners. Your rank and history never go down.",
      ),
    );
    var el = fx("label", "ylab", "Until (optional)");
    var ei = document.createElement("input");
    ei.type = "date";
    ei.min = todayStr();
    el.appendChild(ei);
    c2.appendChild(el);
    c2.appendChild(
      fxBtn(
        "I'm on a break",
        function () {
          startBreak(/^\d{4}-\d\d-\d\d$/.test(ei.value) ? ei.value : "");
          youPage();
          render();
        },
        "on ywide",
      ),
    );
  }
  if ((st.breaks || []).length)
    c2.appendChild(fx("p", "small", "Past breaks: " + st.breaks.length + "."));
  L.appendChild(c2);

  // --- active rest
  var c3 = fx("div", "card ycard");
  c3.appendChild(fx("h3", "", "Active rest"));
  c3.appendChild(fx("p", "small", "Walked, swam or cycled on a rest day? Log it here."));
  var tlab = fx("label", "ylab", "Activity");
  var tsel = document.createElement("select");
  REST_TYPES.forEach(function (t) {
    var o = document.createElement("option");
    o.value = t[0];
    o.textContent = t[1];
    tsel.appendChild(o);
  });
  tlab.appendChild(tsel);
  var mlab = fx("label", "ylab", "Minutes");
  var mi = document.createElement("input");
  mi.type = "number";
  mi.inputMode = "numeric";
  mi.min = "1";
  mi.max = "600";
  mi.placeholder = "e.g. 30";
  mlab.appendChild(mi);
  var dlab = fx("label", "ylab", "Date");
  var di = document.createElement("input");
  di.type = "date";
  di.value = todayStr();
  di.max = todayStr();
  dlab.appendChild(di);
  var r3 = fx("div", "yrow");
  r3.appendChild(tlab);
  r3.appendChild(mlab);
  c3.appendChild(r3);
  c3.appendChild(dlab);
  var rmsg = fx("p", "small ymsg");
  rmsg.setAttribute("role", "status");
  c3.appendChild(
    fxBtn(
      "Log active rest",
      function () {
        var m = parseInt(mi.value, 10);
        if (!(m >= 1 && m <= 600)) return (rmsg.textContent = "Enter the minutes (1 to 600).");
        if (!/^\d{4}-\d\d-\d\d$/.test(di.value)) return (rmsg.textContent = "Pick a date.");
        st.rest = (st.rest || []).concat([{ d: di.value, type: tsel.value, min: m }]);
        save();
        youPage();
        var nm = document.querySelector("#ylist .ymsg.rest");
        if (nm) nm.textContent = "Saved. Nice work staying active.";
      },
      "on ywide",
    ),
  );
  rmsg.className += " rest";
  c3.appendChild(rmsg);
  var hist = (st.rest || [])
    .map(function (r, i) {
      return { r: r, i: i };
    })
    .sort(function (a, b) {
      return a.r.d < b.r.d ? 1 : a.r.d > b.r.d ? -1 : b.i - a.i;
    });
  c3.appendChild(fx("h4", "yh4", "History"));
  if (!hist.length) c3.appendChild(fx("p", "small", "Nothing logged yet."));
  hist.forEach(function (h) {
    var t = REST_TYPES.filter(function (x) {
      return x[0] == h.r.type;
    })[0];
    var line = fx("div", "yhist");
    line.appendChild(
      fx(
        "span",
        "",
        shortDate(h.r.d) +
          " · " +
          (t ? t[1] : "Other") +
          " · " +
          h.r.min +
          " min" +
          (inBreak(h.r.d) ? " · during a break" : ""),
      ),
    );
    var del = fxBtn(
      "✕",
      function () {
        if (!confirm("Delete this active-rest entry?")) return;
        st.rest = st.rest.filter(function (x, j) {
          return j != h.i;
        });
        save();
        youPage();
      },
      "ydel",
    );
    del.setAttribute("aria-label", "Delete " + shortDate(h.r.d) + " entry");
    line.appendChild(del);
    c3.appendChild(line);
  });
  L.appendChild(c3);

  // --- badges
  var c4 = fx("div", "card ycard");
  c4.appendChild(fx("h3", "", "Badges"));
  achievements().forEach(function (a) {
    var done = a.n >= a.of;
    var bd = fx("div", "ybadge" + (done ? " done" : ""));
    bd.appendChild(fx("span", "yicon", a.icon));
    var tx = fx("div", "ytx");
    tx.appendChild(fx("b", "", a.name + (done ? " ✓" : "")));
    tx.appendChild(fx("span", "", a.desc + (done ? "" : " · " + a.n + " of " + a.of)));
    bd.appendChild(tx);
    c4.appendChild(bd);
  });
  L.appendChild(c4);
}

// first draw (the Workout page was drawn before this file loaded)
render();
