// backup.js — backups as text you keep in a note (no files, no accounts).
//
// "Copy backup" puts the backup text on the clipboard: a header line with
// your nickname and the date, then your logs (same data as old backups).
// Paste it over your previous backup note.
// "Restore from text" (app.js) reads it back, and also reads old backups.
// "Move to a new phone" is the only place that makes a file: export one file
// on the old phone, "Restore from file" on the new one.
// Before any restore, your current data is kept as an undo copy.
//
// Small settings on this phone, separate from your logs:
//   gcLastBackup  when you last copied (or exported) a backup
//   gcBackupSig   a fingerprint of your logs at that moment, to tell
//                 whether anything changed since
//   gcNudgeOff    when you last tapped "Not now" on the reminder
//   gcNickAsked   the one-time nickname question has been answered

var DAY = 864e5;

function lsGet(k) {
  try {
    return +localStorage.getItem(k) || 0;
  } catch (e) {
    return 0;
  }
}
function lsStr(k) {
  try {
    return localStorage.getItem(k) || "";
  } catch (e) {
    return "";
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
}

function isoDay() {
  var d = new Date();
  return (
    d.getFullYear() +
    "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + d.getDate()).slice(-2)
  );
}

// The backup text: "Gym Comeback backup · Mirza · 2026-11-14" then the data.
function backupText() {
  var data = JSON.parse(JSON.stringify(st));
  if (NICK) data.nick = NICK;
  return (
    "Gym Comeback backup · " + (NICK ? NICK + " · " : "") + isoDay() + "\n" + JSON.stringify(data)
  );
}

// Short fingerprint of the logs, to know if anything changed since the
// last backup.
function logSig() {
  var s = JSON.stringify(st) + "|" + NICK,
    h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}
function changedSinceBackup() {
  return logSig() != lsStr("gcBackupSig");
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
    "Last backup: " +
    ago(last) +
    "." +
    (last
      ? changedSinceBackup()
        ? " Something has changed since then."
        : " Nothing has changed since then."
      : "") +
    " Tap Copy backup and paste it over your previous backup note.";
}

function backupMsg(t) {
  var m = document.getElementById("bkmsg");
  if (m) m.textContent = t;
}

function backupDone(how) {
  lsSet("gcLastBackup", Date.now());
  lsSet("gcBackupSig", logSig());
  backupStatus();
  bkNudge();
  backupMsg(how);
}

// Copy to the clipboard. The text also goes into the box below, so it can
// be copied by hand if the phone blocks automatic copying.
function copyBackup() {
  var text = backupText(),
    box = document.getElementById("bk");
  if (box) box.value = text;
  function fallback() {
    var ok = false;
    try {
      box.focus();
      box.select();
      ok = document.execCommand("copy");
    } catch (e) {}
    if (ok) backupDone("Copied. Paste it over your previous backup note.");
    else
      backupMsg(
        "Couldn't copy automatically. The backup is in the box below: select it all and copy it.",
      );
  }
  if (navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(text).then(function () {
      backupDone("Copied. Paste it over your previous backup note.");
    }, fallback);
  else fallback();
}

// "Move to a new phone": one file, shared or downloaded.
function exportFile() {
  var text = backupText(),
    name = "gym-comeback-move-" + isoDay() + ".txt",
    file = null;
  function download() {
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
    backupDone(
      "Saved " +
        name +
        " to Downloads. Send it to your new phone, then use Restore from file there.",
    );
  }
  try {
    file = new File([text], name, { type: "text/plain" });
  } catch (e) {}
  if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] }))
    navigator.share({ files: [file], title: "Gym Comeback: move to a new phone" }).then(
      function () {
        backupDone("File sent. On the new phone, open the app and tap Restore from file.");
      },
      function (err) {
        if (err && err.name == "AbortError")
          backupMsg("Not exported. Tap Export file again when ready.");
        else download();
      },
    );
  else download();
}

function restoreFile(file) {
  if (!file) return;
  var r = new FileReader();
  r.onload = function () {
    var o = parseBackupText(r.result);
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

// Monthly reminder on the Workout page, only if something changed since the
// last backup. "Not now" waits another month.
function bkNudge() {
  backupStatus(); // keep "changed since then" up to date
  var n = document.getElementById("bknudge");
  if (!n) return;
  var last = lsGet("gcLastBackup"),
    off = lsGet("gcNudgeOff"),
    due = Date.now() - Math.max(last, off) >= 30 * DAY;
  var show = hasData() && changedSinceBackup() && due;
  n.hidden = !show;
  if (!show) {
    n.dataset.k = "";
    return;
  }
  // Only redraw when the message changes, so a tap on the buttons is never
  // lost to a redraw (e.g. right after typing a number).
  var key = last ? "m" + ago(last) : "first";
  if (n.dataset.k == key) return;
  n.dataset.k = key;
  n.innerHTML = "";
  var t = document.createElement("p");
  t.style.margin = "0 0 8px";
  t.innerHTML = last
    ? "<b>💾 Time for your monthly backup.</b> Your logs changed since your last one (" +
      ago(last) +
      ")."
    : "<b>💾 Time for your first backup.</b> Copy it into a note so your history is safe.";
  n.appendChild(t);
  var r = document.createElement("div");
  r.className = "row";
  var a = document.createElement("button");
  a.className = "pill on";
  a.textContent = "Copy backup";
  a.onclick = copyBackup;
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

// One-time, optional nickname question on the Workout page.
function nickAsk() {
  var box = document.getElementById("nickask");
  if (!box) return;
  box.innerHTML = "";
  if (lsStr("gcNickAsked") || NICK) return;
  var c = document.createElement("div");
  c.className = "card nickcard";
  c.innerHTML =
    "<label class='nicklab' for='nickin'><b>What should we call you?</b> Optional. It shows on your progress, reports and rival lines.</label>";
  var i = document.createElement("input");
  i.type = "text";
  i.id = "nickin";
  i.maxLength = 20;
  i.autocomplete = "nickname";
  i.placeholder = "Nickname";
  c.appendChild(i);
  var r = document.createElement("div");
  r.className = "row";
  var ok = document.createElement("button");
  ok.className = "pill on";
  ok.textContent = "Save";
  ok.onclick = function () {
    setNick(i.value);
    lsSet("gcNickAsked", "1");
    nickAsk();
    render();
  };
  var no = document.createElement("button");
  no.className = "pill";
  no.textContent = "Skip";
  no.onclick = function () {
    lsSet("gcNickAsked", "1");
    nickAsk();
  };
  r.appendChild(ok);
  r.appendChild(no);
  c.appendChild(r);
  box.appendChild(c);
}

document.getElementById("bkx").onclick = copyBackup;
document.getElementById("bkexport").onclick = exportFile;
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
nickAsk();
