// intro.js — the opening power-up animation (original warrior from the app
// icon: scanner lights up, aura builds, hair turns gold, flash, app opens).
// The animation itself is in styles.css and ends on its own after ~2.5 s;
// this file only counts up the power level, lets you tap to skip, and
// removes the intro from the page when it's done.
(function () {
  var el = document.getElementById("intro");
  if (!el) return;
  function end() {
    if (!el || !el.parentNode) return;
    el.classList.add("out");
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 400);
  }
  // Automated test browsers skip the intro so tests can use the app at once.
  if (navigator.webdriver) {
    el.parentNode.removeChild(el);
    return;
  }
  el.addEventListener("click", end);
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(end, reduce ? 550 : 2400);
  if (reduce) return;
  var pw = document.getElementById("ipw"),
    t0 = performance.now();
  (function tick(t) {
    var p = Math.min(1, Math.max(0, (t - t0 - 350) / 1200));
    if (pw) pw.textContent = Math.round(9001 * p * p).toLocaleString("en");
    if (p < 1 && el.parentNode) requestAnimationFrame(tick);
  })(t0);
})();
