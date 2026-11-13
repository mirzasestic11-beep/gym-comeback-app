// timer.js — rest timer between sets.
// Ticking a weighted set starts a countdown bar at the bottom of the screen.
// When it reaches zero the phone beeps and vibrates.
//
// Settings are saved in their own localStorage keys (NOT in your logs "gc"):
//   gcRest       rest length in seconds (default 90, remembers your last choice)
//   gcRestEnd    when the current rest ends (so it survives a reload)
//   gcRestSound  "0" = beep turned off
//
// The end time is stored as a clock time, not as "seconds left", so the
// timer stays correct even if the phone pauses the page in the background.

var REST = 90,
  REST_END = 0,
  REST_SOUND = true,
  restTick = null,
  restDoneShown = 0,
  wakeLock = null,
  audioCtx = null;
try {
  REST = Math.min(600, Math.max(15, +localStorage.getItem("gcRest") || 90));
  REST_END = +localStorage.getItem("gcRestEnd") || 0;
  REST_SOUND = localStorage.getItem("gcRestSound") != "0";
} catch (e) {}

function restSave() {
  try {
    localStorage.setItem("gcRest", REST);
    localStorage.setItem("gcRestEnd", REST_END);
    localStorage.setItem("gcRestSound", REST_SOUND ? "1" : "0");
  } catch (e) {}
}

function startRest() {
  REST_END = Date.now() + REST * 1000;
  restDoneShown = 0;
  restSave();
  // Sound must be "unlocked" by a tap; ticking the set is that tap.
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state == "suspended") audioCtx.resume();
  } catch (e) {}
  keepAwake(true);
  restLoop();
}

function stopRest() {
  REST_END = 0;
  restDoneShown = 0;
  restSave();
  keepAwake(false);
  restDraw();
}

// Keep the screen on while resting, so the beep isn't missed.
function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      navigator.wakeLock.request("screen").then(
        function (l) {
          wakeLock = l;
          l.addEventListener("release", function () {
            wakeLock = null;
          });
        },
        function () {},
      );
    } else if (!on && wakeLock) {
      wakeLock.release();
      wakeLock = null;
    }
  } catch (e) {}
}

function beep() {
  try {
    navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 500]);
  } catch (e) {}
  if (!REST_SOUND || !audioCtx) return;
  try {
    var t = audioCtx.currentTime;
    [0, 0.3, 0.6].forEach(function (d, i) {
      var o = audioCtx.createOscillator(),
        gn = audioCtx.createGain();
      o.frequency.value = i == 2 ? 1320 : 880;
      gn.gain.setValueAtTime(0.0001, t + d);
      gn.gain.exponentialRampToValueAtTime(0.4, t + d + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.22);
      o.connect(gn);
      gn.connect(audioCtx.destination);
      o.start(t + d);
      o.stop(t + d + 0.25);
    });
  } catch (e) {}
}

function mmss(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
}

function restLoop() {
  clearInterval(restTick);
  restDraw();
  restTick = setInterval(restDraw, 250);
}

function restBtn(label, fn, extra) {
  var b = document.createElement("button");
  b.className = "pill";
  b.textContent = label;
  if (extra) b.setAttribute("aria-label", extra);
  b.onclick = fn;
  return b;
}

// Draws the bar. Called 4 times a second while a rest is running.
function restDraw() {
  var box = document.getElementById("rest");
  if (!box) return;
  if (!REST_END) {
    clearInterval(restTick);
    box.hidden = true;
    document.body.classList.remove("resting");
    return;
  }
  var left = (REST_END - Date.now()) / 1000;
  if (left <= 0) {
    // Rest is over: beep once, show "Go" for 8 seconds, then hide.
    if (!restDoneShown) {
      restDoneShown = Date.now();
      if (left > -5) beep(); // don't beep for a rest that ended long ago
      keepAwake(false);
    }
    if (Date.now() - restDoneShown > 8000) return stopRest();
  }
  box.hidden = false;
  document.body.classList.add("resting");
  var sy = document.body.classList.contains("sy"),
    pr = document.body.classList.contains("pr");
  var state = left > 0 ? "run" : "done";
  // Only rebuild the buttons when needed; just update the numbers otherwise.
  if (box.dataset.state != state + sy + pr) {
    box.dataset.state = state + sy + pr;
    box.innerHTML = "";
    var top = document.createElement("div");
    top.className = "rtop";
    // Prince look: a round scouter-style countdown with "what's next" text.
    top.innerHTML = pr
      ? "<div class='ring'><svg viewBox='0 0 66 66' aria-hidden='true'><circle cx='33' cy='33' r='29' class='rbg'/>" +
        "<circle cx='33' cy='33' r='29' class='rfg' transform='rotate(-90 33 33)'/></svg>" +
        "<b class='rtime' aria-live='off'></b></div><div class='rtxt'><span class='rlbl'></span><span class='rnext'></span></div>"
      : "<span class='rlbl'></span><b class='rtime' aria-live='off'></b>";
    box.appendChild(top);
    var bar = document.createElement("div");
    bar.className = "bar";
    bar.innerHTML = "<i></i>";
    box.appendChild(bar);
    var row = document.createElement("div");
    row.className = "row";
    if (state == "run") {
      row.appendChild(
        restBtn(
          "−15s",
          function () {
            restAdd(-15);
          },
          "15 seconds less",
        ),
      );
      row.appendChild(
        restBtn(
          "+15s",
          function () {
            restAdd(15);
          },
          "15 seconds more",
        ),
      );
      row.appendChild(restBtn("Skip", stopRest, "Skip rest"));
    } else {
      row.appendChild(restBtn("OK", stopRest));
    }
    var snd = restBtn(
      REST_SOUND ? "🔔" : "🔕",
      function () {
        REST_SOUND = !REST_SOUND;
        restSave();
        snd.textContent = REST_SOUND ? "🔔" : "🔕";
        snd.setAttribute("aria-label", REST_SOUND ? "Sound on" : "Sound off");
      },
      REST_SOUND ? "Sound on" : "Sound off",
    );
    snd.classList.add("rsnd");
    row.appendChild(snd);
    box.appendChild(row);
  }
  box.querySelector(".rlbl").textContent =
    state == "run"
      ? (sy ? "Recharging ki" : "Rest") + " · " + mmss(REST) + " total"
      : sy
        ? "Power restored! Next set"
        : "Rest over · next set";
  box.querySelector(".rtime").textContent = state == "run" ? mmss(left) : "GO";
  if (pr) {
    var frac = state == "run" ? Math.max(0, left / REST) : 0;
    box.querySelector(".rfg").style.strokeDashoffset = (182.2 * (1 - frac)).toFixed(1);
    box.querySelector(".rnext").textContent = nextUp();
  }
  box.querySelector(".bar i").style.width = (state == "run" ? (1 - left / REST) * 100 : 100) + "%";
}

// Prince look: which set is next, read from the Workout page.
function nextUp() {
  var rows = document.querySelectorAll("#list .card .set");
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i].querySelector(".chk.on")) {
      var card = rows[i].closest(".card"),
        h = card && card.querySelector("h3");
      var sn = rows[i].querySelector("span");
      if (h && sn)
        return (
          "Next: " + h.textContent + ", " + sn.textContent.toLowerCase() + ". Breathe. Then strike."
        );
    }
  }
  return "All sets done. Finish strong.";
}

// −15s / +15s: changes this rest AND remembers the length for next time.
function restAdd(s) {
  var nr = Math.min(600, Math.max(15, REST + s));
  REST_END += (nr - REST) * 1000;
  REST = nr;
  restSave();
  restDraw();
}

// Coming back to the app (unlocking the phone): redraw straight away,
// and ask for the screen to stay on again if a rest is still running.
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState == "visible" && REST_END) {
    if (REST_END > Date.now()) keepAwake(true);
    restLoop();
  }
});

if (REST_END) {
  // A rest that ended more than a minute ago is forgotten.
  if (Date.now() - REST_END > 60000) stopRest();
  else restLoop();
}
