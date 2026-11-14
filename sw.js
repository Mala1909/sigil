/*
 * SIGIL — service worker: rende il gioco installabile come app (desktop e telefono)
 * e lo fa aprire anche senza rete.
 *
 * - Pagina, script e stili: prima la rete (così ogni aggiornamento arriva subito),
 *   la copia salvata solo se la rete manca.
 * - Illustrazioni: prima la copia salvata (non cambiano: il nome porta la versione).
 * - Video, registro dei Custodi (Supabase) e Duello (PeerJS): sempre dalla rete.
 */
// Pagina, script e stili si chiedono sempre al sito (cache "no-cache": il browser
// ricontrolla anche se GitHub Pages dice di tenerli 10 minuti), così l'app non
// resta mai indietro di una versione.
var CACHE = "sigil-v5";
var CORE = ["./", "index.html", "styles.css", "manifest.webmanifest", "icon.svg", "icons/icon-192.png",
  "engine.js", "paint.js", "live.js", "game.js", "cloud.js", "viaggio.js", "duello.js", "collezione.js", "negozio.js", "account.js", "anteprima.js", "musica.js", "impostazioni.js"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(CORE.map(function (u) { return new Request(u, { cache: "reload" }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function put(req, res) {
  if (res && res.ok && res.type === "basic") {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
  }
  return res;
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;           // Supabase, PeerJS, font: rete
  if (/\.(mp4|webm|mp3|ogg)$/i.test(url.pathname)) return;      // i video usano richieste a pezzi
  if (/\.(jpe?g|png|webp|svg)$/i.test(url.pathname)) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) { return put(req, res); });
    }));
    return;
  }
  e.respondWith(fetch(req, { cache: "no-cache" }).then(function (res) { return put(req, res); }, function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error());
    });
  }));
});
