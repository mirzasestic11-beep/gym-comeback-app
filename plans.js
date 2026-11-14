// plans.js — ready-made plans for 2, 3, 4 or 5 training days per week.
//
// 3 days = the original plan in plan.js (legs / push / pull), unchanged.
// The other plans reuse the same exercises (and the built-in library), with
// the same plain-English explanations, but with their OWN exercise ids, so
// their history is kept separately.
//
// Each plan also stores its logs under its own day numbers (PLAN_BASE):
//   3 days -> days 0-2 (exactly as before, so your existing logs are untouched)
//   2 days -> days 10-11, 4 days -> days 20-23, 5 days -> days 30-34
// Switching plans never changes or mixes logs; switching back brings
// everything back.

var PLAN_BASE = { 2: 10, 3: 0, 4: 20, 5: 30 };
var ORIGINAL_DAYS = JSON.parse(JSON.stringify(DAYS)); // the 3-day plan

function planTemplate(n) {
  if (n == 3 || !PLAN_BASE.hasOwnProperty(n)) return JSON.parse(JSON.stringify(ORIGINAL_DAYS));
  var byId = {};
  ORIGINAL_DAYS.forEach(function (d) {
    d.ex.forEach(function (e) {
      byId[e.id] = e;
    });
  });
  var byName = {};
  (typeof LIBRARY != "undefined" ? LIBRARY : []).forEach(function (e) {
    byName[e.name] = e;
  });
  // copy an exercise from the 3-day plan (by id) or the library (by name)
  function ex(prefix, src) {
    var o = JSON.parse(JSON.stringify(byId[src] || byName[src]));
    delete o.area;
    o.id =
      prefix +
      "-" +
      (byId[src]
        ? src.replace(/^d\d-/, "")
        : src
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/-$/, ""));
    return o;
  }
  function day(prefix, name, title, list) {
    return {
      n: name,
      t: title,
      ex: list.map(function (s) {
        return ex(prefix, s);
      }),
    };
  }
  if (n == 2)
    return [
      day("p2a", "Day A", "Full body A", [
        "d1-leg-press",
        "d2-chest-press",
        "d3-seated-cable-row",
        "d3-lateral-raise-machine",
        "d1-floor-crunch",
      ]),
      day("p2b", "Day B", "Full body B", [
        "d1-leg-extension",
        "d1-seated-leg-curl",
        "d3-lat-pulldown",
        "d2-shoulder-press",
        "d3-back-extension",
      ]),
    ];
  if (n == 4)
    return [
      day("p4a", "Day 1", "Upper A", [
        "d2-chest-press",
        "d3-seated-cable-row",
        "d2-shoulder-press",
        "d3-hammer-curl",
        "d2-triceps-pushdown",
      ]),
      day("p4b", "Day 2", "Lower A", [
        "d1-leg-press",
        "d1-seated-leg-curl",
        "Glute Bridge",
        "Seated Calf Raise Machine",
        "d1-floor-crunch",
      ]),
      day("p4c", "Day 3", "Upper B", [
        "d3-lat-pulldown",
        "d2-butterfly",
        "Chest-Supported Row Machine",
        "d3-lateral-raise-machine",
        "Reverse Fly Machine (Rear Delt)",
      ]),
      day("p4d", "Day 4", "Lower B", [
        "d1-leg-extension",
        "Hip Abduction Machine",
        "d3-back-extension",
        "d1-stepper-or-bike",
        "Plank",
      ]),
    ];
  // 5 days: legs / push / pull (same exercises as the 3-day plan) + upper + lower
  var lpp = ORIGINAL_DAYS.map(function (d, i) {
    return day(
      "p5" + "abc"[i],
      "Day " + (i + 1),
      d.t,
      d.ex.map(function (e) {
        return e.id;
      }),
    );
  });
  return lpp.concat([
    day("p5d", "Day 4", "Upper", [
      "d2-chest-press",
      "d3-lat-pulldown",
      "d2-shoulder-press",
      "d3-seated-cable-row",
      "d3-hammer-curl",
    ]),
    day("p5e", "Day 5", "Lower", [
      "d1-leg-press",
      "Hip Abduction Machine",
      "Seated Calf Raise Machine",
      "Glute Bridge",
      "Dead Bug",
    ]),
  ]);
}
