"use strict";

/*
 * SIGIL — la soglia: la sala del Custode (16 nov 2026).
 *
 * - In alto il medaglione del livello (l'arco d'ambra è l'esperienza), il nome, le tre ricchezze.
 * - Al centro LA FINESTRA: un'apertura dipinta (finestra di pietra, libro, vetrata o arazzo, a rotazione) e dentro
 *   una scena che cambia con la modalità scelta.
 *     Viaggio ... un ritaglio dell'atlante sulla prossima tappa (toccandolo si apre quella tappa)
 *     Duello .... la medaglia del grado, i punti, i duelli fatti
 *     Libera .... le carte del mazzo a ventaglio sul tavolo di pietra (toccandolo si apre la collezione)
 *     Stanotte .. la rovina della veglia di oggi, viva (gli stessi effetti del tavolo: tavolo.js),
 *                 la sua regola e quanto manca alla prossima notte
 * - Quattro lastre per scegliere la modalità e il grande «Gioca», che preme il tasto di sempre
 *   (journeyButton, duelButton, playButton, dailyButton: restano nella pagina, nascosti).
 * - In basso la mensola coi sei medaglioni; «Altro» apre il foglio del Custode.
 * - Dietro, il dipinto della sala vive piano (candele, polvere, un filo di profondità).
 *
 * Un solo WebGL acceso alla volta: quando la finestra mostra la rovina viva, la sala resta ferma;
 * tutto si ferma quando la soglia è nascosta. Con «meno animazioni» restano i dipinti fermi.
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
  var esc = G.esc;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

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
    $("hudRing").style.strokeDasharray = clamp(pct, 0, 100) + " 100";
    $("hudAmbra").textContent = String(s.ambra || 0);
    $("hudInk").textContent = String(s.inchiostro || 0);
    var owned = s.collection ? Object.keys(s.collection).filter(function (id) { return s.collection[id] && BY_ID[id]; }).length : 0;
    var mc = $("menuCards");
    if (mc) mc.textContent = owned + " di " + ALL.length;
    var cloud = window.SigilCloud, st = cloud ? cloud.state() : "offline";
    var dot = $("hudDot");
    dot.className = "hud-dot" + (st === "online" ? " on" : st === "connecting" ? "" : " off");
    dot.title = st === "online" ? "Progressi salvati nel registro dei Custodi" : st === "connecting" ? "Mi collego al registro…" : "Il registro non risponde: le veglie restano in attesa qui.";
    var d = s.decks && s.decks[s.activeDeck || 0];
    $("heroDeckName").textContent = d && d.name ? d.name : "Mazzo " + ((s.activeDeck || 0) + 1);
    $("heroDeckInfo").textContent = (s.deck || []).length ? (s.deck || []).length + " carte" : "da comporre";
    refresh();
  }

  /* ───────── la sala viva (lo sfondo) ───────── */
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

    var tilt = { x: 0, y: 0, tx: 0, ty: 0 }, raf = 0, last = 0, lost = false, paused = false;
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
    function draw(now) {
      fit();
      tilt.x += (tilt.tx - tilt.x) * .06; tilt.y += (tilt.ty - tilt.y) * .06;
      gl.uniform2f(U.tilt, tilt.x, tilt.y);
      gl.uniform1f(U.t, (now / 1000) % 3600);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function frame(now) {
      raf = 0;
      if (menu.hidden || document.hidden || lost || paused || ready < 2) return;
      raf = requestAnimationFrame(frame);
      if (now - last < 30) return; // una trentina di fotogrammi al secondo bastano
      last = now;
      draw(now);
    }
    function kick() { if (!raf && ready === 2 && !paused && !menu.hidden && !document.hidden) raf = requestAnimationFrame(frame); }
    cv.addEventListener("webglcontextlost", function (e) { e.preventDefault(); lost = true; cv.classList.remove("on"); });
    menu.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      tilt.tx = (e.clientX / window.innerWidth - .5) * 2; tilt.ty = (e.clientY / window.innerHeight - .5) * 2;
    });
    window.addEventListener("deviceorientation", function (e) {
      if (e.gamma == null || menu.hidden) return;
      tilt.tx = clamp(e.gamma / 28, -1, 1); tilt.ty = clamp(((e.beta || 0) - 45) / 28, -1, 1);
    });
    document.addEventListener("visibilitychange", kick);
    // se la finestra è stata ridimensionata mentre la sala era ferma, un fotogramma la rimette a posto
    window.addEventListener("resize", function () { if (paused && ready === 2 && !lost && !menu.hidden) requestAnimationFrame(draw); });
    return { kick: kick, pause: function (on) { paused = !!on; if (!paused) kick(); }, tilt: tilt };
  })();

  /* ───────── la rovina viva nella finestra (gli shader di tavolo.js) ───────── */
  var luogo = (function () {
    var cv = null, ctx = null, tried = false, progs = {}, texs = {}, raf = 0, cur = null, last = 0, evAt = 0, evNext = 6, seed = Math.random() * 10;
    var tilt = { x: 0, y: 0 };
    function ensure() {
      if (tried) return !!ctx;
      tried = true;
      var S = window.SigilTavoloSrc;
      if (REDUCED || !S) return false;
      cv = document.createElement("canvas");
      cv.className = "fin-gl";
      cv.setAttribute("aria-hidden", "true");
      try { ctx = cv.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false }); } catch (e) { ctx = null; }
      if (!ctx) return false;
      var b = ctx.createBuffer(); ctx.bindBuffer(ctx.ARRAY_BUFFER, b);
      ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), ctx.STATIC_DRAW);
      cv.addEventListener("webglcontextlost", function (e) { e.preventDefault(); stop(); ctx = null; });
      return true;
    }
    function program(mode) {
      if (mode in progs) return progs[mode];
      var gl = ctx, S = window.SigilTavoloSrc;
      function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
      var vs = sh(gl.VERTEX_SHADER, S.VS), fs = sh(gl.FRAGMENT_SHADER, S.src(mode));
      if (!vs || !fs) return (progs[mode] = null);
      var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return (progs[mode] = null);
      var u = {};
      ["u_img", "u_dep", "u_res", "u_cov", "u_ctr", "u_tilt", "u_t", "u_ev", "u_lead", "u_seed"].forEach(function (n) { u[n] = gl.getUniformLocation(pr, n); });
      return (progs[mode] = { pr: pr, u: u, loc: gl.getAttribLocation(pr, "p") });
    }
    function texture(img, unit) {
      var gl = ctx, tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tx;
    }
    function frame(nowMs) {
      raf = 0;
      if (!cur || !ctx || menu.hidden || document.hidden) return;
      raf = requestAnimationFrame(frame);
      if (nowMs - last < 30 || !cur.ready) return;
      last = nowMs;
      var gl = ctx, P = cur.P, now = nowMs / 1000;
      var dpr = Math.min(1.5, window.devicePixelRatio || 1);
      var w = Math.round(cv.offsetWidth * dpr), h = Math.round(cv.offsetHeight * dpr);
      if (!w || !h) return;
      var k = Math.min(1, 900 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, w, h);
      gl.useProgram(P.pr);
      gl.enableVertexAttribArray(P.loc); gl.vertexAttribPointer(P.loc, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cur.texI); gl.uniform1i(P.u.u_img, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, cur.texD); gl.uniform1i(P.u.u_dep, 1);
      var A = w / h, B = cur.aspect || 1.34;
      var cov = A > B ? [1, B / A] : [A / B, 1];
      gl.uniform2f(P.u.u_res, w, h); gl.uniform2f(P.u.u_cov, cov[0], cov[1]); gl.uniform2f(P.u.u_ctr, .5, clamp(.5, cov[1] / 2, 1 - cov[1] / 2));
      var T = scene ? scene.tilt : null;
      if (T) { tilt.x += (T.tx - tilt.x) * .06; tilt.y += (T.ty - tilt.y) * .06; }
      gl.uniform2f(P.u.u_tilt, tilt.x, tilt.y);
      gl.uniform1f(P.u.u_t, (now % 600) + seed * 10);
      // l'evento della rovina (un colpo sull'incudine, un lampo, un rintocco) ogni tanto, mai fitto
      if (now - evAt > evNext) { evAt = now; evNext = 8 + Math.random() * 7; }
      gl.uniform1f(P.u.u_ev, now >= evAt ? now - evAt : 99);
      gl.uniform1f(P.u.u_lead, 0);
      gl.uniform1f(P.u.u_seed, seed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!cur.shown) { cur.shown = true; cv.classList.add("on"); }
    }
    function start(host, id) {
      var S = window.SigilTavoloSrc;
      if (!ensure() || !ctx || !S || S.MODES[id] == null) return false;
      stop();
      var me = cur = { id: id, ready: false, shown: false };
      cv.classList.remove("on");
      host.appendChild(cv);
      evAt = performance.now() / 1000 + 2.5; evNext = 99;
      var go = function (t) {
        if (cur !== me) return;
        me.texI = t.i; me.texD = t.d; me.aspect = t.a;
        me.P = program(S.MODES[id]);
        if (!me.P) { stop(); return; }
        me.ready = true;
      };
      if (texs[id]) go(texs[id]);
      else {
        var img = new Image(), dep = new Image(), left = 2;
        var done = function () { if (--left || !ctx) return; texs[id] = { i: texture(img, 0), d: texture(dep, 1), a: img.naturalWidth / img.naturalHeight }; go(texs[id]); };
        img.onload = done; dep.onload = done;
        img.src = "art/places/" + id + ".jpg?v=1"; dep.src = "art/places/" + id + "-d.png?v=1";
      }
      if (!raf) raf = requestAnimationFrame(frame);
      return true;
    }
    function stop() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      cur = null;
      if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
    }
    function wake() { if (cur && !raf) raf = requestAnimationFrame(frame); }
    document.addEventListener("visibilitychange", wake);
    return { start: start, stop: stop, wake: wake, on: function () { return !!cur; } };
  })();

  /* ───────── la finestra: quattro telai a rotazione, una scena per modalità ─────────
   * Il telaio è un dipinto scontornato (art/ui/telaio-<nome>-<q|l>.webp, fatti da _fucina/telai.py): una finestra di
   * pietra con la candela, un libro aperto, una vetrata in rovina, un arazzo. La scena sta sotto, ritagliata sulla forma
   * dell'apertura (la maschera …-m.webp). Cambia a ogni apertura del gioco e dopo ogni partita, mai due volte la stessa;
   * dalle Impostazioni se ne può fissare una. Misure: frazioni dell'immagine (w, h in px; a = apertura; f = "fuoco",
   * la parte che deve entrare nello spazio; c = centro del foro; p = quanta parte del suo rettangolo occupa il foro). */
  var TELAI = {
    finestra: { nome: "Finestra", sfuma: true,
      q: { w: 1270, h: 1280, a: [.3055, .1855, .6945, .8069], f: [.1643, .0525, .8357, .9743], c: [.4994, .5167], p: .848, fiamma: [.3707, .7188], t: [.3055, .1855, .6945, .70] },
      l: { w: 1600, h: 1061, a: [.2185, .1636, .7843, .7915], f: [.1222, .0634, .8913, .9316], c: [.5001, .5098], p: .812, fiamma: [.2717, .7248], t: [.33, .1636, .7843, .7915] } },
    libro: { nome: "Libro",
      q: { w: 1280, h: 1204, a: [.1872, .1113, .8271, .7302], f: [-.0088, -.0101, 1.0093, 1.0087], c: [.5069, .42], p: .997, t: [.1872, .1113, .8271, .7302] },
      l: { w: 1600, h: 1043, a: [.1514, .1149, .8558, .7411], f: [-.0088, -.0079, 1.0075, 1.0045], c: [.6996, .4279], p: .873,
        pagine: [[.1514, .1149, .455, .7411], [.5438, .1149, .8558, .7411]], t: [.1514, .1149, .455, .7411] } },
    vetrata: { nome: "Vetrata", sfuma: true,
      q: { w: 1236, h: 1280, a: [.3306, .1836, .6684, .8022], f: [.2619, .12, .7381, .85], c: [.509, .5465], p: .525, t: [.3306, .40, .6684, .79] },
      l: { w: 1600, h: 1043, a: [.302, .1587, .7012, .8848], f: [.2599, .1, .7421, .93], c: [.5269, .682], p: .358, t: [.32, .48, .69, .875] } },
    arazzo: { nome: "Arazzo", pieghe: true,
      q: { w: 1280, h: 1262, a: [.2165, .27, .783, .8165], f: [-.0125, .0625, 1.014, 1.0099], c: [.5001, .5426], p: .969, t: [.2165, .27, .783, .8165] },
      l: { w: 1600, h: 1045, a: [.1783, .288, .8144, .7762], f: [-.0136, .0305, 1.0116, 1.0073], c: [.4966, .5332], p: .941, t: [.1783, .288, .8144, .7762] } }
  };
  var NOMI = Object.keys(TELAI), TV = "?v=1";
  var fin = $("salaHero"), finVista = $("finVista"), finTela = $("finTela"), finForo = $("finForo"), finScene = $("finScene"),
    finTelaio = $("finTelaio"), finLuce = $("finLuce"), finPieghe = $("finPieghe"), finPagina = $("finPagina"), finTesto = $("finTesto");
  function leggi(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function scrivi(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* navigazione privata */ } }
  function altro(escluso) { var r = NOMI.filter(function (n) { return n !== escluso; }); return r[Math.floor(Math.random() * r.length)]; }
  // la scelta: "giro" (a rotazione) oppure il nome di un telaio
  var scelta = leggi("sigil-cornice"); if (scelta !== "giro" && !TELAI[scelta]) scelta = "giro";
  var telaio = scelta !== "giro" ? scelta : altro(leggi("sigil-cornice-ultima"));
  scrivi("sigil-cornice-ultima", telaio);
  var prossimo = altro(telaio), forma = "q";
  // la forma del foro adesso: rapporto, centro (frazioni del foro), pagine (libro largo)
  var ASP = 1.1, FC = [.5, .5], PAG = null;

  function deckIds() {
    var s = G.save();
    var ids = (s.deck || []).filter(function (id) { return BY_ID[id]; });
    if (!ids.length && s.collection) ids = Object.keys(s.collection).filter(function (id) { return s.collection[id] && BY_ID[id]; }).slice(0, 12);
    return ids;
  }
  function artSrc(id) {
    var m = /src="([^"]+)"/.exec(G.cardHTML ? G.cardHTML(BY_ID[id], { evo: false }) : "");
    return m ? m[1] : "art/cards/" + id + ".jpg";
  }
  function el(cls, html) { var d = document.createElement("div"); d.className = cls; if (html) d.innerHTML = html; return d; }
  function pc(v) { return (v * 100).toFixed(2) + "%"; }
  function firma() { return telaio + forma + ASP.toFixed(2); }

  var SCENE = {
    /* Il Viaggio: l'atlante, sulla prossima tappa */
    journey: function () {
      var V = window.SigilViaggio;
      if (!V || !V.NODES) return { key: "v0", el: el("fin-vuoto"), eyebrow: "Il Viaggio", title: "L'atlante del Sigillo", sub: "Novanta tappe su tre atlanti", act: function () { $("journeyButton").click(); } };
      var j = V.state(), n = clamp(j.unlocked || 1, 1, V.LEVELS.length);
      var L = V.LEVELS[n - 1], ch = V.CHAPTERS[L.chapter], bk = V.BOOKS[L.book];
      var uv = function (p) { return [(p[0] + 54) / 2808, (p[1] + 44) / 2288]; };
      var node = function (i) { return [V.NODES[i].x, V.NODES[i].y]; };
      // quanto è ingrandita la mappa rispetto al foro, in larghezza e in altezza: almeno 2,6 volte in tutti e due i versi
      var MA = 2400 / 1792, Z = Math.max(3.2, 2.7 * MA / ASP), Zy = Z * ASP / MA, c = uv(node(n - 1));
      // la tappa di oggi sta nel centro del foro, un po' in alto: sotto c'è la scritta
      var tx = clamp(FC[0] / Z - c[0], -(1 - 1 / Z), 0), ty = clamp((FC[1] - .17) / Zy - c[1], -(1 - 1 / Zy), 0);
      var roads = "", pins = "";
      V.LEVELS.forEach(function (l, i) {
        if (l.book !== L.book) return;
        var p = uv(node(i));
        if (Math.abs(p[0] - c[0]) > 1 / Z || Math.abs(p[1] - c[1]) > 1 / Zy) return; // lontana: fuori dal ritaglio
        var st = (j.stars && j.stars[l.n]) || 0;
        var cls = l.n === n ? "qui" : l.n < n ? "fatta" : "poi";
        pins += '<i class="fin-tappa ' + cls + (l.boss ? " capo" : "") + '" style="left:' + (p[0] * 100).toFixed(3) + "%;top:" + (p[1] * 100).toFixed(3) + '%">' +
          (st && l.n !== n ? "<em>" + "★★★".slice(0, st) + "</em>" : "") + "</i>";
        var next = V.LEVELS[i + 1];
        if (next && next.book === L.book) {
          var pts = [node(i)].concat(V.ROUTES[next.n] || [], [node(i + 1)]);
          roads += '<polyline class="' + (next.n <= n ? "fatta" : "poi") + '" points="' + pts.map(function (q) { return q[0].toFixed(0) + "," + q[1].toFixed(0); }).join(" ") + '"/>';
        }
      });
      var box = el("fin-atlante",
        '<div class="fin-mappa" style="width:' + (Z * 100).toFixed(1) + "%;background-image:url('" + bk.map + "');transform:translate(" + (tx * 100).toFixed(3) + "%," + (ty * 100).toFixed(3) + '%)">' +
        '<svg viewBox="-54 -44 2808 2288" preserveAspectRatio="none" aria-hidden="true">' + roads + "</svg>" + pins + "</div>");
      var stars = V.totalStars();
      return {
        key: "v" + n + "." + stars + "." + (j.finished ? 1 : 0) + "." + firma(),
        el: box,
        eyebrow: "Il Viaggio · tappa " + n + " di " + V.LEVELS.length,
        title: j.finished ? "Il Viaggio è compiuto" : ch.name,
        sub: j.finished ? "Ogni tappa si può rifare, per le stelle che mancano." : (L.boss ? L.foe + ", custode del capitolo" : L.foe + " · " + L.lanes + " rovine"),
        note: bk.title + " · capitolo " + V.ROMAN[L.chapter] + " · ★ " + stars,
        label: "Il Viaggio: tappa " + n + ", " + ch.name + ". Apri la tappa.",
        act: function () { if (V.showLevel) V.showLevel(n); else $("journeyButton").click(); }
      };
    },

    /* Il Duello: la medaglia del grado */
    duel: function () {
      var r = G.save().pvp || {}, D = window.SigilDuello;
      var rk = D && D.rank ? D.rank(r.rating) : { tier: 2, label: "Candela III", pct: 0, toNext: null };
      var w = r.w || 0, l = r.l || 0, t = r.t || 0, played = w + l + t, pts = r.rating || 1000;
      // la medaglia nel centro del foro, un po' in alto (sotto c'è la scritta); nel libro largo sta sulla pagina destra
      // e i punti sulla sinistra; nei fori larghi i punti stanno accanto alla medaglia, in quelli stretti nella scritta
      var largo = !PAG && ASP >= 1.3, mx = FC[0], my = PAG ? FC[1] : FC[1] - .14, px = null, py = null;
      if (PAG) { px = (PAG[0][0] + PAG[0][2]) / 2; py = PAG[0][1] + (PAG[0][3] - PAG[0][1]) * .26; }
      else if (largo) { mx = FC[0] - .13; my = FC[1] - .22; px = FC[0] + .15; py = my - .03; }
      var barra = rk.toNext != null ? '<span class="xp-bar fin-barra"><i style="width:' + clamp(rk.pct, 3, 100) + '%"></i></span>' : "";
      var box = el("fin-duello rank-" + rk.tier + (PAG ? " due" : largo ? " largo" : ""),
        '<div class="fin-grado" style="left:' + pc(mx) + ";top:" + pc(my) + '"><span class="fin-alone"></span><img src="art/ui/medaglia.webp?v=1" alt="" draggable="false">' + (px == null ? barra : "") + "</div>" +
        (px != null ? '<div class="fin-punti" style="left:' + pc(px) + ";top:" + pc(py) + '"><b>' + pts + "</b><small>punti</small>" + barra + "</div>" : ""));
      return {
        key: "d" + pts + "." + w + "." + l + "." + t + "." + firma(),
        el: box,
        eyebrow: "Duello tra Custodi" + (px == null ? " · " + pts + " punti" : ""),
        title: rk.label,
        sub: rk.toNext != null && rk.nextLabel ? "Mancano " + rk.toNext + " punti a " + rk.nextLabel : "Il grado più alto della valle",
        note: played ? w + (w === 1 ? " vinto" : " vinti") + " · " + l + (l === 1 ? " perso" : " persi") + " · " + t + " pari" : "Il primo duello decide da dove parti",
        label: "Duello tra Custodi: grado " + rk.label + ", " + pts + " punti. Apri il Duello.",
        act: function () { $("duelButton").click(); }
      };
    },

    /* La partita libera: il mazzo a ventaglio sul tavolo */
    free: function () {
      var s = G.save(), ids = deckIds().slice(0, 12);
      ids.sort(function (a, b) { return (BY_ID[a].cost - BY_ID[b].cost) || ((BY_ID[a].power || 0) - (BY_ID[b].power || 0)); });
      // le carte si dispongono a file, quante ne chiede la forma del foro: una zona per pagina nel libro largo
      var zone = PAG ? PAG.map(function (p) { return { x: p[0], y: p[1], w: p[2] - p[0], h: p[3] - p[1] }; }) : [{ x: 0, y: 0, w: 1, h: 1 }];
      var perZona = Math.ceil(ids.length / zone.length), html = "", zi = 0;
      zone.forEach(function (z, k) {
        var mie = ids.slice(k * perZona, (k + 1) * perZona);
        if (!mie.length) return;
        var asp = ASP * z.w / z.h;                                   // rapporto della zona
        // le carte stanno nella parte alta (sotto c'è la scritta): hz = quanta altezza della zona possono usare
        var hz = PAG ? .66 : .58, a2 = asp / hz;
        var file = a2 > 1.75 ? 1 : a2 > .7 ? 2 : 3;
        file = Math.min(file, mie.length);
        var per = Math.ceil(mie.length / file);
        // larghezza della carta (in frazione della larghezza della zona): le carte si accavallano per il 38%
        var cw = Math.min(.9 / (1 + .62 * (per - 1)), hz * .92 / (asp * 1.42 * (1 + .58 * (file - 1))));
        var chh = cw * 1.42 * asp;                                   // altezza della carta in frazione dell'altezza della zona
        // nei fori irregolari (la vetrata sfondata) le carte vanno dove il vetro manca davvero
        var irregolare = TELAI[telaio][forma].p < .7;
        var cy0 = (PAG ? hz / 2 + .03 : irregolare ? FC[1] - .1 : Math.min(FC[1] - .08, hz / 2 + .04)) - chh * .58 * (file - 1) / 2;
        for (var r = 0; r < file; r++) {
          var row = mie.slice(r * per, (r + 1) * per), m = row.length;
          row.forEach(function (id, i) {
            var t = m > 1 ? (i - (m - 1) / 2) / ((m - 1) / 2) : 0, c = BY_ID[id];
            var x = z.x + z.w * ((PAG ? .5 : FC[0]) + t * cw * .62 * (m - 1) / 2), y = z.y + z.h * (cy0 + r * chh * .58 + t * t * chh * .06);
            html += '<span class="fin-carta" data-house="' + esc(c.house || "misto") + '" style="left:' + pc(x) + ";top:" + pc(y) + ";width:" + pc(cw * z.w) +
              ";--r:" + (t * (6 + 5 * (m > 3)) + ((i * 37 + r * 11 + zi * 5) % 5 - 2) * .6).toFixed(2) + "deg;z-index:" + (r * 20 + i) + '"><img src="' + esc(artSrc(id)) + '" alt="" draggable="false"><b>' + c.cost + "</b></span>";
          });
        }
        zi++;
      });
      var d = s.decks && s.decks[s.activeDeck || 0];
      var name = d && d.name ? d.name : "Mazzo " + ((s.activeDeck || 0) + 1);
      var avg = ids.length ? ids.reduce(function (a, id) { return a + BY_ID[id].cost; }, 0) / ids.length : 0;
      return {
        key: "f" + (s.activeDeck || 0) + "." + name + "." + ids.join(",") + "." + firma(),
        el: el("fin-mazzo", '<div class="fin-ventaglio">' + html + "</div>"),
        eyebrow: "Partita libera",
        title: name,
        sub: ids.length ? "Una veglia qualsiasi contro l'Ombra" : "Il mazzo è ancora da comporre",
        note: ids.length ? ids.length + " carte · costo medio " + avg.toFixed(1).replace(".", ",") : "",
        label: "Partita libera con " + name + ". Apri mazzo e collezione.",
        act: function () { $("deckButton").click(); }
      };
    },

    /* La veglia di stanotte: la rovina del giorno, viva */
    daily: function () {
      var today = E.todayKey(), locs = [];
      try { locs = E.createMatch({ daily: true, date: today }).locations || []; } catch (e) { locs = []; }
      var hero = locs[Math.floor(locs.length / 2)] || E.LOCATIONS[0];
      var others = locs.filter(function (l) { return l !== hero; }).map(function (l) { return l.name; });
      var done = (G.save().daily || {})[today];
      var box = el("fin-notte", '<img class="fin-luogo" src="art/places/' + esc(hero.id) + '.jpg?v=1" alt="" draggable="false">');
      var timer = 0;
      function left() {
        var now = new Date(), end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        var min = Math.max(1, Math.round((end - now) / 60000)), h = Math.floor(min / 60);
        return h ? h + " h " + (min % 60) + " min" : min + " min";
      }
      function note() {
        return (done ? "Stanotte: " + (done.winner === "you" ? "retta" : done.winner === "tie" ? "in bilico" : "caduta") + " · la prossima notte tra " : "La prossima notte tra ") + left();
      }
      return {
        key: "n" + today + "." + hero.id + "." + (done ? done.winner : "") + "." + firma(),
        el: box,
        eyebrow: "Veglia di stanotte · " + ($("dailyLabel").textContent || today),
        title: hero.name,
        sub: hero.text + (others.length ? " Con " + others.join(" e ") + "." : ""),
        note: note(),
        label: "Veglia di stanotte: " + hero.name + ". " + hero.text + " Comincia la veglia.",
        start: function () {
          var live = luogo.start(box, hero.id);
          if (scene) scene.pause(live); // un solo WebGL alla volta: la sala aspetta
          timer = setInterval(function () {
            var n = finTesto.querySelector(".fin-nota");
            if (n && cur && cur.mode === "daily") n.textContent = note();
            if (E.todayKey() !== today) refresh(); // è passata la mezzanotte: cambia la rovina
          }, 30000);
        },
        stop: function () { clearInterval(timer); luogo.stop(); if (scene) scene.pause(false); },
        act: function () { $("dailyButton").click(); }
      };
    }
  };

  var cur = null; // { mode, layer, sc, on }
  function paintText(sc) {
    finTesto.innerHTML = '<small class="fin-occhiello">' + esc(sc.eyebrow || "") + "</small><strong>" + esc(sc.title || "") + "</strong>" +
      (sc.sub ? '<span class="fin-sotto">' + esc(sc.sub) + "</span>" : "") + (sc.note ? '<em class="fin-nota">' + esc(sc.note) + "</em>" : "");
    fin.setAttribute("aria-label", sc.label || sc.title || "");
  }
  function show(m, instant) {
    if (!SCENE[m]) return;
    var sc = SCENE[m]();
    var layer = el("fin-strato");
    layer.appendChild(sc.el);
    var old = cur;
    cur = { mode: m, layer: layer, sc: sc, on: false };
    fin.setAttribute("data-mode", m);
    var liscio = !(instant || REDUCED || !old);
    if (old) {
      if (old.on && old.sc.stop) old.sc.stop();
      old.layer.classList.add("via");
      var gone = old.layer;
      setTimeout(function () { if (gone.parentNode) gone.parentNode.removeChild(gone); }, liscio ? 560 : 0);
    }
    finScene.appendChild(layer);
    if (!liscio) { layer.classList.add("su"); paintText(sc); }
    else {
      void layer.offsetWidth; layer.classList.add("su");
      finTesto.classList.add("cambia");
      setTimeout(function () { if (cur && cur.sc === sc) paintText(sc); finTesto.classList.remove("cambia"); }, 200);
      if (telaio === "libro") { finPagina.classList.remove("gira"); void finPagina.offsetWidth; finPagina.classList.add("gira"); } // nel libro si gira pagina
    }
    wake();
  }
  // accende o spegne ciò che vive nella scena (WebGL, orologio) secondo che la soglia si veda o no
  function wake() {
    if (!cur) return;
    var vis = !menu.hidden;
    if (vis && !cur.on) { cur.on = true; if (cur.sc.start) cur.sc.start(); }
    else if (!vis && cur.on) { cur.on = false; if (cur.sc.stop) cur.sc.stop(); }
  }
  // dopo una partita o un acquisto i dati cambiano: la scena si rifà solo se serve
  function refresh() {
    if (menu.hidden) return;
    if (!cur) { show(mode, true); return; }
    var k = SCENE[cur.mode]().key;
    if (k !== cur.sc.key) show(cur.mode, true); else wake();
  }
  function act() { if (cur && cur.sc.act) cur.sc.act(); }

  /* la misura: il "fuoco" del telaio entra nello spazio tra la scritta e le lastre; tra la forma quadrata e quella
     larga vince quella che dà il foro più grande. Quello che deborda (muro, pietre) sfuma ai bordi. */
  function misura(T, W, H) {
    var fw = (T.f[2] - T.f[0]) * T.w, fh = (T.f[3] - T.f[1]) * T.h, k = Math.min(W / fw, H / fh);
    return { k: k, area: (T.a[2] - T.a[0]) * T.w * k * (T.a[3] - T.a[1]) * T.h * k * T.p };
  }
  function layout() {
    var med = document.querySelector(".hud-med");
    var s = med && med.offsetWidth ? med.offsetWidth / 60 : 1;
    var W = fin.clientWidth, H = fin.clientHeight;
    if (W < 80 || H < 80) return;
    var Tn = TELAI[telaio], orlo = Math.round(22 * s), pad = Tn.sfuma ? 0 : Math.round(8 * s);
    var mq = misura(Tn.q, W - 2 * pad, H - 2 * pad), ml = misura(Tn.l, W - 2 * pad, H - 2 * pad);
    var nuova = ml.area > mq.area * (forma === "l" ? .92 : 1.08) ? "l" : "q";
    var T = Tn[nuova], k = (nuova === "l" ? ml : mq).k, tw = T.w * k, th = T.h * k;
    // la tela (l'immagine intera) dentro la vista (lo spazio più un orlo che sfuma)
    finVista.style.inset = -orlo + "px";
    finVista.style.setProperty("--orlo", Math.round(orlo * 1.7) + "px");
    finTela.style.width = tw.toFixed(1) + "px";
    finTela.style.height = th.toFixed(1) + "px";
    finTela.style.left = (orlo + W / 2 - (T.f[0] + T.f[2]) / 2 * tw).toFixed(1) + "px";
    finTela.style.top = (orlo + H / 2 - (T.f[1] + T.f[3]) / 2 * th).toFixed(1) + "px";
    var sw = (T.a[2] - T.a[0]) * tw, sh = (T.a[3] - T.a[1]) * th;
    [finScene, finPieghe].forEach(function (e) { e.style.left = pc(T.a[0]); e.style.top = pc(T.a[1]); e.style.width = pc(T.a[2] - T.a[0]); e.style.height = pc(T.a[3] - T.a[1]); });
    fin.style.setProperty("--fw", sw.toFixed(1) + "px");
    fin.style.setProperty("--fh", sh.toFixed(1) + "px");
    fin.style.setProperty("--tw", tw.toFixed(1) + "px");
    var base = "art/ui/telaio-" + telaio + "-" + nuova;
    if (finTelaio.getAttribute("data-src") !== base) {
      finTelaio.setAttribute("data-src", base);
      finTelaio.src = base + ".webp" + TV;
      finForo.style.webkitMaskImage = finForo.style.maskImage = 'url("' + base + "-m.webp" + TV + '")';
      finPieghe.style.backgroundImage = Tn.pieghe ? 'url("' + base + "-o.webp" + TV + '")' : "";
      finLuce.style.webkitMaskImage = finLuce.style.maskImage = telaio === "vetrata" ? 'url("' + base + "-v.webp" + TV + '")' : "";
    }
    fin.setAttribute("data-telaio", telaio);
    fin.setAttribute("data-forma", nuova);
    finVista.classList.toggle("sfuma", !!Tn.sfuma);
    if (T.fiamma) { finLuce.style.setProperty("--lx", pc(T.fiamma[0])); finLuce.style.setProperty("--ly", pc(T.fiamma[1])); }
    else { finLuce.style.setProperty("--lx", pc((T.a[0] + T.a[2]) / 2)); finLuce.style.setProperty("--ly", pc((T.a[1] + T.a[3]) / 2)); }
    // la scritta: in basso nel foro (fuori dalla vista, così non sfuma), in coordinate della finestra
    var L0 = orlo + W / 2 - (T.f[0] + T.f[2]) / 2 * tw - orlo, T0 = orlo + H / 2 - (T.f[1] + T.f[3]) / 2 * th - orlo, tt = T.t || T.a;
    finTesto.style.left = (L0 + tt[0] * tw).toFixed(1) + "px";
    finTesto.style.top = (T0 + tt[1] * th).toFixed(1) + "px";
    finTesto.style.width = ((tt[2] - tt[0]) * tw).toFixed(1) + "px";
    finTesto.style.height = ((tt[3] - tt[1]) * th).toFixed(1) + "px";
    finTesto.style.setProperty("--tt", ((tt[2] - tt[0]) * tw).toFixed(1) + "px");
    // dove si gira la pagina del libro: la pagina destra (o la metà destra del foro)
    var pg = T.pagine ? T.pagine[1] : [(T.a[0] + T.a[2]) / 2, T.a[1], T.a[2], T.a[3]];
    finPagina.style.left = pc(pg[0]); finPagina.style.top = pc(pg[1]); finPagina.style.width = pc(pg[2] - pg[0]); finPagina.style.height = pc(pg[3] - pg[1]);
    // la forma del foro, per le scene
    var asp = sw / sh, aw = T.a[2] - T.a[0], ah = T.a[3] - T.a[1];
    var fc = [(T.c[0] - T.a[0]) / aw, (T.c[1] - T.a[1]) / ah];
    var pag = T.pagine ? T.pagine.map(function (p) { return [(p[0] - T.a[0]) / aw, (p[1] - T.a[1]) / ah, (p[2] - T.a[0]) / aw, (p[3] - T.a[1]) / ah]; }) : null;
    var cambia = nuova !== forma || Math.abs(asp - ASP) > .03;
    forma = nuova; ASP = asp; FC = fc; PAG = pag;
    if (cambia && cur) refresh();
  }
  if (window.ResizeObserver) new ResizeObserver(layout).observe(fin);
  window.addEventListener("resize", layout);

  // la rotazione: un telaio diverso a ogni apertura e dopo ogni partita; il prossimo è già caricato
  function precarica(nome) { ["q", "l"].forEach(function (f) { if (f === forma) { new Image().src = "art/ui/telaio-" + nome + "-" + f + ".webp" + TV; new Image().src = "art/ui/telaio-" + nome + "-" + f + "-m.webp" + TV; } }); }
  function metti(nome, senzaSalvare) {
    if (!TELAI[nome]) return;
    var cambia = nome !== telaio;
    telaio = nome;
    if (!senzaSalvare) scrivi("sigil-cornice-ultima", nome);
    prossimo = altro(nome);
    layout();
    if (cambia && cur && !menu.hidden) show(cur.mode, true);
    setTimeout(function () { precarica(prossimo); }, 1200);
  }
  function ruota() { if (scelta === "giro") metti(prossimo); }
  function scegli(v) {
    scelta = v === "giro" || !TELAI[v] ? "giro" : v;
    scrivi("sigil-cornice", scelta);
    if (scelta !== "giro") metti(scelta);
  }
  var giocato = false;
  new MutationObserver(function () { if (document.getElementById("app").classList.contains("playing")) giocato = true; })
    .observe(document.getElementById("app"), { attributes: true, attributeFilter: ["class"] });

  // tocco (o Invio) apre; un colpo di dito di lato cambia modalità
  var drag = null, swiped = false;
  fin.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; swiped = false; });
  fin.addEventListener("pointerup", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag = null;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swiped = true;
      var i = tabs.findIndex(function (t) { return t.dataset.mode === mode; });
      setMode(tabs[(i + (dx < 0 ? 1 : tabs.length - 1)) % tabs.length].dataset.mode);
    }
  });
  fin.addEventListener("pointercancel", function () { drag = null; });
  fin.addEventListener("click", function (e) { if (swiped) { swiped = false; e.preventDefault(); return; } act(); });
  fin.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
  $("finTesto").addEventListener("click", act);
  $("heroDeck").addEventListener("click", function () { $("deckButton").click(); });

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
    var changed = m !== mode;
    mode = m;
    tabs.forEach(function (t) { var on = t.dataset.mode === m; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; });
    $("salaPlaySub").textContent = MODES[m].name;
    try { localStorage.setItem("sigil-modo", m); } catch (e) { /* ignora */ }
    if (!quiet && G.blip) G.blip("select");
    if (!menu.hidden && (changed || !cur)) show(m, quiet);
  }
  tabs.forEach(function (t) { t.addEventListener("click", function () { setMode(t.dataset.mode); }); });
  $("modePick").addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var i = tabs.findIndex(function (t) { return t.dataset.mode === mode; });
    var n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    setMode(n.dataset.mode); n.focus(); e.preventDefault();
  });
  $("salaPlay").addEventListener("click", function () { $(MODES[mode].btn).click(); });

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
  $("moreSettings").addEventListener("click", function () { if (window.SigilImpostazioni) window.SigilImpostazioni.open(); });

  /* ───────── quando la soglia compare o scompare ───────── */
  function sync() {
    var on = !menu.hidden;
    root.classList.toggle("sala-on", on);
    if (on) { if (giocato) { giocato = false; ruota(); } layout(); if (scene) scene.kick(); luogo.wake(); refresh(); }
    else { closeMore(); wake(); }
  }
  new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ["hidden"] });

  var prev = G.onMenu;
  G.onMenu = function () { if (prev) prev(); paintHud(); };
  if (window.SigilCloud && window.SigilCloud.on) window.SigilCloud.on(function () { setTimeout(paintHud, 0); });
  setMode(mode, true);
  layout();
  paintHud();
  sync();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  window.addEventListener("load", layout);

  setTimeout(function () { precarica(prossimo); }, 2500);
  window.SigilSoglia = { mode: function () { return mode; }, setMode: setMode, refresh: paintHud,
    // le cornici della finestra: per le Impostazioni (e per le prove: metti("libro"))
    telai: function () { return NOMI.map(function (n) { return { id: n, nome: TELAI[n].nome }; }); },
    cornice: function () { return scelta; }, scegliCornice: scegli, telaio: function () { return telaio; }, metti: function (n) { metti(n, true); } };
})();
