"use strict";

/*
 * SIGIL — sfondi vivi.
 *
 * Loop continuo: ogni video ha due copie sovrapposte. Quando quella in vista
 * sta per finire, l'altra riparte da capo e sfuma sopra di lei. Niente stacco,
 * niente "avanti e indietro".
 *
 * Arene dipinte: il quadro resta fermo, sopra scorrono nebbia (sempre nella
 * stessa direzione) e particelle (braci, fuochi fatui, pioggia, polvere).
 */
(function (root) {
  var FADE_DEFAULT = 2.2; // secondi di dissolvenza tra le due copie (le schermate usano 3)
  var RATE = 0.8;     // velocità dei video: più lenta, più calma

  var ARENE = [
    { id: "valle", name: "Valle delle tre rovine", video: "art/arene/valle.mp4", fx: "dust" },
    { id: "cripta", name: "Cripta del Silenzio", video: "art/arene/cripta.mp4", fx: "dust" },
    // Il dipinto resta come immagine di riserva finché il video non è caricato.
    { id: "palude", name: "Palude dei Rovi", video: "art/arene/palude.mp4", image: "art/arene/palude.jpg", fx: "none" },
    { id: "porto", name: "Porto del Leviatano", video: "art/arene/porto.mp4", image: "art/arene/porto.jpg", fx: "none" },
    { id: "piana", name: "Piana del drago", video: "art/arene/piana.mp4", image: "art/arene/piana.jpg", fx: "none" }
  ];

  function reduced() {
    return root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ───────── video in loop continuo ───────── */
  function Looper(host, src, opts) {
    opts = opts || {};
    var rate = opts.rate || RATE;
    var FADE = opts.fade || FADE_DEFAULT;
    var stopped = false;
    var swapping = false;
    function make(z) {
      var v = document.createElement("video");
      v.className = "loop-video" + (opts.mirror ? " mirror" : "");
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.setAttribute("muted", "");
      v.preload = "auto";
      v.src = src;
      v.style.zIndex = z;
      v.style.opacity = "0";
      v.style.transition = "opacity " + FADE + "s linear";
      host.appendChild(v);
      return v;
    }
    var cur = make(1);
    var nxt = make(2);
    function safePlay(v) {
      v.playbackRate = rate;
      var p = v.play();
      if (p && p.catch) p.catch(function () { /* autoplay negato: resta il poster */ });
    }
    cur.addEventListener("loadedmetadata", function first() {
      cur.removeEventListener("loadedmetadata", first);
      if (opts.randomStart && cur.duration > FADE * 3) cur.currentTime = Math.random() * (cur.duration - FADE * 3);
      safePlay(cur);
      cur.style.opacity = "1";
    });
    if (opts.onReady) cur.addEventListener("playing", function ready() {
      cur.removeEventListener("playing", ready);
      opts.onReady();
    });
    function tick() {
      if (stopped) return;
      if (!swapping && cur.duration && !cur.paused) {
        var left = (cur.duration - cur.currentTime) / rate;
        if (left < FADE + 0.15) {
          swapping = true;
          nxt.currentTime = 0;
          safePlay(nxt);
          nxt.style.zIndex = "2";
          cur.style.zIndex = "1";
          nxt.style.opacity = "1";
          setTimeout(function () {
            if (stopped) return;
            cur.pause();
            cur.style.transition = "none";
            cur.style.opacity = "0";
            void cur.offsetWidth;
            cur.style.transition = "opacity " + FADE + "s linear";
            var t = cur; cur = nxt; nxt = t;
            swapping = false;
          }, FADE * 1000 + 50);
        }
      }
      timer = setTimeout(tick, 120);
    }
    var timer = setTimeout(tick, 120);
    return {
      stop: function () {
        stopped = true;
        clearTimeout(timer);
        [cur, nxt].forEach(function (v) { v.pause(); v.removeAttribute("src"); v.load(); v.remove(); });
      }
    };
  }

  /* ───────── particelle ───────── */
  function Fx(canvas, kind) {
    var g = canvas.getContext("2d");
    var parts = [];
    var raf = 0;
    var w = 0;
    var h = 0;
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    var COUNT = { embers: 70, wisps: 18, rain: 160, dust: 45 }[kind] || 0;
    function size() {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(p, initial) {
      p.x = Math.random() * w;
      if (kind === "embers") { p.y = initial ? Math.random() * h : h + 10; p.vy = -(0.25 + Math.random() * 0.6); p.vx = (Math.random() - 0.5) * 0.25; p.r = 0.8 + Math.random() * 1.8; p.life = 0; p.max = 500 + Math.random() * 600; }
      else if (kind === "wisps") { p.y = h * (0.45 + Math.random() * 0.5); p.vy = (Math.random() - 0.5) * 0.08; p.vx = 0.05 + Math.random() * 0.12; p.r = 4 + Math.random() * 7; p.life = initial ? Math.random() * 900 : 0; p.max = 900 + Math.random() * 900; }
      else if (kind === "rain") { p.y = initial ? Math.random() * h : -20; p.vy = 7 + Math.random() * 5; p.vx = -2.2; p.len = 10 + Math.random() * 14; p.life = 0; p.max = 9999; }
      else { p.y = Math.random() * h; p.vy = -(0.03 + Math.random() * 0.08); p.vx = (Math.random() - 0.5) * 0.08; p.r = 0.6 + Math.random() * 1.2; p.life = initial ? Math.random() * 1200 : 0; p.max = 1200 + Math.random() * 1200; }
      p.phase = Math.random() * Math.PI * 2;
      return p;
    }
    function frame() {
      g.clearRect(0, 0, w, h);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.life++;
        p.phase += 0.02;
        p.x += p.vx + (kind === "embers" ? Math.sin(p.phase) * 0.25 : 0);
        p.y += p.vy;
        var fade = Math.min(1, p.life / 60) * Math.max(0, 1 - p.life / p.max);
        if (kind === "embers") {
          g.fillStyle = "rgba(255," + (140 + Math.round(60 * Math.sin(p.phase))) + ",60," + (0.75 * fade) + ")";
          g.shadowColor = "rgba(255,150,60,0.9)";
          g.shadowBlur = 8;
          g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
          if (p.y < -10 || p.life > p.max) spawn(p, false);
        } else if (kind === "wisps") {
          var a = fade * (0.35 + 0.3 * Math.sin(p.phase * 1.3));
          var grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
          grd.addColorStop(0, "rgba(170,255,170," + a + ")");
          grd.addColorStop(1, "rgba(80,200,120,0)");
          g.shadowBlur = 0;
          g.fillStyle = grd;
          g.beginPath(); g.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2); g.fill();
          if (p.life > p.max || p.x > w + 30) spawn(p, false);
        } else if (kind === "rain") {
          g.shadowBlur = 0;
          g.strokeStyle = "rgba(190,210,230,0.18)";
          g.lineWidth = 1;
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + p.vx * 2, p.y + p.len); g.stroke();
          if (p.y > h + 20) spawn(p, false);
        } else {
          g.shadowBlur = 0;
          g.fillStyle = "rgba(255,225,170," + (0.35 * fade) + ")";
          g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
          if (p.life > p.max) spawn(p, false);
        }
      }
      raf = root.requestAnimationFrame(frame);
    }
    size();
    for (var i = 0; i < COUNT; i++) parts.push(spawn({}, true));
    var onResize = function () { size(); };
    root.addEventListener("resize", onResize);
    if (COUNT && !reduced()) raf = root.requestAnimationFrame(frame);
    return {
      stop: function () {
        root.cancelAnimationFrame(raf);
        root.removeEventListener("resize", onResize);
        g.clearRect(0, 0, w, h);
      }
    };
  }

  /* ───────── arena in partita ───────── */
  var current = null;
  function arenaFor(seedOrId) {
    if (typeof seedOrId === "string") {
      for (var i = 0; i < ARENE.length; i++) if (ARENE[i].id === seedOrId) return ARENE[i];
    }
    return ARENE[(Number(seedOrId) >>> 0) % ARENE.length];
  }
  function mountArena(seed) {
    unmountArena();
    var a = arenaFor(seed);
    var wrap = document.getElementById("arena");
    var media = document.getElementById("arenaMedia");
    var canvas = document.getElementById("arenaFx");
    if (!wrap || !media) return a;
    wrap.setAttribute("data-arena", a.id);
    media.innerHTML = "";
    media.style.backgroundImage = a.image ? "url('" + a.image + "')" : "url('art/copertina.jpg')";
    var parts = [];
    if (a.video && !reduced()) parts.push(Looper(media, a.video, { randomStart: true }));
    if (a.fog) {
      var fog = document.createElement("div");
      fog.className = "fog";
      media.appendChild(fog);
      var fog2 = document.createElement("div");
      fog2.className = "fog fog-2";
      media.appendChild(fog2);
    }
    if (canvas) parts.push(Fx(canvas, a.fx));
    wrap.classList.add("on");
    current = { arena: a, parts: parts };
    return a;
  }
  function unmountArena() {
    var wrap = document.getElementById("arena");
    if (wrap) wrap.classList.remove("on");
    if (!current) return;
    current.parts.forEach(function (p) { p.stop(); });
    var media = document.getElementById("arenaMedia");
    if (media) media.innerHTML = "";
    current = null;
  }

  /* ───────── schermata del titolo ───────── */
  var menuLoop = null;
  function startMenu() {
    if (menuLoop || reduced()) return;
    var host = document.getElementById("menuLive");
    if (!host) return;
    // La soglia (Gemini, 14 nov): la valle delle tre torri e il Custode di spalle, a destra.
    // Il file è già un loop senza stacco (la fine sfuma nell'inizio).
    menuLoop = Looper(host, "art/arene/soglia.mp4", { rate: 0.85, fade: 1.2 });
  }
  function stopMenu() {
    if (!menuLoop) return;
    menuLoop.stop();
    menuLoop = null;
  }

  /* ───────── schermate vive ─────────
   * Quando una schermata si apre, sotto i contenuti parte il suo video in loop;
   * quando si chiude, il video si ferma. Finché il video non gira (o se manca),
   * resta visibile il dipinto fisso dello sfondo CSS. */
  var SCHERMATE = {
    "oath-sheet": "art/arene/giuramento.mp4",
    "deck-sheet": "art/arene/collezione.mp4",
    "duel-sheet": "art/arene/duello.mp4",
    "shop-sheet": "art/arene/bottega.mp4"
  };
  var missing = {};
  function videoFor(el) {
    for (var cls in SCHERMATE) if (el.classList && el.classList.contains(cls)) return SCHERMATE[cls];
    return null;
  }
  function syncSheet(el) {
    var src = videoFor(el);
    if (!src) return;
    var open = !el.hidden && !reduced() && !missing[src];
    if (open && !el._live) {
      var layer = document.createElement("div");
      layer.className = "sheet-live";
      layer.setAttribute("aria-hidden", "true");
      el.insertBefore(layer, el.firstChild);
      // Dissolvenza lunga: il primo e l'ultimo fotogramma differiscono poco, e così il salto si spalma su ~90 fotogrammi.
      var loop = Looper(layer, src, { randomStart: true, fade: 3, onReady: function () { layer.classList.add("ready"); } });
      layer.querySelector("video").addEventListener("error", function () {
        missing[src] = true; // il video non c'è ancora: resta il dipinto
        syncSheet(el);
      });
      el._live = { layer: layer, loop: loop };
    } else if (!open && el._live) {
      el._live.loop.stop();
      el._live.layer.remove();
      el._live = null;
    }
  }
  function watchSheets() {
    if (!root.MutationObserver || !document.body) return;
    Array.prototype.forEach.call(document.querySelectorAll(".sheet"), syncSheet);
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        if (m.type === "attributes") syncSheet(m.target);
        else Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 && n.classList.contains("sheet")) syncSheet(n); });
      });
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchSheets);
    else watchSheets();
  }

  /* ───────── intro: una volta per sessione ───────── */
  function playIntro(done) {
    var el = document.getElementById("intro");
    var seen = false;
    try { seen = sessionStorage.getItem("sigil-intro") === "1"; } catch (err) { /* ignora */ }
    if (!el || seen || reduced()) { if (done) done(); return; }
    try { sessionStorage.setItem("sigil-intro", "1"); } catch (err) { /* ignora */ }
    document.body.classList.add("intro-on");
    el.removeAttribute("hidden");
    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      el.classList.add("leaving");
      document.body.classList.remove("intro-on");
      setTimeout(function () { el.setAttribute("hidden", ""); el.classList.remove("leaving"); }, 1400);
      root.removeEventListener("keydown", close);
      if (done) done();
    }
    el.addEventListener("click", close);
    root.addEventListener("keydown", close);
    setTimeout(close, 9500);
  }

  root.SigilLive = {
    ARENE: ARENE,
    arenaFor: arenaFor,
    mountArena: mountArena,
    unmountArena: unmountArena,
    startMenu: startMenu,
    stopMenu: stopMenu,
    playIntro: playIntro
  };
})(typeof window !== "undefined" ? window : this);
