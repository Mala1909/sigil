"use strict";

/*
 * SIGIL — Gli effetti tra le carte (16 nov 2026).
 *
 * Quando una carta si rivela e cambia la forza di altre carte, si vede: un raggio parte dalla carta
 * e raggiunge ognuna di quelle che tocca. D'oro e scintillante se le rafforza, viola e fumoso se le
 * maledice; sul bersaglio scoppia la luce e sale il numero (+3, −1). Inoltre:
 *   rivelazione ... un'onda nel colore della casata (più forte per le carte care, che fanno tremare il tavolo)
 *   distruzione ... la carta si spezza in frammenti che volano via tra le braci
 *   spostamento ... la carta vola da una rovina all'altra lasciando una scia
 *   ritorno ....... la carta torna in mano come una cometa
 *   effetti senza una carta che li lancia (la Forgia, la Piaga a fine ora…): il raggio parte dalla rovina.
 *
 * Il motore racconta gli effetti solo a parole: qui si confronta il tavolo prima e dopo ogni passo
 * (ogni volta che game.js lo ridisegna) e si capisce cosa è successo, a chi e da chi.
 */
(function () {
  var G = window.SigilGame, E = window.Lume;
  var board = document.getElementById("board");
  var app = document.getElementById("app");
  if (!G || !E || !board || !app) return;
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var HOUSE = { guardia: [214, 162, 78], selva: [116, 178, 122], congrega: [180, 131, 230], tesoro: [79, 183, 198], fondo: [214, 101, 79], misto: [201, 191, 174] };
  var GOLD = [255, 205, 110], CURSE = [170, 120, 255];

  /* ───────── il livello degli effetti ───────── */
  var layer = document.createElement("div");
  layer.className = "fx-layer";
  layer.setAttribute("aria-hidden", "true");
  var cv = document.createElement("canvas");
  layer.appendChild(cv);
  document.body.appendChild(layer);
  var ctx = cv.getContext("2d");
  var dpr = 1;
  function fit() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(window.innerWidth * dpr); cv.height = Math.round(window.innerHeight * dpr);
  }
  fit();
  window.addEventListener("resize", fit);

  var fx = []; // effetti vivi: { kind, t0, dur, ... }
  var running = false;
  function add(e) { e.t0 = performance.now() / 1000 + (e.delay || 0); fx.push(e); if (!running) { running = true; requestAnimationFrame(loop); } }

  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")"; }
  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function center(r) { return [r.left + r.width / 2, r.top + r.height / 2]; }

  // luce morbida
  function glow(x, y, r, c, a) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a)); g.addColorStop(.35, rgba(c, a * .45)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
  }
  // punto su una curva di Bézier quadratica
  function bez(a, c, b, u) { var v = 1 - u; return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]; }

  function draw(e, now) {
    var t = now - e.t0;
    if (t < 0) return true;
    var k = t / e.dur;
    if (k >= 1) { if (e.done) e.done(); return false; }
    var D = dpr;
    switch (e.kind) {
      case "beam": {
        // un nastro di luce che corre da una carta all'altra, con la testa più chiara
        var head = ease(Math.min(1, t / .42)), tail = Math.max(0, head - .38 - Math.max(0, t - .42) * 2.2);
        var pts = [];
        for (var i = 0; i <= 26; i++) { var u = tail + (head - tail) * i / 26; pts.push(bez(e.a, e.c, e.b, u)); }
        var fade = t < .42 ? 1 : Math.max(0, 1 - (t - .42) / .35);
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        if (e.curse) {
          // sotto la luce viola, un nastro di fumo scuro
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = "rgba(20,8,32," + (.45 * fade).toFixed(3) + ")"; ctx.lineWidth = 16 * D;
          ctx.beginPath(); pts.forEach(function (p, j) { if (j) ctx.lineTo(p[0] * D, p[1] * D); else ctx.moveTo(p[0] * D, p[1] * D); }); ctx.stroke();
          ctx.globalCompositeOperation = "lighter";
        }
        [[22, .1], [10, .28], [3.4, .95]].forEach(function (L) {
          ctx.strokeStyle = L[1] > .5 ? rgba(e.core, L[1] * fade) : rgba(e.col, L[1] * fade);
          ctx.lineWidth = L[0] * D;
          ctx.beginPath(); pts.forEach(function (p, j) { if (j) ctx.lineTo(p[0] * D, p[1] * D); else ctx.moveTo(p[0] * D, p[1] * D); }); ctx.stroke();
        });
        var hp = bez(e.a, e.c, e.b, head);
        glow(hp[0] * D, hp[1] * D, 34 * D, e.col, .85 * fade); glow(hp[0] * D, hp[1] * D, 10 * D, [255, 252, 240], .9 * fade);
        // lungo la strada perde scintille (o fumo, se è una maledizione)
        if (t < .42 && Math.random() < .9) add({ kind: e.curse ? "smoke" : "spark", x: hp[0], y: hp[1], vx: rnd(-40, 40), vy: rnd(-60, 20), dur: e.curse ? .9 : .45, col: e.col, r: e.curse ? rnd(6, 12) : 0 });
        if (!e.hit && t >= .42) { e.hit = true; impact(e.b, e.curse, e.col); }
        return true;
      }
      case "ring": {
        var r = (e.r0 + (e.r1 - e.r0) * ease(k)) * D;
        ctx.strokeStyle = rgba(e.col, (1 - k) * e.a); ctx.lineWidth = (e.w || 3) * (1 - k * .7) * D;
        ctx.beginPath(); ctx.arc(e.x * D, e.y * D, r, 0, 6.283); ctx.stroke();
        return true;
      }
      case "flash": glow(e.x * D, e.y * D, e.r * D * (1 + k * .4), e.col, (1 - k) * (e.a || 1)); return true;
      case "spark": {
        e.x += e.vx * (1 / 60); e.y += e.vy * (1 / 60); e.vy += (e.g || 260) * (1 / 60);
        var L = 7 * D, sp = Math.hypot(e.vx, e.vy) || 1;
        ctx.strokeStyle = rgba(e.col, (1 - k) * 1.1); ctx.lineWidth = 1.6 * D; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(e.x * D, e.y * D); ctx.lineTo((e.x - e.vx / sp * L / D * (1.5 + sp / 300)) * D, (e.y - e.vy / sp * L / D * (1.5 + sp / 300)) * D); ctx.stroke();
        glow(e.x * D, e.y * D, 5 * D, [255, 245, 220], (1 - k) * .8);
        return true;
      }
      case "smoke": {
        e.x += e.vx / 60; e.y += e.vy / 60; e.vy -= 20 / 60;
        ctx.globalCompositeOperation = "source-over";
        var rr = (e.r + k * e.r * 1.6) * D;
        var g = ctx.createRadialGradient(e.x * D, e.y * D, 0, e.x * D, e.y * D, rr);
        g.addColorStop(0, "rgba(40,18,60," + ((1 - k) * .45).toFixed(3) + ")"); g.addColorStop(1, "rgba(40,18,60,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x * D, e.y * D, rr, 0, 6.283); ctx.fill();
        ctx.globalCompositeOperation = "lighter";
        glow(e.x * D, e.y * D, rr * .6, e.col, (1 - k) * .25);
        return true;
      }
      case "shard": {
        // un frammento della carta che vola via e si consuma
        e.x += e.vx / 60; e.y += e.vy / 60; e.vy += 380 / 60; e.rot += e.vr / 60;
        ctx.globalCompositeOperation = "source-over";
        ctx.save(); ctx.translate(e.x * D, e.y * D); ctx.rotate(e.rot); ctx.globalAlpha = Math.max(0, 1 - k * 1.1);
        try { ctx.drawImage(e.img, e.sx, e.sy, e.sw, e.sh, -e.w / 2 * D, -e.h / 2 * D, e.w * D, e.h * D); } catch (x) { /* immagine non pronta */ }
        ctx.strokeStyle = rgba([255, 150, 60], (1 - k) * .9); ctx.lineWidth = 1.2 * D; ctx.strokeRect(-e.w / 2 * D, -e.h / 2 * D, e.w * D, e.h * D);
        ctx.restore(); ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "lighter";
        if (Math.random() < .25) add({ kind: "spark", x: e.x, y: e.y, vx: rnd(-30, 30), vy: rnd(-90, -20), g: -40, dur: .5, col: [255, 140, 50] });
        return true;
      }
      case "comet": {
        var hh = ease(k), tl = Math.max(0, hh - .3);
        var pts2 = []; for (var j = 0; j <= 18; j++) pts2.push(bez(e.a, e.c, e.b, tl + (hh - tl) * j / 18));
        ctx.lineCap = "round";
        [[12, .15], [4, .5], [1.6, 1]].forEach(function (L) {
          ctx.strokeStyle = rgba(L[1] === 1 ? [255, 248, 230] : e.col, L[1] * (1 - k * .5)); ctx.lineWidth = L[0] * D;
          ctx.beginPath(); pts2.forEach(function (p, n) { if (n) ctx.lineTo(p[0] * D, p[1] * D); else ctx.moveTo(p[0] * D, p[1] * D); }); ctx.stroke();
        });
        var hp2 = bez(e.a, e.c, e.b, hh); glow(hp2[0] * D, hp2[1] * D, 26 * D, e.col, .9 * (1 - k * .3));
        if (!e.hit && k > .92) { e.hit = true; add({ kind: "ring", x: e.b[0], y: e.b[1], r0: 6, r1: 50, col: e.col, a: .9, dur: .5 }); }
        return true;
      }
      case "card": {
        // un velo di luce sopra la carta (rivelazione)
        var a = (1 - k) * (k < .15 ? k / .15 : 1);
        ctx.fillStyle = rgba(e.col, a * .35);
        roundRect(e.r.left * D, e.r.top * D, e.r.width * D, e.r.height * D, 6 * D); ctx.fill();
        ctx.strokeStyle = rgba(e.col, a); ctx.lineWidth = 2 * D;
        roundRect((e.r.left - k * 6) * D, (e.r.top - k * 6) * D, (e.r.width + k * 12) * D, (e.r.height + k * 12) * D, 8 * D); ctx.stroke();
        return true;
      }
    }
    return false;
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function loop() {
    var now = performance.now() / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = "lighter";
    var keep = [];
    for (var i = 0; i < fx.length; i++) if (draw(fx[i], now)) keep.push(fx[i]);
    fx = keep; // (gli effetti nati durante il giro sono già passati dal ciclo qui sopra)
    if (fx.length) requestAnimationFrame(loop);
    else { running = false; ctx.clearRect(0, 0, cv.width, cv.height); }
  }

  /* ───────── colpi e numeri ───────── */
  function number(p, text, curse) {
    var s = document.createElement("span");
    s.className = "fx-num " + (curse ? "down" : "up");
    s.textContent = text;
    s.style.left = p[0] + "px"; s.style.top = p[1] + "px";
    layer.appendChild(s);
    setTimeout(function () { s.remove(); }, 1300);
  }
  function impact(p, curse, col) {
    add({ kind: "flash", x: p[0], y: p[1], r: 46, col: col, a: .9, dur: .45 });
    add({ kind: "ring", x: p[0], y: p[1], r0: 8, r1: curse ? 52 : 64, col: col, a: 1, w: curse ? 4 : 3, dur: .55 });
    for (var i = 0; i < (curse ? 7 : 14); i++) {
      var an = Math.random() * 6.283, sp = rnd(120, 300);
      if (curse) add({ kind: "smoke", x: p[0], y: p[1], vx: Math.cos(an) * sp * .3, vy: Math.sin(an) * sp * .3, r: rnd(8, 16), col: col, dur: 1 });
      else add({ kind: "spark", x: p[0], y: p[1], vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 80, col: col, dur: .55 });
    }
  }
  function shake(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  /* ───────── cosa è successo ───────── */
  var prev = null, prevMatch = null;
  function snapshot() {
    var m = G.match && G.match();
    if (!m) return null;
    var view = E.view(m);
    var snap = { map: {}, hand: {}, lanes: view.lanes.length };
    view.lanes.forEach(function (lane, li) {
      [["you", lane.yours], ["rival", lane.rivals]].forEach(function (pair) {
        pair[1].forEach(function (c) {
          if (!c.uid) return;
          var el = board.querySelector('.piece[data-uid="' + c.uid + '"]');
          var r = el ? el.getBoundingClientRect() : null;
          var img = el ? el.querySelector("img") : null;
          snap.map[c.uid] = { uid: c.uid, lane: li, side: pair[0], power: c.current, shown: !c.hidden && c.revealed !== false, house: c.house, cost: c.cost, rect: r, img: img && img.complete ? img : null, el: el };
        });
      });
    });
    (view.hand || []).forEach(function (c) { snap.hand[c.uid] = true; });
    snap.phase = view.phase;
    return snap;
  }
  function plaqueCenter(li) {
    var p = board.querySelectorAll(".plaque")[li];
    return p ? center(p.getBoundingClientRect()) : null;
  }

  function react() {
    var m = G.match && G.match();
    var now = snapshot();
    if (!now || m !== prevMatch) { prev = now; prevMatch = m; return; }
    if (REDUCED || !prev) { prev = now; return; }
    var revealed = [], deltas = [];
    Object.keys(now.map).forEach(function (uid) {
      var a = prev.map[uid], b = now.map[uid];
      if (!b.rect) return;
      if (b.shown && (!a || !a.shown)) revealed.push(b);
      else if (a && a.shown && b.shown && a.power !== b.power) deltas.push({ card: b, d: b.power - a.power });
      if (a && a.shown && b.shown && a.lane !== b.lane && a.rect) {
        var A = center(a.rect), B = center(b.rect);
        add({ kind: "comet", a: A, b: B, c: [(A[0] + B[0]) / 2, Math.min(A[1], B[1]) - 80], col: HOUSE[b.house] || GOLD, dur: .6 });
      }
    });
    // carte sparite dal tavolo: distrutte, o tornate in mano
    Object.keys(prev.map).forEach(function (uid) {
      var a = prev.map[uid];
      if (now.map[uid] || !a.shown || !a.rect) return;
      if (now.hand[uid]) {
        var A = center(a.rect), B = [window.innerWidth / 2, window.innerHeight - 60];
        add({ kind: "comet", a: A, b: B, c: [A[0], B[1] - 140], col: [150, 220, 255], dur: .7 });
      } else shatter(a);
    });
    // rivelazioni
    revealed.forEach(function (c, i) {
      var col = HOUSE[c.house] || GOLD, p = center(c.rect), big = c.cost >= 5;
      add({ kind: "card", r: c.rect, col: col, dur: .55, delay: i * .05 });
      add({ kind: "ring", x: p[0], y: p[1], r0: 10, r1: big ? 120 : 70, col: col, a: .9, w: big ? 5 : 3, dur: big ? .8 : .55 });
      add({ kind: "flash", x: p[0], y: p[1], r: big ? 90 : 55, col: col, a: .7, dur: .5 });
      for (var s = 0; s < (big ? 16 : 8); s++) { var an = rnd(3.4, 6.0), sp = rnd(80, big ? 260 : 170); add({ kind: "spark", x: p[0], y: c.rect.bottom - 4, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * .5, col: col, dur: .5 }); }
      if (big) shake(app, "fx-quake");
    });
    // chi ha cambiato la forza di chi: un raggio dalla carta appena rivelata (o dalla rovina)
    deltas.forEach(function (dl, i) {
      var curse = dl.d < 0, col = curse ? CURSE : GOLD, T = center(dl.card.rect);
      var src = revealed.filter(function (r) { return r.uid !== dl.card.uid; });
      // la sorgente: la carta rivelata più vicina (stessa rovina se c'è), altrimenti la rovina stessa
      var S = null;
      if (src.length) {
        src.sort(function (x, y) { return (x.lane === dl.card.lane ? 0 : 1) - (y.lane === dl.card.lane ? 0 : 1); });
        S = center(src[0].rect); if (!curse) col = HOUSE[src[0].house] ? mix(HOUSE[src[0].house], GOLD) : GOLD;
      } else S = plaqueCenter(dl.card.lane);
      var label = (dl.d > 0 ? "+" : "−") + Math.abs(dl.d);
      if (!S || Math.hypot(S[0] - T[0], S[1] - T[1]) < 12) { impact(T, curse, col); number(T, label, curse); shake(dl.card.el, curse ? "fx-hurt" : "fx-boost"); return; }
      var C = [(S[0] + T[0]) / 2 + (T[1] - S[1]) * .18, (S[1] + T[1]) / 2 - Math.max(40, Math.abs(T[0] - S[0]) * .25)];
      add({ kind: "beam", a: S, b: T, c: C, col: col, core: curse ? [235, 210, 255] : [255, 250, 230], curse: curse, dur: .9, delay: i * .07,
        done: null });
      setTimeout(function () { number(T, label, curse); shake(board.querySelector('.piece[data-uid="' + dl.card.uid + '"]'), curse ? "fx-hurt" : "fx-boost"); }, 420 + i * 70);
    });
    prev = now;
  }
  function mix(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }

  // la carta si spezza: frammenti dell'illustrazione che volano via tra le braci
  function shatter(a) {
    var r = a.rect, img = a.img, p = center(r);
    add({ kind: "flash", x: p[0], y: p[1], r: 70, col: [255, 120, 50], a: .9, dur: .5 });
    add({ kind: "ring", x: p[0], y: p[1], r0: 10, r1: 80, col: [255, 140, 60], a: .9, w: 4, dur: .6 });
    if (!img) return;
    var cols = 4, rows = 5, w = r.width / cols, h = r.height / rows;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    // l'immagine nella carta è ritagliata come "cover": si ricava la parte visibile
    var s = Math.max(r.width / iw, r.height / ih), vw = r.width / s, vh = r.height / s, ox = (iw - vw) / 2, oy = (ih - vh) * .3;
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      var cx = r.left + (x + .5) * w, cy = r.top + (y + .5) * h;
      add({ kind: "shard", img: img, sx: ox + x * vw / cols, sy: oy + y * vh / rows, sw: vw / cols, sh: vh / rows, w: w, h: h,
        x: cx, y: cy, vx: (cx - p[0]) * rnd(2, 5) + rnd(-30, 30), vy: (cy - p[1]) * rnd(1.5, 3) - rnd(120, 260), rot: 0, vr: rnd(-6, 6), dur: rnd(.7, 1.1) });
    }
  }

  new MutationObserver(function () { try { react(); } catch (err) { prev = null; } }).observe(board, { childList: true });
  window.SigilEffetti = { add: add, impact: impact, shatter: shatter };
})();
