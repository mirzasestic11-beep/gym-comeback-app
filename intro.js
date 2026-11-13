// intro.js — the opening power-up animation (original warrior from the app
// icon: scanner lights up, blue aura and power level build, hair turns gold,
// flash, then the app opens).
// The screen stays solid dark until the page has fully loaded, so the phone
// isn't busy setting up the app while the animation plays (that caused
// stutter and skipped steps). Then "go" starts the CSS timeline, and the intro
// is removed after it. Tap to skip at any time.
(function () {
  var el = document.getElementById("intro");
  if (!el) return;
  // Automated test browsers skip the intro so tests can use the app at once.
  if (navigator.webdriver) {
    el.parentNode.removeChild(el);
    return;
  }
  var started = false,
    done = false,
    reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function end() {
    if (done) return;
    done = true;
    el.classList.add("out");
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 380);
  }
  el.addEventListener("click", end);
  function count() {
    var pw = document.getElementById("ipw"),
      t0 = performance.now();
    (function tick(t) {
      var p = Math.min(1, Math.max(0, (t - t0 - 400) / 1150));
      if (pw) pw.textContent = Math.round(9001 * p * p).toLocaleString("en");
      if (p < 1 && !done) requestAnimationFrame(tick);
    })(t0);
  }
  function start() {
    if (started || done) return;
    started = true;
    if (reduce) {
      el.classList.add("go");
      setTimeout(end, 500);
      return;
    }
    // two frames later, so the first frame of the animation is drawn cleanly
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add("go");
        count();
        setTimeout(end, 2600); // flash ends ~2.55 s, then a quick fade
      });
    });
  }
  function ready() {
    // wait for the fonts too (at most 1.2 s), then start
    var f = document.fonts && document.fonts.ready;
    var timer = setTimeout(start, 1200);
    if (f)
      f.then(function () {
        clearTimeout(timer);
        start();
      });
    else start();
  }
  if (document.readyState == "complete") ready();
  else window.addEventListener("load", ready);
  // never wait more than 4 s for loading
  setTimeout(start, 4000);
})();
