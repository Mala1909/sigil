"use strict";

/*
 * SIGIL — Le evoluzioni delle carte (15 nov 2026).
 *
 * Ogni carta che possiedi ha un livello estetico da 1 a 6, come gli upgrade di Marvel Snap:
 *   1 Pergamena · 2 Cornice di bronzo · 3 Rilievo (carta a strati 3D) · 4 Fuori cornice
 *   5 Viva (il dipinto riempie la carta, braci su più piani) · 6 Sigillo d'oro.
 * Salire costa inchiostro, che si guadagna giocando. Il server decide tutto (sigil_evolve);
 * qui si mostra la carta e si chiede l'evoluzione.
 *
 * La carta 3D: sfondo ridipinto e personaggio ritagliato (art/cards/3d/<id>/), ognuno con la sua
 * mappa di profondità, disegnati con WebGL e mossi dall'inclinazione del telefono, dal dito o dal mouse.
 * Se ne mostra una sola alla volta, per non pesare sul telefono.
 */
(function () {
  var G = window.SigilGame;
  var E = window.Lume;
  if (!G || !E) return;

  var ALL = E.ALL_CARDS || E.CARDS;
  var BY_ID = {};
  ALL.forEach(function (c) { BY_ID[c.id] = c; });
  var KIND = { none: "", ongoing: "Sempre", reveal: "Scopri", anchor: "Fermo" };
  var COST = { 2: 20, 3: 40, 4: 80, 5: 160, 6: 320 }; // come sigil_evo_cost sul server
  var LEVELS = [
    ["Pergamena", "La carta com'è appena trovata."],
    ["Cornice di bronzo", "Una cornice di metallo battuto, che si vede anche nel mazzo e al tavolo."],
    ["Rilievo", "La carta diventa a strati: il soggetto si stacca dal paesaggio e segue l'inclinazione."],
    ["Fuori cornice", "Il soggetto esce dal riquadro e sporge oltre il bordo della carta."],
    ["Viva", "Il dipinto riempie la carta; braci e polvere salgono su piani diversi."],
    ["Sigillo d'oro", "Lamina d'oro in rilievo, con un riflesso iridescente che segue la luce."]
  ];
  var V = "?v=4"; // 16 nov: profondità coerenti e lati tagliati
  var TOPS = null; // altezza del soggetto per carta (art/cards/3d/alto.json): serve per farlo uscire dal bordo
  var CUTS = null; // lati in cui il soggetto tocca il bordo del dipinto (art/cards/3d/bordi.json), es. "rb"
  function loadCuts() {
    if (CUTS) return Promise.resolve(CUTS);
    return fetch("art/cards/3d/bordi.json" + V).then(function (r) { return r.json(); }).then(function (j) { CUTS = j; return j; }, function () { CUTS = {}; return CUTS; });
  }
  // Dove il soggetto può uscire dalla carta: solo dai lati in cui il dipinto non lo taglia.
  // Sugli altri si ferma al bordo interno della cornice, così non si vede mai dove finisce il quadro.
  function clipFor(n, cut) {
    cut = cut || "";
    var inL = "calc(var(--w) * .08)", inR = "calc(100% - var(--w) * .08)";
    var l = cut.indexOf("l") >= 0 ? inL : "0px", r = cut.indexOf("r") >= 0 ? inR : "100%";
    var t = cut.indexOf("t") >= 0 ? "calc(var(--win-top) - var(--art-top))" : "0px";
    // dai lati il soggetto sporge solo nella metà alta; sotto resta nel riquadro, vicino al nome sembrerebbe un errore
    var sp = "calc(var(--w) * .55 - var(--art-top))";
    var bot = n >= 5 ? "calc(var(--win-top) + var(--win-h) - var(--art-top))" : "100%";
    return "polygon(" + [l + " " + t, r + " " + t, r + " " + sp, inR + " " + sp, inR + " " + bot, inL + " " + bot, inL + " " + sp, l + " " + sp].join(",") + ")";
  }
  function loadTops() {
    if (TOPS) return Promise.resolve(TOPS);
    return fetch("art/cards/3d/alto.json" + V).then(function (r) { return r.json(); }).then(function (j) { TOPS = j; return j; }, function () { TOPS = {}; return TOPS; });
  }

  function S() { return G.save(); }
  function owns(id) { var c = S().collection; return !!(c && c[id]); }
  function level(id) {
    if (!owns(id)) return 1;
    var e = S().evo || {};
    return Math.max(1, Math.min(6, Number(e[id]) || 1));
  }
  function ink() { return S().inchiostro || 0; }
  function esc(s) { return G.esc(s); }

  /* ───────── la carta a strati ───────── */
  var VS = "attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; v.y = 1. - v.y; gl_Position = vec4(p, 0., 1.); }";
  // I due strati si muovono con la stessa regola e la stessa profondità (16 nov): bgd è la profondità del
  // dipinto intero, e solo dietro al soggetto quella dello sfondo ridipinto. Così le parti che il ritaglio
  // non ha preso (una coda, un'ala di fiamme) restano attaccate al corpo invece di scivolare via.
  // Strato A: lo sfondo ridipinto, con un'ombra leggera del soggetto.
  var FS_A = [
    "precision mediump float;",
    "uniform sampler2D bg, bgd, fg; uniform vec2 tilt, light; uniform float k, shadowK; varying vec2 v;",
    "void main(){",
    "  vec2 uv = (v - .5) * .94 + .5;",
    "  vec2 o = vec2(0.);",
    "  for (int i = 0; i < 5; i++) { float d = texture2D(bgd, uv + o).r; o = tilt * (d - .55) * k; }",
    "  vec3 c = texture2D(bg, uv + o).rgb;",
    "  vec2 so = light * .012;",
    "  vec2 fu = uv + o - so;",
    "  float s = 0.;",
    "  for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) s += texture2D(fg, fu + vec2(float(i), float(j)) * .008).a;",
    "  s /= 25.;",
    "  c *= 1. - s * shadowK;",
    "  float vg = smoothstep(.95, .35, length((v - .5) * vec2(1., .8)));",
    "  gl_FragColor = vec4(c * (.82 + .18 * vg), 1.);",
    "}"].join("\n");
  // Strato B: il soggetto, con la stessa regola dello sfondo e una luce di bordo dal lato della luce.
  var FS_B = [
    "precision mediump float;",
    "uniform sampler2D fg, fgd; uniform vec2 tilt, light; uniform float k; varying vec2 v;",
    "void main(){",
    "  vec2 uv = (v - .5) * .94 + .5;",
    "  vec2 o = vec2(0.);",
    "  for (int i = 0; i < 5; i++) { float d = texture2D(fgd, uv + o).r; o = tilt * (d - .55) * k; }",
    "  uv += o;",
    "  vec4 c = texture2D(fg, uv);",
    "  float a2 = texture2D(fg, uv + light * .0022).a;",
    "  float rim = smoothstep(.25, .9, clamp(c.a - a2, 0., 1.));",
    "  c.rgb = mix(c.rgb, c.rgb * 1.35 + vec3(.10, .07, .03), rim * (.25 + .3 * length(tilt)));",
    "  gl_FragColor = vec4(c.rgb * c.a, c.a);",
    "}"].join("\n");

  function mkGL(canvas, fs, base, texs, cb) {
    var gl = null;
    try { gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true }); } catch (e) { gl = null; }
    if (!gl) return null;
    function sh(t, src) { var o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var l = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    var left = texs.length, ctx = { gl: gl, pr: pr, u: {}, dead: false };
    ["tilt", "light", "k", "shadowK", "shift"].forEach(function (n) { ctx.u[n] = gl.getUniformLocation(pr, n); });
    texs.forEach(function (t, unit) {
      var img = new Image();
      img.onload = function () {
        if (ctx.dead) return;
        var tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(gl.getUniformLocation(pr, t[1]), unit);
        if (--left === 0) cb();
      };
      img.onerror = function () { ctx.failed = true; };
      img.src = base + t[0] + V;
    });
    return ctx;
  }
  function kill(ctx) {
    if (!ctx) return;
    ctx.dead = true;
    var x = ctx.gl.getExtension("WEBGL_lose_context");
    if (x) x.loseContext();
  }
  function fit(c, ctx) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.round(c.offsetWidth * dpr), h = Math.round(c.offsetHeight * dpr);
    if (w && h && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; if (ctx) ctx.gl.viewport(0, 0, w, h); }
  }

  // Particelle del livello 5 e 6, nei colori della casata.
  var MOTES = {
    guardia: { ember: .6, hot: [255, 214, 140], warm: [255, 120, 40], dust: [235, 225, 205] },
    selva: { ember: .35, hot: [236, 240, 170], warm: [150, 190, 90], dust: [225, 230, 200] },
    congrega: { ember: .45, hot: [230, 200, 255], warm: [150, 90, 220], dust: [220, 210, 235] },
    tesoro: { ember: .55, hot: [255, 236, 170], warm: [230, 170, 50], dust: [240, 228, 200] },
    fondo: { ember: .35, hot: [200, 235, 255], warm: [90, 150, 200], dust: [210, 222, 230] },
    misto: { ember: .5, hot: [255, 214, 140], warm: [255, 120, 40], dust: [235, 225, 205] }
  };

  var live = null; // l'unica carta 3D attiva
  var gyro = { on: false, base: null, x: 0, y: 0, at: 0 };
  function onOrient(e) {
    if (e.gamma == null || e.beta == null) return;
    var g = e.gamma, b = e.beta;
    if (!gyro.base) gyro.base = { g: g, b: b };
    // la posizione "dritta" segue piano quella del telefono: tenuto fermo, la carta torna al centro
    gyro.base.g += (g - gyro.base.g) * .006; gyro.base.b += (b - gyro.base.b) * .006;
    gyro.x = Math.max(-1, Math.min(1, (g - gyro.base.g) / 20));
    gyro.y = Math.max(-1, Math.min(1, (b - gyro.base.b) / 20));
    gyro.at = performance.now();
  }
  // Il giroscopio: Android lo dà subito; iPhone lo chiede con un tocco (allora compare il tasto nel foglio).
  var gyroNeed = false, gyroTried = false;
  var touchy = window.matchMedia("(pointer: coarse)");
  function listen() { if (!gyro.on) { window.addEventListener("deviceorientation", onOrient); gyro.on = true; } }
  function needsPermission() { return gyroNeed && !gyro.on; }
  function startGyro() {
    if (gyro.on || gyroTried || !touchy.matches || !("ondeviceorientation" in window)) return;
    gyroTried = true;
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().then(function (r) { if (r === "granted") listen(); else gyroNeed = true; paintPanel(); },
        function () { gyroNeed = true; paintPanel(); });
    } else listen();
  }
  function askGyro() {
    return DeviceOrientationEvent.requestPermission().then(function (r) {
      if (r === "granted") listen();
      return r === "granted";
    }, function () { return false; });
  }

  // Monta una carta in un contenitore. opts: { w: larghezza in px, power: forza da mostrare }
  function mount(host, card, lv, opts) {
    opts = opts || {};
    if (live) live.destroy();
    var kind = KIND[card.kind] || G.houseName(card.house);
    var body = card.text ? esc(card.text) : '<span class="c3d-lore">' + esc(card.lore) + "</span>";
    var power = opts.power != null ? opts.power : card.power;
    var cost = card.cost;
    host.innerHTML =
      '<div class="c3d-scene"><div class="c3d" data-house="' + esc(card.house || "misto") + '" style="--w:' + (opts.w || 280) + 'px">' +
      '<div class="c3d-frame"></div><div class="c3d-ring"></div>' +
      '<div class="c3d-window"><img class="c3d-layer c3d-flat" alt=""><canvas class="c3d-layer c3d-a"></canvas><canvas class="c3d-layer c3d-back"></canvas></div>' +
      '<canvas class="c3d-layer c3d-fg"></canvas><canvas class="c3d-front"></canvas>' +
      '<span class="c3d-orb c3d-cost">' + esc(cost) + "</span>" +
      '<span class="c3d-house">' + G.glyph(card.house) + "</span>" +
      '<div class="c3d-info"><div class="c3d-name">' + esc(card.name) + '</div><div class="c3d-kind">' + esc(kind) + '</div><div class="c3d-text">' + body + "</div></div>" +
      '<span class="c3d-orb c3d-power">' + esc(power) + "</span>" +
      '<div class="c3d-sheen"></div><div class="c3d-burst"></div></div></div>';
    var scene = host.querySelector(".c3d-scene"), el = host.querySelector(".c3d");
    var flat = el.querySelector(".c3d-flat"), cA = el.querySelector(".c3d-a"), cB = el.querySelector(".c3d-fg");
    var back = el.querySelector(".c3d-back"), front = el.querySelector(".c3d-front");
    var bx = back.getContext("2d"), fx = front.getContext("2d");
    var base = "art/cards/3d/" + card.id + "/";
    var pal = MOTES[card.house] || MOTES.misto;
    var h = {
      card: card, el: el, level: lv, glOk: false, dead: false, A: null, B: null,
      setLevel: setLevel, destroy: destroy, burst: burst
    };
    var loaded = 0;
    function ready() { if (++loaded === 2 && !h.dead) { h.glOk = true; setLevel(h.level); } }
    function startGL() {
      if (h.A || h.dead) return;
      h.A = mkGL(cA, FS_A, base, [["bg.webp", "bg"], ["bg-d.png", "bgd"], ["fg.webp", "fg"]], ready);
      h.B = h.A && mkGL(cB, FS_B, base, [["fg.webp", "fg"], ["fg-d.png", "fgd"]], ready);
    }
    function setLevel(n) {
      h.level = n;
      el.className = "c3d lv" + n + (n >= 3 && h.glOk ? " gl" : "");
      flat.src = (n >= 3 ? base + "bg.webp" : "art/cards/" + card.id + ".jpg") + V;
      if (n >= 3) startGL();
      loadCuts().then(function (c) { if (!h.dead && h.level === n) cB.style.clipPath = cB.style.webkitClipPath = clipFor(n, c[card.id]); });
      // Livello 4: quanto si alza il dipinto perché il soggetto esca dal bordo (dipende da dove sta nel quadro).
      loadTops().then(function (t) {
        var top = t[card.id];
        // il dipinto sale finché la cima del soggetto sfiora il bordo alto (e lo supera appena);
        // le scene senza un soggetto (o con un soggetto piccolo e basso) restano quasi ferme
        var at = top == null || top > .42 ? -.05 : Math.max(-.62, Math.min(-.03, -.03 - top * 1.609));
        el.style.setProperty("--lift", at.toFixed(3));
      });
    }

    // Movimento: telefono, dito, mouse, e un lento "respiro" quando nessuno la tocca.
    var target = { x: 0, y: 0 }, last = 0, st = { x: 0, y: 0, vx: 0, vy: 0 }, drag = null, moved = false;
    function aim(e, k) {
      var r = el.getBoundingClientRect();
      target.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - .5) * k));
      target.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - .5) * k));
      last = performance.now();
    }
    function pmove(e) {
      if (e.pointerType === "mouse") { aim(e, 2.2); return; }
      if (drag && e.pointerId === drag.id) {
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 8) moved = true;
        aim(e, 2.4);
      }
    }
    function pdown(e) { if (e.pointerType !== "mouse") { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; moved = false; aim(e, 2.4); } }
    function pup(e) { if (drag && e.pointerId === drag.id) { drag = null; target.x = 0; target.y = 0; } }
    function pleave(e) { if (e.pointerType === "mouse") { target.x = 0; target.y = 0; } }
    // Inclinare col dito non deve diventare anche un tocco (che chiuderebbe il foglio).
    function eat(e) { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }
    scene.addEventListener("pointermove", pmove);
    scene.addEventListener("pointerdown", pdown);
    window.addEventListener("pointerup", pup);
    window.addEventListener("pointercancel", pup);
    scene.addEventListener("pointerleave", pleave);
    scene.addEventListener("click", eat, true);

    var motes = [];
    for (var i = 0; i < 46; i++) motes.push({ x: Math.random(), y: Math.random(), z: Math.random(), v: .00045 + Math.random() * .0011, a: Math.random() * 6.28, ember: Math.random() < pal.ember });
    function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
    function drawMotes(t) {
      [[bx, back, false], [fx, front, true]].forEach(function (L) {
        var ctx = L[0], c = L[1];
        fit(c);
        ctx.clearRect(0, 0, c.width, c.height);
        var dpr = c.width / (c.offsetWidth || 1);
        motes.forEach(function (m) {
          if ((m.z >= .55) !== L[2]) return;
          m.y -= m.v; m.a += .015 + m.z * .01;
          if (m.y < -.05) { m.y = 1.05; m.x = Math.random(); }
          var par = (m.z - .4) * 34 * dpr;
          var x = (m.x + Math.sin(m.a) * .012) * c.width + st.x * par, y = m.y * c.height + st.y * par;
          var r = (m.ember ? 1.4 + m.z * 2.6 : .8 + m.z * 1.6) * dpr;
          var flick = .65 + .35 * Math.sin(t * .004 + m.a * 3);
          var g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
          if (m.ember) { g.addColorStop(0, rgba(pal.hot, .95 * flick)); g.addColorStop(.35, rgba(pal.warm, .5 * flick)); g.addColorStop(1, rgba(pal.warm, 0)); }
          else { g.addColorStop(0, rgba(pal.dust, .45)); g.addColorStop(1, rgba(pal.dust, 0)); }
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, 6.283); ctx.fill();
        });
      });
    }
    var cleared = false;
    var prev = performance.now(), raf = 0;
    function frame(t) {
      if (h.dead) return;
      raf = requestAnimationFrame(frame);
      if (!el.isConnected || !el.offsetWidth) { destroy(); return; } // tolta o nascosta: si spegne
      var dt = Math.min(3, (t - prev) / 16.67); prev = t;
      var moving = h.level >= 3;
      var tx = target.x, ty = target.y;
      if (gyro.on && !drag && t - gyro.at < 1500) { tx = gyro.x; ty = gyro.y; last = gyro.at; }
      if (!moving) { tx *= .35; ty *= .35; }
      if (moving && !drag && t - last > 1800) { tx = Math.sin(t * .00055) * .16; ty = Math.cos(t * .0004) * .1; } // respiro a riposo
      // molla smorzata: arriva morbida, con un filo di rimbalzo
      st.vx += ((tx - st.x) * .075 - st.vx * .26) * dt; st.vy += ((ty - st.y) * .075 - st.vy * .26) * dt;
      st.x += st.vx * dt; st.y += st.vy * dt;
      var tl = Math.min(1, Math.hypot(st.x, st.y));
      el.style.setProperty("--tx", st.x.toFixed(4)); el.style.setProperty("--ty", st.y.toFixed(4)); el.style.setProperty("--tl", tl.toFixed(3));
      scene.style.setProperty("--tx", st.x.toFixed(4)); scene.style.setProperty("--tl", tl.toFixed(3));
      if (h.glOk && moving) {
        var light = [-.55 - st.x * .4, -.75 - st.y * .4];
        var A = h.A, B = h.B, g;
        fit(cA, A); g = A.gl;
        g.useProgram(A.pr); g.uniform2f(A.u.tilt, -st.x, -st.y); g.uniform2f(A.u.light, light[0], light[1]);
        var K = h.level >= 5 ? .046 : .04; // stesso spostamento per i due strati
        g.uniform1f(A.u.k, K); g.uniform1f(A.u.shadowK, .2);
        g.clearColor(0, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT); g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
        fit(cB, B); g = B.gl;
        g.useProgram(B.pr); g.uniform2f(B.u.tilt, -st.x, -st.y); g.uniform2f(B.u.light, light[0], light[1]);
        g.uniform1f(B.u.k, K);
        g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT); g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      }
      if (h.level >= 5) { drawMotes(t); cleared = false; }
      else if (!cleared) { bx.clearRect(0, 0, back.width, back.height); fx.clearRect(0, 0, front.width, front.height); cleared = true; }
    }
    function burst() {
      var b = el.querySelector(".c3d-burst");
      b.classList.remove("go"); void b.offsetWidth; b.classList.add("go");
      st.vy -= .9; st.vx += .4;
    }
    function destroy() {
      if (h.dead) return;
      h.dead = true;
      cancelAnimationFrame(raf);
      kill(h.A); kill(h.B);
      window.removeEventListener("pointerup", pup);
      window.removeEventListener("pointercancel", pup);
      if (live === h) live = null;
    }
    live = h;
    startGyro();
    setLevel(lv);
    raf = requestAnimationFrame(frame);
    return h;
  }

  /* ───────── il foglio della carta: guarda, prova i livelli, evolvi ───────── */
  var sheet = document.createElement("section");
  sheet.className = "evo-sheet";
  sheet.id = "evoSheet";
  sheet.hidden = true;
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "La carta");
  sheet.innerHTML =
    '<button type="button" class="evo-close" data-evo-close aria-label="Chiudi">×</button>' +
    '<div class="evo-stage" id="evoStage"></div>' +
    '<div class="evo-panel">' +
    '<div class="evo-dots" id="evoDots"></div>' +
    '<p class="evo-what" id="evoWhat"></p>' +
    '<div class="evo-act" id="evoAct"></div>' +
    '<button type="button" class="evo-motion" id="evoMotion" hidden>Muovi la carta inclinando il telefono</button>' +
    "</div>";
  document.body.appendChild(sheet);
  var cur = null; // { id, view, handle, busy, note }

  function stageWidth() {
    var vw = window.innerWidth, vh = window.innerHeight;
    // la carta è alta 1,44 volte la larghezza; sopra il tasto di chiusura, sotto livelli, spiegazione e tasto (~330px)
    return Math.round(Math.max(160, Math.min(330, vw * .78, (vh - 360) / 1.44)));
  }
  function paintPanel() {
    if (!cur) return;
    var id = cur.id, have = owns(id), lv = level(id), view = cur.view;
    var dots = "";
    for (var n = 1; n <= 6; n++) {
      dots += '<button type="button" class="evo-dot' + (n <= lv && have ? " got" : "") + (n === view ? " on" : "") + '" data-evo-view="' + n + '" aria-label="Livello ' + n + '">' +
        "<i></i><span>" + n + "</span></button>";
    }
    document.getElementById("evoDots").innerHTML = dots;
    var preview = !have || view > lv;
    document.getElementById("evoWhat").innerHTML = "<b>" + view + " · " + LEVELS[view - 1][0] + (preview ? ' <em>anteprima</em>' : "") + "</b>" + LEVELS[view - 1][1];
    var act = "";
    if (cur.note) act += '<p class="evo-note">' + esc(cur.note) + "</p>";
    if (!have) act += '<p class="evo-note">Questa carta non è ancora tua: quando la trovi, potrai farla salire.</p>';
    else if (lv >= 6) act += '<p class="evo-note gold">Al massimo: questa carta porta il Sigillo d’oro.</p>';
    else {
      var price = COST[lv + 1], can = ink() >= price;
      act += '<div class="evo-buy"><span class="evo-ink" title="Inchiostro">' + inkIcon() + ink() + "</span>" +
        '<button type="button" class="evo-up' + (can ? "" : " short") + '" data-evo-up' + (cur.busy ? " disabled" : "") + ">" +
        (cur.busy ? "Il registro annota…" : "Evolvi a " + LEVELS[lv][0] + '<small>' + inkIcon() + price + "</small>") + "</button></div>";
      if (!can) act += '<p class="evo-hint">L’inchiostro si guadagna giocando: ogni veglia ne lascia qualche goccia, il Duello di più.</p>';
    }
    document.getElementById("evoAct").innerHTML = act;
    document.getElementById("evoMotion").hidden = !(cur.view >= 3 && needsPermission());
  }
  function inkIcon() { return '<svg class="ink-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2C6 4.6 3.4 7.3 3.4 10a4.6 4.6 0 0 0 9.2 0C12.6 7.3 10 4.6 8 1.2z" fill="currentColor"/></svg>'; }

  function open(id, opts) {
    var card = BY_ID[id];
    if (!card) return;
    opts = opts || {};
    cur = { id: id, view: level(id), handle: null, busy: false, note: "" };
    sheet.hidden = false;
    document.documentElement.classList.add("evo-open");
    cur.handle = mount(document.getElementById("evoStage"), card, cur.view, { w: stageWidth() });
    paintPanel();
  }
  function close() {
    if (cur && cur.handle) cur.handle.destroy();
    cur = null;
    sheet.hidden = true;
    document.getElementById("evoStage").innerHTML = "";
    document.documentElement.classList.remove("evo-open");
    // le cornici nuove si vedono subito nel mazzo e nel grimorio
    window.dispatchEvent(new CustomEvent("sigil:evo"));
  }

  function evolve() {
    if (!cur || cur.busy) return;
    var id = cur.id, lv = level(id), price = COST[lv + 1];
    if (!price) return;
    if (ink() < price) { cur.note = "Ti mancano " + (price - ink()) + " gocce d’inchiostro."; paintPanel(); return; }
    var C = window.SigilCloud;
    var done = function () {
      if (!cur || cur.id !== id) return;
      cur.busy = false;
      cur.note = "";
      cur.view = level(id);
      cur.handle.setLevel(cur.view);
      cur.handle.burst();
      G.blip && G.blip("win");
      paintPanel();
    };
    if (C) {
      if (!C.online()) { cur.note = "Serve la rete: le evoluzioni le annota il registro dei Custodi."; paintPanel(); return; }
      cur.busy = true; cur.note = ""; paintPanel();
      C.evolve(id).then(done, function (e) {
        if (!cur) return;
        cur.busy = false;
        cur.note = e.message || "Il registro non risponde.";
        paintPanel();
      });
      return;
    }
    // Senza registro (anteprima locale): tutto resta in questo dispositivo.
    var s = S();
    s.inchiostro = ink() - price;
    s.evo = s.evo || {};
    s.evo[id] = lv + 1;
    G.persist();
    done();
  }

  sheet.addEventListener("click", function (e) {
    var t;
    if (e.target.closest("[data-evo-close]") || e.target === sheet) { close(); return; }
    if ((t = e.target.closest("[data-evo-view]"))) {
      cur.view = Number(t.dataset.evoView);
      cur.note = "";
      cur.handle.setLevel(cur.view);
      paintPanel();
      return;
    }
    if (e.target.closest("[data-evo-up]")) { evolve(); return; }
    if (e.target.closest("#evoMotion")) { askGyro().then(function () { paintPanel(); }); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && cur) close(); });
  // Ovunque nel gioco: un elemento con data-evo-open="<id>" apre la carta.
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-evo-open]");
    if (!t || t.closest(".evo-sheet")) return;
    e.preventDefault();
    e.stopPropagation();
    open(t.dataset.evoOpen);
  }, true);
  window.addEventListener("resize", function () {
    if (cur && cur.handle) cur.handle.el.style.setProperty("--w", stageWidth() + "px");
  });

  // Al tavolo: la carta grande (quella che stai per giocare) diventa 3D dal livello 3.
  function upgrade(cardEl, card, opts) {
    if (!cardEl || !card) return null;
    var lv = level(card.id);
    if (lv < 3) return null;
    var w = cardEl.getBoundingClientRect().width || (opts && opts.w) || 220;
    var host = document.createElement("div");
    host.className = "c3d-host";
    cardEl.replaceWith(host);
    return mount(host, card, lv, { w: Math.round(w), power: opts && opts.power });
  }

  window.SigilEvo = {
    level: level,
    cost: function (to) { return COST[to] || null; },
    names: LEVELS.map(function (l) { return l[0]; }),
    ink: ink,
    inkIcon: inkIcon,
    open: open,
    close: close,
    mount: mount,
    upgrade: upgrade
  };
})();
