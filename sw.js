// sw.js — the "service worker": a small helper the browser runs in the
// background so the app opens even with no internet (e.g. bad gym signal).
//
// How it works:
// - On first visit it saves a copy of every app file on the phone.
// - Each time the app asks for a file, it tries the internet first, but gives
//   up after 3 seconds and uses the saved copy instead. Whenever the internet
//   answers, the saved copy is refreshed, so updates arrive automatically.
// - It never touches your workout logs. Those live in the browser's
//   localStorage, which this file does not read or change.
//
// When you add a new file to the app, add it to FILES below.
// Changing VERSION makes phones throw away the old saved copy.

var VERSION = "gc-v5";
var FILES = [
  "./",
  "index.html",
  "styles.css",
  "plan.js",
  "library.js",
  "editor.js",
  "app.js",
  "progress.js",
  "body.js",
  "timer.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches
      .open(VERSION)
      .then(function (c) {
        return c.addAll(FILES);
      })
      .then(function () {
        return self.skipWaiting();
      }),
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (k) {
            if (k !== VERSION) return caches.delete(k);
          }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(function (cache) {
      var fromNet = fetch(req).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      });
      var timeout = new Promise(function (resolve) {
        setTimeout(resolve, 3000);
      });
      var fromCache = function () {
        return cache.match(req, { ignoreSearch: true }).then(function (hit) {
          return hit || (req.mode === "navigate" ? cache.match("index.html") : undefined);
        });
      };
      // Whichever comes first: the internet answer, or the saved copy after 3 s.
      return Promise.race([fromNet.catch(function () {}), timeout]).then(function (res) {
        if (res) return res;
        return fromCache().then(function (hit) {
          return hit || fromNet;
        });
      });
    }),
  );
});
