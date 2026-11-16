"use strict";

/*
 * SIGIL — la soglia: la sala del Custode (16 nov 2026).
 *
 * - In alto il medaglione del livello (l'arco d'ambra è l'esperienza), il nome, le tre ricchezze.
 * - Al centro la carta più bella del mazzo, in 3D (carta3d.js).
 * - Quattro lastre per scegliere la modalità e il grande «Gioca», che preme il tasto di sempre
 *   (journeyButton, duelButton, playButton, dailyButton: restano nella pagina, nascosti).
 * - In basso la mensola coi sei medaglioni; «Altro» apre il foglio del Custode.
 * - Dietro, il dipinto della sala vive piano: le candele tremano, la polvere sale nella luce,
 *   e la stanza si sposta appena col dito o con l'inclinazione (WebGL, con la mappa di profondità).
 *   Con «meno animazioni» resta il dipinto fermo.
 */
(function () {
  var G = window.SigilGame, E = window.Lume;
  var menu = document.getElementById("menu");
  if (!G || !E || !menu || !menu.classList.contains("sala")) return;
  var $ = function (id) { return document.getElementById(id); };
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ALL = E.ALL_CARDS || E.CARDS, BY_ID = {};
  ALL.forEach(function (c) { BY_ID[c.id] = c; });
  var HOUSE = {};
  (E.HOUSES || []).forEach(function (h) { HOUSE[h.id] = h; });
  var root = document.documentElement;

  /* ───────── il Custode, in alto ───────── */
  function paintHud() {
    var s = G.save();
    $("hudLevel").textContent = String(s.level || 1);
    $("hudName").textContent = s.name || "Custode";
    var h = HOUSE[s.sworn || s.house];
    var house = $("hudHouse");
    house.textContent = h ? h.name : "";
    house.style.setProperty("--house", h ? "var(--h-" + h.id + ")" : "");
    // l'esperienza: la stessa che collezione.js scrive nella riga del livello
    var bar = document.querySelector("#menuLevel .xp-bar i");
    var pct = bar ? parseFloat(bar.style.width) || 0 : 0;
    $("hudRing").style.strokeDasharray = Math.max(0, Math.min(100, pct)) + " 100";
    $("hudAmbra").textContent = String(s.ambra || 0);
    $("hudInk").textContent = String(s.inchiostro || 0);
    var owned = s.collection ? Object.keys(s.collection).filter(function (id) { return s.collection[id] && BY_ID[id]; }).length : 0;
    var mc = $("menuCards");
    if (mc) mc.textContent = owned + " di " + ALL.length;
    var cloud = window.SigilCloud, st = cloud ? cloud.state() : "offline";
    var dot = $("hudDot");
    dot.className = "hud-dot" + (st === "online" ? " on" : st === "connecting" ? "" : " off");
    dot.title = st === "online" ? "Progressi salvati nel registro dei Custodi" : st === "connecting" ? "Mi collego al registro…" : "Il registro non risponde: le veglie restano in attesa qui.";
    paintDeck();
  }

  /* ───────── il mazzo e la carta in vetrina ───────── */
  var hero = { id: null, level: 0, w: 0, handle: null };
  function deckIds() {
    var s = G.save();
    var ids = (s.deck || []).filter(function (id) { return BY_ID[id]; });
    if (!ids.length && s.collection) ids = Object.keys(s.collection).filter(function (id) { return s.collection[id] && BY_ID[id]; });
    return ids;
  }
  function evo(id) { return window.SigilEvo ? window.SigilEvo.level(id) : 1; }
  function pickHero() {
    var ids = deckIds();
    if (!ids.length) return null;
    // la più evoluta; a pari livello la più costosa (e poi la più forte)
    return ids.slice().sort(function (a, b) {
      return (evo(b) - evo(a)) || (BY_ID[b].cost - BY_ID[a].cost) || ((BY_ID[b].power || 0) - (BY_ID[a].power || 0));
    })[0];
  }
  function paintDeck() {
    var s = G.save();
    var n = (s.deck || []).length;
    var d = s.decks && s.decks[s.activeDeck || 0];
    $("heroDeckName").textContent = d && d.name ? d.name : "Mazzo " + ((s.activeDeck || 0) + 1);
    $("heroDeckInfo").textContent = n ? n + " carte" : "da comporre";
    mountHero(false);
  }
  function heroWidth() {
    var host = $("salaHero");
    var bw = host.clientWidth, bh = host.clientHeight;
    if (!bw || !bh) return 0;
    return Math.round(Math.max(96, Math.min(bh / 1.58, bw * .62, 330)));
  }
  function mountHero(force) {
    var host = $("salaHero");
    if (!window.SigilEvo || menu.hidden || !host) return;
    if (root.classList.contains("evo-open")) return; // il visore delle evoluzioni ha la precedenza
    var id = pickHero(), w = heroWidth();
    if (!id || !w) return;
    var lv = evo(id);
    var alive = hero.handle && !hero.handle.dead && host.firstChild;
    if (!force && alive && hero.id === id && hero.level === lv && Math.abs(hero.w - w) < 6) return;
    hero.id = id; hero.level = lv; hero.w = w;
    hero.handle = window.SigilEvo.mount(host, BY_ID[id], lv, { w: w });
    host.setAttribute("aria-label", "In vetrina: " + BY_ID[id].name);
  }
  $("salaHero").addEventListener("click", function () {
    if (hero.id && window.SigilEvo && G.save().collection && G.save().collection[hero.id]) window.SigilEvo.open(hero.id);
    else $("deckButton").click();
  });
  $("heroDeck").addEventListener("click", function () { $("deckButton").click(); });
  window.addEventListener("sigil:evo", function () { setTimeout(function () { mountHero(true); }, 60); });
  var rz = 0;
  window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { mountHero(false); }, 180); });

  /* ───────── le modalità e «Gioca» ───────── */
  var MODES = {
    journey: { btn: "journeyButton", name: "Il Viaggio" },
    duel: { btn: "duelButton", name: "Duello tra Custodi" },
    free: { btn: "playButton", name: "Partita libera" },
    daily: { btn: "dailyButton", name: "Veglia di stanotte" }
  };
  var mode = "journey";
  try { var m0 = localStorage.getItem("sigil-modo"); if (MODES[m0]) mode = m0; } catch (e) { /* navigazione privata */ }
  var tabs = [].slice.call(document.querySelectorAll("#modePick [data-mode]"));
  function setMode(m, quiet) {
    if (!MODES[m]) return;
    mode = m;
    tabs.forEach(function (t) { var on = t.dataset.mode === m; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; });
    $("salaPlaySub").textContent = MODES[m].name;
    try { localStorage.setItem("sigil-modo", m); } catch (e) { /* ignora */ }
    if (!quiet && G.blip) G.blip("select");
  }
  tabs.forEach(function (t) { t.addEventListener("click", function () { setMode(t.dataset.mode); }); });
  $("modePick").addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var i = tabs.findIndex(function (t) { return t.dataset.mode === mode; });
    var n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    setMode(n.dataset.mode); n.focus(); e.preventDefault();
  });
  $("salaPlay").addEventListener("click", function () { $(MODES[mode].btn).click(); });
  setMode(mode, true);

  /* ───────── «Altro»: il foglio del Custode ───────── */
  var more = $("salaMore");
  function openMore() { more.hidden = false; var b = more.querySelector("[data-close-more]"); if (b) b.focus(); }
  function closeMore() { more.hidden = true; }
  $("moreButton").addEventListener("click", openMore);
  $("hudProfile").addEventListener("click", function () {
    var c = window.SigilCloud;
    if (c && c.state() !== "online" && c.state() !== "connecting" && c.retry) c.retry();
    openMore();
  });
  more.addEventListener("click", function (e) {
    if (e.target === more || e.target.closest("[data-close-more]")) closeMore();
    else if (e.target.closest(".menu-links button, .seed-form button")) setTimeout(closeMore, 0); // si va altrove: il foglio si chiude
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !more.hidden) { e.stopPropagation(); closeMore(); } }, true);
  $("salaGear").addEventListener("click", function () { if (window.SigilImpostazioni) window.SigilImpostazioni.open(); });

  /* ───────── la sala viva ───────── */
  var scene = (function () {
    var cv = $("salaScene");
    if (REDUCED || !cv) return null;
    var gl = null;
    try { gl = cv.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power", preserveDrawingBuffer: false }); } catch (e) { gl = null; }
    if (!gl) return null;
    var VS = "attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; v.y = 1. - v.y; gl_Position = vec4(p, 0., 1.); }";
    var FS = [
      "precision mediump float;",
      "varying vec2 v; uniform sampler2D tex, dep; uniform vec2 sc, off, tilt; uniform float t, asp;",
      "float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }",
      "float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
      "float fl(float x, float s){ float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h1(i + s), h1(i + 1. + s), f); }",
      // una candela: quanto tremola (0.75..1.05), lenta più un guizzo ogni tanto
      "float cand(float s){ return .8 + .2 * fl(t * 2.1, s) + .09 * fl(t * 7.3, s + 9.) - .1 * pow(fl(t * .9, s + 4.), 6.); }",
      "vec3 glow(vec2 uv, vec2 c, float r, float f){ vec2 d = (uv - c) * vec2(asp, 1.); return vec3(1., .62, .26) * f * exp(-dot(d, d) / (r * r)); }",
      "void main(){",
      "  vec2 uv = v * sc + off;",
      "  float d = texture2D(dep, uv).r;",
      "  uv += tilt * (d - .42) * .022;",                       // la stanza ha profondità: il vicino si sposta più del lontano
      "  vec3 c = texture2D(tex, uv).rgb;",
      "  float f1 = cand(1.), f2 = cand(2.), f3 = cand(3.), f4 = cand(4.);",
      // il muro vicino a ogni candelabro respira con la fiamma
      "  float w = (f1 - .92) * exp(-pow(distance(uv * vec2(asp, 1.), vec2(.07 * asp, .45)) / .34, 2.))",
      "          + (f2 - .92) * exp(-pow(distance(uv * vec2(asp, 1.), vec2(.357 * asp, .49)) / .16, 2.))",
      "          + (f3 - .92) * exp(-pow(distance(uv * vec2(asp, 1.), vec2(.64 * asp, .49)) / .16, 2.))",
      "          + (f4 - .92) * exp(-pow(distance(uv * vec2(asp, 1.), vec2(.93 * asp, .44)) / .34, 2.));",
      "  c *= 1. + w * 1.25;",
      "  c += glow(uv, vec2(.07, .43), .075, (f1 - .8) * .5) + glow(uv, vec2(.93, .42), .075, (f4 - .8) * .5);",
      "  c += glow(uv, vec2(.357, .485), .034, (f2 - .8) * .45) + glow(uv, vec2(.64, .485), .034, (f3 - .8) * .45);",
      // la luna: un alone che respira lentissimo
      "  vec2 dm = (uv - vec2(.485, .265)) * vec2(asp, 1.);",
      "  c += vec3(.42, .56, .78) * exp(-dot(dm, dm) / .012) * (.06 + .04 * sin(t * .23));",
      // l'oro inciso nel tavolo prende luce, piano, come se la candela gli girasse attorno
      "  vec2 e = (uv - vec2(.5, .79)) / vec2(.29, .085);",
      "  float tav = smoothstep(1.1, .6, length(e));",
      "  float oro = smoothstep(.07, .3, c.r - c.b) * smoothstep(.25, .6, c.r);",
      "  float giro = .5 + .5 * sin(atan(e.y, e.x) - t * .22);",
      "  c += vec3(1., .72, .32) * oro * tav * (.10 + .26 * giro * giro);",
      // la polvere nella luce: pochi granelli lenti, più visibili davanti alla finestra
      "  float p = 0.;",
      "  for (int i = 0; i < 2; i++) {",
      "    float k = float(i);",
      "    vec2 g = uv * vec2(asp, 1.) * (9. + k * 6.) + vec2(t * (.012 + k * .008), -t * (.02 + k * .012)) + k * 7.3;",
      "    vec2 id = floor(g), q = fract(g) - .5;",
      "    float r = h2(id + k * 13.);",
      "    q += (vec2(h2(id + 3.1), h2(id + 7.7)) - .5) * .6;",
      "    float tw = .5 + .5 * sin(t * (.6 + r * 1.4) + r * 40.);",
      "    p += step(.72, r) * smoothstep(.07, .0, length(q)) * tw;",
      "  }",
      "  float luce = exp(-pow((uv.x - .5) / .2, 2.)) * smoothstep(.95, .25, uv.y) + .35 * exp(-pow(distance(uv * vec2(asp, 1.), vec2(.07 * asp, .5)) / .3, 2.)) + .35 * exp(-pow(distance(uv * vec2(asp, 1.), vec2(.93 * asp, .5)) / .3, 2.));",
      "  c += vec3(.9, .85, .72) * p * luce * .22;",
      "  gl_FragColor = vec4(c, 1.);",
      "}"
    ].join("\n");
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { if (window.console) console.warn("sala:", gl.getShaderInfoLog(s)); return null; } return s; }
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    var pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ["tex", "dep", "sc", "off", "tilt", "t", "asp"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    var IW = 1920, IH = 1072, ready = 0;
    function tex(unit, src) {
      var tx = gl.createTexture(), im = new Image();
      im.onload = function () {
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (unit === 0) { IW = im.naturalWidth; IH = im.naturalHeight; }
        if (++ready === 2) { cv.classList.add("on"); kick(); }
      };
      im.src = src;
    }
    tex(0, "art/arene/sala.jpg");
    tex(1, "art/arene/sala-d.png");
    gl.uniform1i(U.tex, 0); gl.uniform1i(U.dep, 1);

    var tilt = { x: 0, y: 0, tx: 0, ty: 0 }, raf = 0, last = 0, lost = false;
    function fit() {
      // la tela non supera 1280 px di lato: il dipinto è morbido, non serve di più (e il telefono ringrazia)
      var cw = cv.clientWidth, ch = cv.clientHeight;
      var k = Math.min(window.devicePixelRatio || 1, 2, 1280 / Math.max(cw, ch, 1));
      var w = Math.max(2, Math.round(cw * k)), h = Math.max(2, Math.round(ch * k));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      // come «background-size: cover», centrato
      var ca = cw / Math.max(ch, 1), ia = IW / IH, sx = 1, sy = 1;
      if (ca > ia) sy = ia / ca; else sx = ca / ia;
      gl.uniform2f(U.sc, sx, sy); gl.uniform2f(U.off, (1 - sx) / 2, (1 - sy) / 2);
      gl.uniform1f(U.asp, ia);
    }
    function frame(now) {
      raf = 0;
      if (menu.hidden || document.hidden || lost || ready < 2) return;
      raf = requestAnimationFrame(frame);
      if (now - last < 30) return; // una trentina di fotogrammi al secondo bastano
      last = now;
      fit();
      tilt.x += (tilt.tx - tilt.x) * .06; tilt.y += (tilt.ty - tilt.y) * .06;
      gl.uniform2f(U.tilt, tilt.x, tilt.y);
      gl.uniform1f(U.t, (now / 1000) % 3600);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function kick() { if (!raf && ready === 2 && !menu.hidden && !document.hidden) raf = requestAnimationFrame(frame); }
    cv.addEventListener("webglcontextlost", function (e) { e.preventDefault(); lost = true; cv.classList.remove("on"); });
    menu.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      tilt.tx = (e.clientX / window.innerWidth - .5) * 2; tilt.ty = (e.clientY / window.innerHeight - .5) * 2;
    });
    window.addEventListener("deviceorientation", function (e) {
      if (e.gamma == null || menu.hidden) return;
      tilt.tx = Math.max(-1, Math.min(1, e.gamma / 28)); tilt.ty = Math.max(-1, Math.min(1, ((e.beta || 0) - 45) / 28));
    });
    document.addEventListener("visibilitychange", kick);
    return { kick: kick };
  })();

  /* ───────── quando la soglia compare o scompare ───────── */
  function sync() {
    var on = !menu.hidden;
    root.classList.toggle("sala-on", on);
    if (on) { if (scene) scene.kick(); requestAnimationFrame(function () { mountHero(false); }); }
    else closeMore();
  }
  new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ["hidden"] });
  new MutationObserver(function () { if (!root.classList.contains("evo-open")) setTimeout(function () { mountHero(false); }, 80); }).observe(root, { attributes: true, attributeFilter: ["class"] });

  var prev = G.onMenu;
  G.onMenu = function () { if (prev) prev(); paintHud(); };
  if (window.SigilCloud && window.SigilCloud.on) window.SigilCloud.on(function () { setTimeout(paintHud, 0); });
  paintHud();
  sync();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { mountHero(false); });
  window.addEventListener("load", function () { mountHero(false); });

  window.SigilSoglia = { mode: function () { return mode; }, setMode: setMode, refresh: paintHud };
})();
