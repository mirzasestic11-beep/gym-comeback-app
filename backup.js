// backup.js — backup files you keep OUTSIDE the browser.
//
// "Save backup file" makes a small text file (your logs, plan and body log,
// in the same format as the copy/paste backup) and opens Android's share
// menu, so one tap sends it to Google Drive, Gmail, Keep or Files. Where
// sharing files isn't possible, the file is downloaded to the phone instead.
// "Restore from file" reads such a file back in. Before restoring, your
// current data is kept as an undo copy (see restoreFrom in app.js).
//
// Small settings, separate from your logs:
//   gcLastBackup  when you last saved a backup file
//   gcNudgeOff    when you last tapped "Not now" on the reminder

var DAY = 864e5;

function lsGet(k) {
  try {
    return +localStorage.getItem(k) || 0;
  } catch (e) {
    return 0;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
}

function backupName() {
  var d = new Date();
  return (
    "gym-comeback-backup-" +
    d.getFullYear() +
    "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + d.getDate()).slice(-2) +
    ".txt"
  );
}

// Facts about a backup: number of ticked sets and the latest workout date.
function backupInfo(o) {
  var c = JSON.parse(JSON.stringify(o));
  upgradeLogs(c);
  var sets = 0,
    last = 0;
  for (var k in c) {
    if (/^\d+-\d+-\D.*-\d+$/.test(k) && c[k] && c[k].d) sets++;
    if (/^\d+-\d+-co$/.test(k) && c[k] && c[k].v > last) last = c[k].v;
  }
  return { sets: sets, last: last };
}

function hasData() {
  for (var k in st) if (/-co$/.test(k) || /^\d+-\d+-\D.*-\d+$/.test(k)) return true;
  return !!(st.body && st.body.length);
}

function ago(t) {
  if (!t) return "never";
  var d = Math.floor((Date.now() - t) / DAY);
  return d <= 0 ? "today" : d == 1 ? "yesterday" : d + " days ago";
}

function backupStatus() {
  var el = document.getElementById("bkstat");
  if (!el) return;
  var last = lsGet("gcLastBackup");
  el.textContent =
    "Last backup file: " +
    ago(last) +
    ". Save one after your workouts and keep it in Google Drive or your phone's files.";
  if (navigator.storage && navigator.storage.persisted)
    navigator.storage.persisted().then(
      function (p) {
        el.textContent += p
          ? " This browser has agreed to keep the app's data."
          : " This browser hasn't promised to keep the app's data, so backup files matter even more.";
      },
      function () {},
    );
}

function backupMsg(t) {
  var m = document.getElementById("bkmsg");
  if (m) m.textContent = t;
}

function backupDone(how) {
  lsSet("gcLastBackup", Date.now());
  backupStatus();
  bkNudge();
  backupMsg(how);
}

function downloadBackup(text, name) {
  var url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  var a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 5000);
  backupDone("Saved " + name + " to your phone's Downloads folder.");
}

function saveBackup() {
  var text = JSON.stringify(st),
    name = backupName(),
    file = null;
  try {
    file = new File([text], name, { type: "text/plain" });
  } catch (e) {}
  if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: "Gym Comeback backup" }).then(
      function () {
        backupDone("Backup shared. Pick Google Drive (or Files) to keep it safe.");
      },
      function (err) {
        if (err && err.name == "AbortError")
          backupMsg("Not saved. Tap Save backup file again when ready.");
        else downloadBackup(text, name);
      },
    );
  } else downloadBackup(text, name);
}

function restoreFile(file) {
  if (!file) return;
  var r = new FileReader();
  r.onload = function () {
    var o = null;
    try {
      o = JSON.parse(r.result);
    } catch (e) {}
    if (!o || typeof o != "object" || Array.isArray(o)) {
      backupMsg("That file isn't a Gym Comeback backup.");
      return;
    }
    var info = backupInfo(o);
    var when = info.last
      ? new Date(info.last).toLocaleDateString([], {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "no workout dates";
    if (
      !confirm(
        "Restore this backup?\n\nIt has " +
          info.sets +
          " logged sets, latest workout: " +
          when +
          ".\n\nIt replaces the logs on this phone. Your current logs are kept as an undo copy.",
      )
    )
      return;
    if (restoreFrom(o)) {
      backupMsg("Backup restored (" + info.sets + " sets).");
      showUndo();
    } else backupMsg("That file isn't a Gym Comeback backup.");
  };
  r.readAsText(file);
}

// One-step undo after a restore.
function showUndo() {
  var m = document.getElementById("bkmsg");
  if (!m || document.getElementById("bkundo")) return;
  var b = document.createElement("button");
  b.className = "pill";
  b.id = "bkundo";
  b.textContent = "Undo restore";
  b.style.marginLeft = "8px";
  b.style.padding = "6px 12px";
  b.onclick = function () {
    var prev = null;
    try {
      prev = JSON.parse(localStorage.getItem("gcBeforeRestore"));
    } catch (e) {}
    if (prev && restoreFrom(prev)) backupMsg("Restore undone. Your previous logs are back.");
  };
  m.appendChild(b);
}

// Reminder on the Workout page: after a checked-out workout that isn't in a
// backup yet, or when the last backup is more than a week old.
function bkNudge() {
  var n = document.getElementById("bknudge");
  if (!n) return;
  var last = lsGet("gcLastBackup"),
    off = lsGet("gcNudgeOff"),
    now = Date.now(),
    co = 0;
  for (var k in st) if (/^\d+-\d+-co$/.test(k) && st[k] && st[k].v > co) co = st[k].v;
  var afterWorkout = co > last && co > off;
  var stale = now - Math.max(last, off) > 7 * DAY;
  var show = hasData() && (afterWorkout || stale);
  n.hidden = !show;
  if (!show) return;
  n.innerHTML = "";
  var t = document.createElement("p");
  t.style.margin = "0 0 8px";
  t.innerHTML = afterWorkout
    ? "<b>💾 Workout saved on this phone.</b> Save a backup copy too?"
    : "<b>💾 Time for a backup.</b> Your last backup file was " + ago(last) + ".";
  n.appendChild(t);
  var r = document.createElement("div");
  r.className = "row";
  var a = document.createElement("button");
  a.className = "pill on";
  a.textContent = "Save backup file";
  a.onclick = saveBackup;
  var b = document.createElement("button");
  b.className = "pill";
  b.textContent = "Not now";
  b.onclick = function () {
    lsSet("gcNudgeOff", Date.now());
    bkNudge();
  };
  r.appendChild(a);
  r.appendChild(b);
  n.appendChild(r);
}

document.getElementById("bksave").onclick = saveBackup;
document.getElementById("bkload").onclick = function () {
  var f = document.getElementById("bkfile");
  f.value = "";
  f.click();
};
document.getElementById("bkfile").onchange = function (ev) {
  restoreFile(ev.target.files && ev.target.files[0]);
  ev.target.value = ""; // so picking the same file again still works
};
backupStatus();
bkNudge();
