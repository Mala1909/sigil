"use strict";

/*
 * SIGIL — Gli effetti tra le carte, seconda versione (16 nov 2026).
 *
 * Un piccolo motore di effetti in WebGL, sopra il tavolo:
 *   · uno strato di LUCE (si somma a quello che c'è sotto, con il bagliore "bloom" che fa bruciare
 *     le luci forti), per raggi, onde, righe di scansione, esplosioni di raggi, scintille;
 *   · uno strato di OMBRA (fusione normale), per il fumo delle maledizioni, le carte che bruciano e le
 *     tessere della carta che si ricompone (con la sua illustrazione vera).
 * Tutto è disegnato dagli shader (rumore frattale), niente immagini da scaricare.
 *
 * Cosa si vede:
 *   posa .......... la carta in mano si scompone in tessere di luce che volano sulla rovina e lì
 *                   si ricompongono, pezzo per pezzo
 *   rivelazione ... la carta si spacca in tessere, una luce la percorre e le tessere si girano e
 *                   tornano al loro posto una dopo l'altra, "stampando" l'illustrazione; il bordo
 *                   si accende nel colore della casata. (Niente più sigillo a terra.)
 *                   Ogni casata ha il suo modo (vedi STYLE): la Guardia a mattoni, riga per riga;
 *                   la Selva a foglie nel vento, dal basso; la Congrega in un vortice, dal centro;
 *                   il Tesoro a mosaico, colonna per colonna; il Fondo a braci che risalgono.
 *                   E tre pesi secondo il costo: leggera (1-2 lumi), media (3-4), grossa (5 e più:
 *                   onda a terra e tavolo che trema; da 6 anche un lampo).
 *   bonus ......... un nastro d'oro corre dalla carta che lo lancia (o dalla rovina) al bersaglio:
 *                   lì esplode una stella di raggi, la carta si solleva e si illumina dal bordo
 *   maledizione ... un tentacolo viola e nero raggiunge la carta e la incrina: la crepa parte dal
 *                   punto colpito e corre per tutta la carta, le tessere sobbalzano, perdono colore
 *                   e tremano, poi si rimarginano; fumo scuro. (Niente più pentacolo.)
 *   numero ........ "+3" / "−1" esplode sulla carta e vola dentro il medaglione della forza
 *   distruzione ... la carta brucia dai bordi verso il centro, con il margine che arde
 *   spostamento, ritorno in mano: una cometa
 * Il motore racconta gli effetti solo a parole: qui si confronta il tavolo prima e dopo ogni passo
 * (ogni volta che game.js lo ridisegna) e si capisce cosa è successo, a chi e da chi.
 */
(function () {
  var G = window.SigilGame, E = window.Lume;
  var board = document.getElementById("board");
  var app = document.getElementById("app");
  if (!G || !E || !board || !app) return;
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var HOUSE = { guardia: [1, .72, .32], selva: [.5, .95, .55], congrega: [.78, .55, 1], tesoro: [.35, .85, .95], fondo: [1, .45, .32], misto: [.95, .88, .75] };
  var GOLD = [1, .78, .36], CURSE = [.66, .42, 1];

  /* ───────── i due strati ───────── */
  // Due livelli separati: la luce si fonde "a schermo" con tutto quello che c'è sotto (per questo il
  // suo contenitore deve stare da solo), l'ombra si posa normalmente. I numeri stanno sopra a tutti.
  var layer = document.createElement("div"), lightLayer = document.createElement("div");
  layer.className = "fx-layer fx-dark-layer"; lightLayer.className = "fx-layer fx-light-layer";
  layer.setAttribute("aria-hidden", "true"); lightLayer.setAttribute("aria-hidden", "true");
  var cvD = document.createElement("canvas"), cvL = document.createElement("canvas");
  layer.appendChild(cvD); lightLayer.appendChild(cvL);
  document.body.appendChild(layer); document.body.appendChild(lightLayer);
  var numLayer = document.createElement("div");
  numLayer.className = "fx-layer fx-num-layer"; numLayer.setAttribute("aria-hidden", "true");
  document.body.appendChild(numLayer);

  function ctx(cv, opts) { try { return cv.getContext("webgl", opts); } catch (e) { return null; } }
  var gl = ctx(cvL, { alpha: false, antialias: false, premultipliedAlpha: false });
  var gd = ctx(cvD, { alpha: true, antialias: true, premultipliedAlpha: true });
  var OK = !!(gl && gd) && !REDUCED;

  /* ───────── shader ───────── */
  var NOISE = [
    "float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);",
    "  return mix(mix(h2(i), h2(i + vec2(1., 0.)), f.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1., 1.)), f.x), f.y); }",
    "float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * nz(p); p = p * 2.02 + vec2(3.1, 7.7); a *= .5; } return s; }",
    ""
  ].join("\n");
  var PREC = ["#ifdef GL_FRAGMENT_PRECISION_HIGH", "precision highp float;", "#else", "precision mediump float;", "#endif", ""].join("\n");

  // Quadrato orientato: centro, misura, rotazione (px CSS) → spazio dello schermo
  var VS_QUAD = [
    "attribute vec2 p; uniform vec2 u_view, u_c, u_s; uniform float u_rot; varying vec2 v;",
    "void main(){ v = p * .5 + .5; vec2 q = p * u_s * .5; float c = cos(u_rot), s = sin(u_rot); q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);",
    "  vec2 w = u_c + q; gl_Position = vec4(w.x / u_view.x * 2. - 1., 1. - w.y / u_view.y * 2., 0., 1.); }"
  ].join("\n");
  // Effetti di luce su un quadrato (modo = quale)
  var FS_LIGHT = PREC + NOISE + [
    "uniform int u_mode; uniform float u_k, u_time, u_seed, u_p; uniform vec3 u_col; uniform vec2 u_aux; varying vec2 v;",
    "void main(){",
    "  vec2 q = v * 2. - 1.; float r = length(q); float a = atan(q.y, q.x); float k = u_k; vec3 col = u_col; vec3 o = vec3(0.);",
    "  if (u_mode == 0) {",
    "    o = col * exp(-r * r * 6.) * (1. - k) * .55 + vec3(1.) * exp(-r * r * 40.) * (1. - k) * .3;",
    "  } else if (u_mode == 1) {",
    "    float R = 1. - pow(1. - k, 3.); float w = .02 + .1 * (1. - k);",
    "    float ring = exp(-pow((r - R * .95) / w, 2.)) * pow(1. - k, 1.4);",
    "    ring *= .55 + .45 * fbm(vec2(a * 3. + u_seed, k * 4.));",
    "    o = mix(col, vec3(1.), .25) * ring * 1.05;",
    "  } else if (u_mode == 2) {",
    "    float on = smoothstep(0., .25, k) * (1. - smoothstep(.6, 1., k)); float sp = u_time * .9 + u_seed;",
    "    float sc = .75 + .25 * smoothstep(0., .4, k); float rr = r / sc;",
    "    float ring1 = exp(-pow((rr - .92) / .012, 2.)) + exp(-pow((rr - .78) / .008, 2.)) * .8 + exp(-pow((rr - .5) / .01, 2.)) * .6;",
    "    float ang = a + sp; float cell = ang / 6.2832 * 28.;",
    "    float glyph = step(.55, h2(vec2(floor(cell), 3.))) * step(.80, rr) * step(rr, .9) * smoothstep(.5, .45, abs(fract(cell) - .5)) * .9;",
    "    float ang2 = a - sp * 1.6; float tick = smoothstep(.02, 0., abs(fract(ang2 / 6.2832 * 12.) - .5) - .47) * step(.5, rr) * step(rr, .78);",
    "    float tri = 0.; for (int i = 0; i < 3; i++) { float t = float(i) * 2.0944 + sp * .5; vec2 d = vec2(cos(t), sin(t));",
    "      tri += exp(-pow((dot(q / sc, d) + .25) / .008, 2.)) * step(rr, .5); }",
    "    o = col * (ring1 + glyph * .7 + tick * .6 + tri * .45) * on * .85 + col * exp(-rr * rr * 3.) * on * .06;",
    "  } else if (u_mode == 3) {",
    "    float rays = pow(fbm(vec2(a * 5. + u_seed, k * 2.)), 2.6) * 1.7;",
    "    float reach = .25 + .75 * pow(k, .5);",
    "    float body = rays * smoothstep(reach, reach * .2, r) * (1. - k);",
    "    o = mix(col, vec3(1., .97, .9), smoothstep(.3, 0., r) * .5) * (body * .8 + exp(-r * r * 60.) * (1. - k) * .35);",
    "  } else if (u_mode == 4) {",
    "    float x = q.x; float y = v.y;",
    "    float beam = exp(-x * x * 26.) * smoothstep(0., .25, y) * smoothstep(1., .55, y) * (1. - k);",
    "    beam *= .6 + .4 * fbm(vec2(x * 5., y * 3. - u_time * 2.5));",
    "    o = mix(col, vec3(1.), .2) * beam * .5;",
    "  } else if (u_mode == 5) {",
    "    float on = smoothstep(0., .15, k) * (1. - smoothstep(.55, 1., k));",
    "    float ring = exp(-pow((r - .62 - .06 * fbm(vec2(a * 4., u_seed))) / .025, 2.));",
    "    float cr = 0.; for (int i = 0; i < 7; i++) { float t = float(i) * .8976 + u_seed; float d = abs(sin(a - t + (fbm(vec2(r * 6., float(i))) - .5) * .5));",
    "      cr += smoothstep(.06, 0., d * r * 3.) * step(r, .62 * smoothstep(0., .5, k) + .05); }",
    "    float star = 0.; for (int i = 0; i < 5; i++) { float t = float(i) * 1.2566 - 1.5708; vec2 p1 = vec2(cos(t), sin(t)) * .5, p2 = vec2(cos(t + 2.5133), sin(t + 2.5133)) * .5;",
    "      vec2 pa = q - p1, ba = p2 - p1; float hh = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); star += exp(-pow(length(pa - ba * hh) / .012, 2.)); }",
    "    o = col * (ring * 1.5 + cr * 1.2 + star * .9) * on + vec3(.9, .8, 1.) * exp(-r * r * 30.) * on * .6;",
    "  } else if (u_mode == 6) {",
    "    float y = 1. - v.y; float x = q.x;",
    "    float fl = fbm(vec2(x * 3.5 + u_seed, y * 2.6 - u_time * 3.2));",
    "    float shape = smoothstep(1., .25, y + abs(x) * .7 - fl * .6) * smoothstep(0., .3, y) * smoothstep(1., .55, abs(x));",
    "    float life = (1. - k) * smoothstep(0., .12, k);",
    "    o = mix(col, vec3(1., .95, .8), smoothstep(.7, 1., shape) * .6) * shape * shape * life * .55;",
    "  } else if (u_mode == 7) {",
    "    o = col * exp(-r * r * 9.) * 1.2 + vec3(1.) * exp(-r * r * 60.);",
    "  } else if (u_mode == 8) {",
    // riga di scansione: un filo bianco, un alone nel colore della casata più largo dietro di sé
    "    float y = q.y; float taper = smoothstep(1., .5, abs(q.x));",
    "    float fl = .75 + .25 * fbm(vec2(q.x * 5. + u_time * 9., u_seed));",
    "    float halo = exp(-y * y * (y < 0. ? 7. : 26.));",
    "    o = (col * halo * .5 + vec3(1., .97, .9) * exp(-y * y * 700.) * 1.1) * taper * fl;",
    "  } else if (u_mode == 9) {",
    // cornice della carta (angoli tondi) che si disegna seguendo la scansione: u_p = fin dove è arrivata
    "    vec2 hp = q * u_aux * .5; vec2 dd = abs(hp) - (u_aux * .5 - 18.) + 7.;",
    "    float sd = length(max(dd, 0.)) + min(max(dd.x, dd.y), 0.) - 7.;",
    "    float line = exp(-sd * sd / 2.5) + exp(-abs(sd) / (sd > 0. ? 6. : 2.5)) * .32;",   // l'alone va in fuori: dentro la carta resta nitida
    "    float sw = (v.x * .3 + v.y) / 1.3;",
    "    o = mix(col, vec3(1.), .25) * line * smoothstep(u_p + .04, u_p - .06, sw);",
    "  }",
    "  gl_FragColor = vec4(o, 1.);",
    "}"
  ].join("\n");
  // Sprite dipinti (art/vfx/*.jpg, dipinti con Gemini su nero): si accendono a raggiera, ruotano,
  // si colorano un po' con la casata, si dissolvono.
  var FS_SPRITE = PREC + NOISE + [
    "uniform sampler2D u_tex; uniform float u_alpha, u_tintAmt, u_wipe, u_dissolve, u_seed; uniform vec3 u_tint; varying vec2 v;",
    "void main(){",
    "  vec4 t = texture2D(u_tex, v); vec3 c = t.rgb;",
    "  float lum = max(c.r, max(c.g, c.b));",
    "  c = mix(c, u_tint * lum * 1.25 + c * .15, u_tintAmt);",
    "  vec2 q = v * 2. - 1.; float an = atan(q.x, -q.y) / 6.2832 + .5;",
    "  float wipe = smoothstep(u_wipe, u_wipe - .06, an) ;",
    "  float dis = smoothstep(u_dissolve, u_dissolve + .12, fbm(v * 5. + u_seed) * .8 + .1);",
    "  gl_FragColor = vec4(c * u_alpha * wipe * dis, 1.);",
    "}"
  ].join("\n");
  // Strato d'ombra: carta che brucia (texture) e fumo
  var FS_DARK = PREC + NOISE + [
    "uniform int u_mode; uniform float u_k, u_time, u_seed; uniform vec3 u_col; uniform sampler2D u_tex; uniform vec4 u_crop; varying vec2 v;",
    "void main(){",
    "  vec2 q = v * 2. - 1.; float r = length(q);",
    "  if (u_mode == 6) {",
    "    vec2 uv = u_crop.xy + v * u_crop.zw;",
    "    vec4 c = texture2D(u_tex, uv);",
    "    float n = fbm(v * vec2(4., 5.6) + u_seed) * .75 + (1. - max(abs(q.x), abs(q.y))) * .45;",
    "    float th = u_k * 1.25 - .05;",
    "    if (n < th) discard;",
    "    float edge = smoothstep(.09, 0., n - th);",
    "    vec3 burn = mix(c.rgb, vec3(.08, .03, .01), smoothstep(.18, 0., n - th));",
    "    vec3 o = burn + vec3(1., .55, .15) * edge * 1.4 + vec3(1., .9, .6) * smoothstep(.025, 0., n - th);",
    "    gl_FragColor = vec4(o, 1.);",
    "  } else {",
    "    float f = fbm(q * 2.2 + vec2(u_seed, -u_time * .6));",
    "    float a = smoothstep(1., .2, r + (f - .5) * .8) * (1. - u_k) * smoothstep(0., .15, u_k) * .55;",
    "    vec3 o = mix(vec3(.06, .02, .1), u_col * .35, smoothstep(.6, .9, f));",
    "    gl_FragColor = vec4(o * a, a);",
    "  }",
    "}"
  ].join("\n");
  // Tessere: la carta è tagliata in pezzi (triangoli irregolari, mattoni o quadretti); ognuno ha il
  // suo centro (c), due numeri a caso (r) e le coordinate per accendere i bordi (b). Lo stesso
  // disegno serve ai due strati: nell'ombra con l'illustrazione, nella luce solo bordi e lampi.
  //   modo 0 = rivelazione sul posto · modo 1 = volo dalla mano alla rovina
  //   stile 0 misto · 1 guardia · 2 selva · 3 congrega · 4 tesoro · 5 fondo
  var VS_SHARD = [
    "attribute vec2 p, c, r, b; uniform vec2 u_view, u_to, u_ts, u_from, u_fs; uniform float u_k, u_mode, u_amp, u_bend, u_seed, u_start, u_style;",
    "varying vec2 v_uv, v_b; varying vec3 v_fx; varying float v_sh;",
    "vec2 rot(vec2 q, float a){ float cs = cos(a), sn = sin(a); return vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y); }",
    "void main(){",
    "  vec2 rr = fract(r + u_seed * vec2(.731, .377)); vec2 loc = p - c, cc = c - .5; vec2 pos; float glow, face, flash; float st = u_style;",
    "  float wind = fract(u_seed * .37) < .5 ? -1. : 1.;",
    "  if (u_mode < .5) {",
    // s = quando tocca a questa tessera (0 prima, 1 ultima); dir = dove va quando si stacca;
    // spin = quanto ruota; twist = vortice attorno al centro; open = quanto la carta si allarga; fx = si gira in orizzontale
    "    float s; vec2 dir; float spin = .9, twist = 0., open = 0., fx = 0.;",
    "    if (st < .5) { s = (c.x * .3 + c.y) / 1.3; dir = cc * 2. + (rr - .5) * 1.1; }",                                     // di sbieco
    "    else if (st < 1.5) { s = c.y * .92 + c.x * .08; dir = vec2(0., -.45); spin = 0.; open = .16; }",                   // guardia: riga per riga
    "    else if (st < 2.5) { s = (1. - c.y) * .78 + rr.x * .22; dir = vec2(wind * (.9 + rr.x * 1.3), (rr.y - .5) * 1.5 - .5); spin = 2.2; }", // selva: vento
    "    else if (st < 3.5) { s = length(cc) * 1.41; dir = cc * .5; twist = 1.3; open = .3; }",                             // congrega: vortice
    "    else if (st < 4.5) { s = c.x * .88 + c.y * .12; dir = vec2(0.); spin = 0.; open = .12; fx = 1.; }",                // tesoro: colonne
    "    else { s = (1. - c.y) * .62 + rr.x * .38; dir = vec2((rr.x - .5) * 1.3, 1.2 + rr.y * 1.4); spin = 1.4; }",         // fondo: braci
    "    float lift = smoothstep(0., .14, u_k);",                              // tutte le tessere si staccano
    "    float tl = clamp((u_k - (.12 + s * .46 + rr.x * .06)) / .2, 0., 1.);", // poi tornano, quando passa la luce
    "    float t1 = tl - 1.; float home = t1 * t1 * (2.6 * t1 + 1.6) + 1.;",
    "    float away = lift * (1. - home);",
    "    float sc = (1. - .13 * lift * (1. - tl) + (rr.y - .5) * .18 * away * step(.01, spin)) * (1. + .3 * sin(tl * 3.1416));",
    "    float fl = abs(cos(tl * 3.1416));",                                   // si girano su se stesse
    "    vec2 q = loc * u_ts * sc * mix(vec2(1., fl), vec2(fl, 1.), fx);",
    "    q = rot(q, (rr.y - .5) * spin * away + twist * away * .6);",
    "    pos = u_to + rot(cc * u_ts, twist * away) * (1. + open * away) + dir * u_amp * away + q;",
    "    pos.y -= u_amp * .3 * sin(tl * 3.1416);",
    "    face = max(step(.5, tl), u_start * (1. - lift));",
    "    flash = smoothstep(.3, .5, tl) * (1. - smoothstep(.5, 1., tl));",
    "    glow = lift * (1. - tl) * .6;",
    "    v_sh = (rr.x - .5) * .9 * lift * (1. - tl);",
    "  } else if (u_mode < 1.5) {",
    // s = chi parte prima; tum = capriole; spin = rotazione; sq = quanto si stringe la fila; lat = quanto si sparge; hel = elica
    "    float s = c.y * .7 + rr.x * .3, tum = 1., spin = 5., sq = .4, lat = 1., hel = 0.;",
    "    if (st > .5 && st < 1.5) { s = c.y * .9 + c.x * .1; tum = 0.; spin = 0.; sq = .12; lat = .12; }",   // guardia: in fila ordinata
    "    else if (st < 2.5 && st > 1.5) { s = rr.x * .6 + c.y * .4; spin = 9.; sq = .2; lat = 1.9; }",       // selva: foglie
    "    else if (st < 3.5 && st > 2.5) { hel = 1.; sq = .6; lat = .35; }",                                  // congrega: elica
    "    else if (st < 4.5 && st > 3.5) { s = c.y * .55 + c.x * .45; spin = 0.; sq = .82; lat = .08; }",     // tesoro: un filo
    "    else if (st > 4.5) { s = (1. - c.y) * .6 + rr.x * .4; spin = 7.; sq = .35; lat = 1.4; }",           // fondo: braci
    "    float td = clamp((u_k - s * .28) / .56, 0., 1.);",
    "    float e = td < .5 ? 4. * td * td * td : 1. - pow(2. - 2. * td, 3.) * .5;",
    "    float arc = max(0., sin(e * 3.1416));",
    "    float crack = smoothstep(0., .1, u_k) * (1. - smoothstep(0., .25, td));",
    "    vec2 d = u_to - u_from; vec2 n = normalize(vec2(-d.y, d.x) + vec2(.0001, 0.));",
    "    vec2 size = mix(u_fs, u_ts, e);",
    "    float side = (rr.y - .5) * u_amp * lat + hel * sin(e * 9.5 + step(.5, c.x) * 3.1416 + rr.y * .8) * u_amp * .85;",
    "    pos = mix(u_from, u_to, e) + cc * size * (1. - arc * sq) + n * arc * (u_bend + side);",
    "    float sc = 1. - .1 * crack - arc * .2;",
    "    float turn = abs(cos(e * 3.1416 * (1. + floor(rr.y * 2.))));",
    "    vec2 q = loc * size * sc; q.x *= mix(1., .35 + .65 * turn, tum);",
    "    v_sh = ((rr.x - .5) * .7 + pow(1. - turn, 3.) * tum * 1.2) * arc;",
    "    pos += rot(q, (rr.x - .5) * spin * arc);",
    "    float fl = u_k - (s * .28 + .56);",
    "    flash = step(0., fl) * exp(-fl * 9.);",
    "    glow = max(crack * .5, pow(arc + .0001, .6));",
    "    face = 1.;",
    "  } else {",
    // maledizione: la crepa parte dal punto colpito (u_from) e corre per la carta; le tessere
    // sobbalzano, si spengono e tremano, poi tornano a posto
    "    vec2 hit = clamp((u_from - u_to) / u_ts, -.5, .5);",
    "    float t0 = length(cc - hit) * .2 + rr.x * .04;",
    "    float inn = smoothstep(t0, t0 + .05, u_k);",
    "    float heal = smoothstep(.6 + rr.x * .1, .86 + rr.x * .1, u_k);",
    "    float on = inn * (1. - heal);",
    "    float kick = inn * exp(-max(u_k - t0, 0.) * 10.);",
    "    vec2 dir = normalize(cc - hit + vec2(.001, .002));",
    "    float shake = sin(u_k * 75. + rr.y * 6.283) * on;",
    "    vec2 q = rot(loc * u_ts * (1. - .1 * on), (rr.y - .5) * (.35 * on + .9 * kick));",
    "    pos = u_to + cc * u_ts + dir * u_amp * (kick * 1.4 + on * .3) + vec2(shake * u_amp * .12, on * rr.x * u_amp * .45) + q;",
    "    glow = on; face = 1.; flash = kick; v_sh = (rr.x - .5) * .7 * on;",
    "  }",
    "  v_uv = p; v_b = b; v_fx = vec3(glow, face, flash);",
    "  gl_Position = vec4(pos.x / u_view.x * 2. - 1., 1. - pos.y / u_view.y * 2., 0., 1.);",
    "}"
  ].join("\n");
  // distanza dal bordo della tessera: triangoli (b = baricentriche) oppure mattoni e quadretti (b = angoli)
  var SHARD_EDGE = "float rim(vec2 b, float q){ return mix(min(b.x, min(b.y, 1. - b.x - b.y)), min(min(b.x, 1. - b.x), min(b.y, 1. - b.y)) * .7, q); }\n";
  var FS_SHARD_DARK = PREC + SHARD_EDGE + [
    "uniform sampler2D u_tex; uniform float u_hasTex, u_alpha, u_quad, u_curse, u_flat; uniform vec3 u_col; varying vec2 v_uv, v_b; varying vec3 v_fx; varying float v_sh;",
    "void main(){",
    "  vec4 art = mix(vec4(u_col * .2 + .04, 1.), texture2D(u_tex, v_uv), u_hasTex);",
    "  float lum = dot(art.rgb, vec3(.3, .55, .15));",
    "  vec3 veil = mix(art.rgb * .7, u_col * (lum * 1.2 + .06) * art.a, .42);",   // la carta "non ancora stampata"
    "  vec3 o = mix(veil, art.rgb, v_fx.y);",
    "  o = o * (1. + v_fx.z * 1.1) + mix(u_col, vec3(1.), .6) * v_fx.z * .4 * art.a;",
    "  o = mix(o, art.rgb * .8 + u_col * (.2 + lum * .7) * art.a, v_fx.x * .75);",
    "  o = o * (1. + v_sh * .8) + mix(u_col, vec3(1.), .7) * max(v_sh - .25, 0.) * .5 * art.a;",
    "  float edge = 1. - smoothstep(0., .08, rim(v_b, u_quad));",
    "  o += u_col * edge * (v_fx.x * .8 + v_fx.z * .5) * art.a;",
    // maledizione: la tessera si spegne (grigio violaceo), le crepe ardono; sotto, il vuoto (u_flat)
    "  vec3 oc = mix(art.rgb, vec3(lum) * vec3(.66, .54, .84) * .8, v_fx.x * .86) * (1. + v_sh * .7);",
    "  oc += (u_col * edge * (v_fx.x * .75 + v_fx.z * 1.3) + vec3(.85, .75, 1.) * v_fx.z * .3) * art.a;",
    "  o = mix(o, oc, u_curse);",
    "  o = mix(o, vec3(.035, .012, .06) * art.a, u_flat);",
    "  gl_FragColor = vec4(o, art.a) * u_alpha;",
    "}"
  ].join("\n");
  var FS_SHARD_LIGHT = PREC + SHARD_EDGE + [
    "uniform float u_alpha, u_quad, u_curse; uniform vec3 u_col; varying vec2 v_uv, v_b; varying vec3 v_fx; varying float v_sh;",
    "void main(){",
    "  float edge = 1. - smoothstep(0., .1, rim(v_b, u_quad));",
    "  vec3 o = u_col * (edge * (v_fx.x * 1.1 + v_fx.z * .6) + v_fx.x * .3) + mix(u_col, vec3(1.), .5) * (v_fx.z * .5 + max(v_sh - .25, 0.) * .45);",
    "  o = mix(o, u_col * edge * (v_fx.x * .5 + v_fx.z * 1.3) + vec3(.85, .75, 1.) * v_fx.z * .2, u_curse);",
    "  gl_FragColor = vec4(o * u_alpha, 1.);",
    "}"
  ].join("\n");
  // Nastro (raggio / tentacolo) lungo una curva
  var VS_STRIP = "attribute vec2 p; attribute vec2 t; uniform vec2 u_view; varying vec2 v; void main(){ v = t; gl_Position = vec4(p.x / u_view.x * 2. - 1., 1. - p.y / u_view.y * 2., 0., 1.); }";
  var FS_STRIP = PREC + NOISE + [
    "uniform float u_head, u_tail, u_time, u_curse, u_alpha, u_seed; uniform vec3 u_col; varying vec2 v;",
    "void main(){",
    "  float u = v.x, x = v.y * 2. - 1.;",
    "  if (u > u_head || u < u_tail) discard;",
    "  float span = max(.001, u_head - u_tail); float along = (u - u_tail) / span;",
    "  float taper = smoothstep(0., .35, along);",
    "  float flow = fbm(vec2(u * 9. - u_time * 6. + u_seed, x * 1.5));",
    "  float w = mix(1., .55 + .7 * flow, u_curse);",
    "  float core = exp(-x * x / (.012 * w)) * (1. - u_curse * .55);",
    "  float glow = exp(-x * x / (.18 * w)) * (.55 + .6 * flow);",
    "  float head = exp(-pow((u - u_head) / .03, 2.)) * 1.5;",
    "  vec3 o = (u_col * glow + mix(vec3(1., .98, .92), vec3(.95, .85, 1.), u_curse) * core) * taper + u_col * head * exp(-x * x * 3.);",
    "  gl_FragColor = vec4(o * u_alpha, 1.);",
    "}"
  ].join("\n");
  var FS_STRIP_DARK = PREC + NOISE + [
    "uniform float u_head, u_tail, u_time, u_alpha, u_seed; varying vec2 v;",
    "void main(){ float u = v.x, x = v.y * 2. - 1.; if (u > u_head || u < u_tail) discard;",
    "  float f = fbm(vec2(u * 7. - u_time * 4. + u_seed, x * 2.)); float a = smoothstep(1., .1, abs(x) + (f - .5) * .9) * .6 * u_alpha;",
    "  gl_FragColor = vec4(vec3(.05, .01, .08) * a, a); }"
  ].join("\n");
  // Scintille: quadrati allungati calcolati dalla CPU
  var VS_SPARK = "attribute vec2 p; attribute vec2 t; attribute vec4 c; uniform vec2 u_view; varying vec2 v; varying vec4 col; void main(){ v = t; col = c; gl_Position = vec4(p.x / u_view.x * 2. - 1., 1. - p.y / u_view.y * 2., 0., 1.); }";
  var FS_SPARK = PREC + "varying vec2 v; varying vec4 col; void main(){ float x = v.y * 2. - 1.; float a = exp(-x * x * 5.) * smoothstep(0., .6, v.x) * col.a; gl_FragColor = vec4(mix(col.rgb, vec3(1.), exp(-x * x * 30.) * smoothstep(.7, 1., v.x)) * a, 1.); }";
  // Bagliore: soglia + rimpicciolimento, sfocatura, unione
  var VS_FULL = "attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }";
  var FS_DOWN = PREC + "uniform sampler2D u_src; uniform vec2 u_px; varying vec2 v; void main(){ vec3 s = (texture2D(u_src, v + vec2(-.5, -.5) * u_px).rgb + texture2D(u_src, v + vec2(.5, -.5) * u_px).rgb + texture2D(u_src, v + vec2(-.5, .5) * u_px).rgb + texture2D(u_src, v + vec2(.5, .5) * u_px).rgb) * .25; float l = max(s.r, max(s.g, s.b)); gl_FragColor = vec4(s * smoothstep(.42, 1., l), 1.); }";
  var FS_BLUR = PREC + "uniform sampler2D u_src; uniform vec2 u_dir; varying vec2 v; void main(){ vec3 s = texture2D(u_src, v).rgb * .2270; s += (texture2D(u_src, v + u_dir * 1.3846).rgb + texture2D(u_src, v - u_dir * 1.3846).rgb) * .3162; s += (texture2D(u_src, v + u_dir * 3.2308).rgb + texture2D(u_src, v - u_dir * 3.2308).rgb) * .0703; gl_FragColor = vec4(s, 1.); }";
  var FS_COMP = PREC + "uniform sampler2D u_a, u_b; varying vec2 v; void main(){ vec3 c = texture2D(u_a, v).rgb; c = c / (1. + max(c.r, max(c.g, c.b)) * .35) + texture2D(u_b, v).rgb * 1.1; gl_FragColor = vec4(c, 1.); }";

  function prog(g, vs, fs, attrs) {
    function sh(t, s) { var o = g.createShader(t); g.shaderSource(o, s); g.compileShader(o); if (!g.getShaderParameter(o, g.COMPILE_STATUS)) { console.warn("effetti:", g.getShaderInfoLog(o)); return null; } return o; }
    var a = sh(g.VERTEX_SHADER, vs), b = sh(g.FRAGMENT_SHADER, fs);
    if (!a || !b) return null;
    var p = g.createProgram(); g.attachShader(p, a); g.attachShader(p, b);
    (attrs || ["p"]).forEach(function (n, i) { g.bindAttribLocation(p, i, n); });
    g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) { console.warn("effetti: link", g.getProgramInfoLog(p)); return null; }
    var u = {}, n = g.getProgramParameter(p, g.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = g.getActiveUniform(p, i); u[info.name.replace("[0]", "")] = g.getUniformLocation(p, info.name); }
    return { p: p, u: u };
  }
  var L = {}, D = {};
  if (OK) {
    L.quad = prog(gl, VS_QUAD, FS_LIGHT); L.strip = prog(gl, VS_STRIP, FS_STRIP, ["p", "t"]); L.spark = prog(gl, VS_SPARK, FS_SPARK, ["p", "t", "c"]);
    L.sprite = prog(gl, VS_QUAD, FS_SPRITE);
    L.shard = prog(gl, VS_SHARD, FS_SHARD_LIGHT, ["p", "c", "r", "b"]); D.shard = prog(gd, VS_SHARD, FS_SHARD_DARK, ["p", "c", "r", "b"]);
    L.down = prog(gl, VS_FULL, FS_DOWN); L.blur = prog(gl, VS_FULL, FS_BLUR); L.comp = prog(gl, VS_FULL, FS_COMP);
    D.quad = prog(gd, VS_QUAD, FS_DARK); D.strip = prog(gd, VS_STRIP, FS_STRIP_DARK, ["p", "t"]);
    OK = !!(L.quad && L.sprite && L.shard && L.strip && L.spark && L.down && L.blur && L.comp && D.quad && D.shard && D.strip);
  }
  function quadBuf(g) { var b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW); return b; }
  var QL, QD, SB_L, SB_D, PB;
  if (OK) { QL = quadBuf(gl); QD = quadBuf(gd); SB_L = gl.createBuffer(); SB_D = gd.createBuffer(); PB = gl.createBuffer(); }
  // La carta tagliata in tessere. Tre tagli, ognuno in due misure (carte piccole del telefono / le altre):
  //   triangoli irregolari (griglia con i nodi un po' spostati, ogni casella divisa in due)
  //   mattoni sfalsati come in un muro (Guardia) · quadretti da mosaico (Tesoro)
  function shardGeo(cols, rows) {
    var P = [], out = [], i, j;
    for (j = 0; j <= rows; j++) for (i = 0; i <= cols; i++) {
      var x = i / cols, y = j / rows;
      if (i > 0 && i < cols) x += (Math.random() - .5) * .56 / cols;
      if (j > 0 && j < rows) y += (Math.random() - .5) * .56 / rows;
      P.push([x, y]);
    }
    function tri(a, b, c) {
      var cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, r1 = Math.random(), r2 = Math.random();
      out.push(a[0], a[1], cx, cy, r1, r2, 1, 0, b[0], b[1], cx, cy, r1, r2, 0, 1, c[0], c[1], cx, cy, r1, r2, 0, 0);
    }
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      var a = P[j * (cols + 1) + i], b = P[j * (cols + 1) + i + 1], c = P[(j + 1) * (cols + 1) + i], d = P[(j + 1) * (cols + 1) + i + 1];
      if (Math.random() < .5) { tri(a, b, c); tri(b, d, c); } else { tri(a, b, d); tri(a, d, c); }
    }
    return new Float32Array(out);
  }
  function tileGeo(cols, rows, bond) {
    var out = [];
    for (var j = 0; j < rows; j++) {
      var xs = [0], i;
      if (bond && j % 2) { for (i = 0; i < cols; i++) xs.push((i + .5) / cols); xs.push(1); } else for (i = 1; i <= cols; i++) xs.push(i / cols);
      for (i = 0; i + 1 < xs.length; i++) {
        var x0 = xs[i], x1 = xs[i + 1], y0 = j / rows, y1 = (j + 1) / rows, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r1 = Math.random(), r2 = Math.random();
        [[x0, y0, 0, 0], [x1, y0, 1, 0], [x0, y1, 0, 1], [x1, y0, 1, 0], [x1, y1, 1, 1], [x0, y1, 0, 1]].forEach(function (v) { out.push(v[0], v[1], cx, cy, r1, r2, v[2], v[3]); });
      }
    }
    return new Float32Array(out);
  }
  var GEO = [], BLANK = null;
  if (OK) {
    [shardGeo(5, 7), shardGeo(7, 10), tileGeo(3, 7, true), tileGeo(4, 9, true), tileGeo(5, 7, false), tileGeo(7, 10, false)].forEach(function (data, i) {
      var o = { n: data.length / 8, quad: i > 1 ? 1 : 0, l: gl.createBuffer(), d: gd.createBuffer() };
      gl.bindBuffer(gl.ARRAY_BUFFER, o.l); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gd.bindBuffer(gd.ARRAY_BUFFER, o.d); gd.bufferData(gd.ARRAY_BUFFER, data, gd.STATIC_DRAW);
      GEO.push(o);
    });
    BLANK = gd.createTexture(); gd.bindTexture(gd.TEXTURE_2D, BLANK);
    gd.texImage2D(gd.TEXTURE_2D, 0, gd.RGBA, 1, 1, 0, gd.RGBA, gd.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    // gli strati si accendono subito: la carta vera sparisce nello stesso istante in cui compaiono le tessere
    layer.style.transition = "none"; lightLayer.style.transition = "none";
  }

  var TEX = {};
  if (OK) ["fiamma", "stella", "fumo", "anello"].forEach(function (n) {
    var img = new Image();
    img.onload = function () {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      TEX[n] = t;
    };
    img.src = "art/vfx/" + n + ".jpg?v=1";
  });
  // bersagli per il bagliore
  function target(w, h) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { t: t, f: f, w: w, h: h };
  }
  var RT = null, VW = 0, VH = 0, DPR = 1;
  function fit() {
    DPR = Math.min(1.5, window.devicePixelRatio || 1);
    VW = window.innerWidth; VH = window.innerHeight;
    var w = Math.round(VW * DPR), h = Math.round(VH * DPR);
    cvL.width = cvD.width = w; cvL.height = cvD.height = h;
    if (OK) {
      if (RT) [RT.scene, RT.a, RT.b].forEach(function (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); });
      var bw = Math.max(1, Math.round(w / 4)), bh = Math.max(1, Math.round(h / 4));
      RT = { scene: target(w, h), a: target(bw, bh), b: target(bw, bh) };
    }
  }
  if (OK) { fit(); window.addEventListener("resize", fit); }

  /* ───────── effetti vivi ───────── */
  var fx = [], sparks = [], running = false, t0 = performance.now() / 1000;
  var frozen = null; // per le prove: il tempo degli effetti si può fermare
  function now() { return frozen != null ? frozen : performance.now() / 1000; }
  function add(e) { if (frozen != null) return e; e.t0 = now() + (e.delay || 0); e.seed = e.seed != null ? e.seed : Math.random() * 50; fx.push(e); kick(); return e; }
  function kick() { if (!running && OK) { running = true; requestAnimationFrame(loop); } }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function center(r) { return [r.left + r.width / 2, r.top + r.height / 2]; }
  function bez(a, c, b, u) { var v = 1 - u; return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]; }
  function spark(x, y, vx, vy, col, life, opts) {
    opts = opts || {};
    if (frozen != null) return;
    sparks.push({ x: x, y: y, vx: vx, vy: vy, col: col, t0: now() + (opts.delay || 0), life: life, g: opts.g != null ? opts.g : 520, w: opts.w || 2.2, len: opts.len || 1 });
    kick();
  }

  function setQuad(g, P, buf) {
    g.useProgram(P.p); g.bindBuffer(g.ARRAY_BUFFER, buf); g.enableVertexAttribArray(0); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    g.disableVertexAttribArray(1); g.disableVertexAttribArray(2);
    g.uniform2f(P.u.u_view, VW, VH);
  }
  function drawQuad(g, P, e, mode, k, cx, cy, sx, sy, col, rot) {
    g.uniform1i(P.u.u_mode, mode); g.uniform1f(P.u.u_k, k); g.uniform1f(P.u.u_time, now() - t0); g.uniform1f(P.u.u_seed, e.seed);
    g.uniform3f(P.u.u_col, col[0], col[1], col[2]); g.uniform2f(P.u.u_c, cx, cy); g.uniform2f(P.u.u_s, sx, sy); g.uniform1f(P.u.u_rot, rot || 0);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
  }
  // nastro lungo una curva di Bézier: triangoli con (u lungo, v attraverso)
  function stripVerts(e, width) {
    var N = 48, out = [];
    for (var i = 0; i <= N; i++) {
      var u = i / N, p = bez(e.a, e.c, e.b, u), q = bez(e.a, e.c, e.b, Math.min(1, u + .01)), r0 = bez(e.a, e.c, e.b, Math.max(0, u - .01));
      var dx = q[0] - r0[0], dy = q[1] - r0[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      out.push(p[0] + nx * width, p[1] + ny * width, u, 0, p[0] - nx * width, p[1] - ny * width, u, 1);
    }
    return new Float32Array(out);
  }
  function sstep(a, b, x) { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); }
  function formAlpha(e, k) { return e.mode === 2 ? sstep(0, .05, k) * (1 - sstep(.86, 1, k)) : 1 - sstep(.9, 1, k); }
  function drawShards(g, P, buf, e, k, alpha) {
    g.useProgram(P.p); g.bindBuffer(g.ARRAY_BUFFER, buf);
    for (var i = 0; i < 4; i++) { g.enableVertexAttribArray(i); g.vertexAttribPointer(i, 2, g.FLOAT, false, 32, i * 8); }
    var u = P.u, f = e.from || e.to;
    g.uniform2f(u.u_view, VW, VH); g.uniform2f(u.u_to, e.to.x, e.to.y); g.uniform2f(u.u_ts, e.to.w, e.to.h);
    g.uniform2f(u.u_from, f.x, f.y); g.uniform2f(u.u_fs, f.w, f.h);
    g.uniform1f(u.u_k, k); g.uniform1f(u.u_mode, e.mode); g.uniform1f(u.u_amp, e.amp); g.uniform1f(u.u_bend, e.bend || 0);
    g.uniform1f(u.u_seed, e.seed); g.uniform1f(u.u_start, e.start ? 1 : 0); g.uniform1f(u.u_style, e.style); g.uniform1f(u.u_quad, GEO[e.geo].quad);
    g.uniform1f(u.u_alpha, alpha); g.uniform1f(u.u_curse, e.mode === 2 ? 1 : 0); g.uniform3f(u.u_col, e.col[0], e.col[1], e.col[2]);
    g.drawArrays(g.TRIANGLES, 0, GEO[e.geo].n);
    g.disableVertexAttribArray(3);
  }
  function headOf(e, T) { var el = T - e.t0, hd = Math.min(1, el / e.travel); hd = 1 - Math.pow(1 - hd, 3); return { el: el, hd: hd, tl: Math.max(0, hd - .55 - Math.max(0, el - e.travel) * 2.2) }; }

  function loop() {
    var T = now();
    fx = fx.filter(function (e) {
      if (T - e.t0 < e.dur) return true;
      e.dead = true; if (e.kind === "form" && e.tex) gd.deleteTexture(e.tex);
      return false;
    });
    sparks = sparks.filter(function (s) { return T - s.t0 < s.life; });
    if (!fx.length && !sparks.length) {
      running = false;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cvL.width, cvL.height); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gd.viewport(0, 0, cvD.width, cvD.height); gd.clearColor(0, 0, 0, 0); gd.clear(gd.COLOR_BUFFER_BIT);
      layer.classList.remove("on"); lightLayer.classList.remove("on");
      return;
    }
    layer.classList.add("on"); lightLayer.classList.add("on");
    requestAnimationFrame(loop);

    /* strato d'ombra */
    gd.viewport(0, 0, cvD.width, cvD.height); gd.clearColor(0, 0, 0, 0); gd.clear(gd.COLOR_BUFFER_BIT);
    gd.enable(gd.BLEND); gd.blendFunc(gd.ONE, gd.ONE_MINUS_SRC_ALPHA);
    fx.forEach(function (e) {
      var k = (T - e.t0) / e.dur;
      if (e.kind === "form") { // anche prima del suo turno: la carta vera è già nascosta
        gd.activeTexture(gd.TEXTURE0); gd.bindTexture(gd.TEXTURE_2D, e.tex || BLANK);
        gd.useProgram(D.shard.p); gd.uniform1i(D.shard.u.u_tex, 0); gd.uniform1f(D.shard.u.u_hasTex, e.tex ? 1 : 0);
        var k0 = Math.max(0, k), al = formAlpha(e, k0);
        // la maledizione non nasconde la carta vera: la copre, con il buio sotto le tessere che si scostano
        if (e.mode === 2) { gd.uniform1f(D.shard.u.u_flat, 1); drawShards(gd, D.shard, GEO[e.geo].d, e, 0, al); gd.uniform1f(D.shard.u.u_flat, 0); }
        drawShards(gd, D.shard, GEO[e.geo].d, e, k0, al);
        return;
      }
      if (k < 0) return;
      if (e.kind === "burn" && e.tex) {
        setQuad(gd, D.quad, QD);
        gd.activeTexture(gd.TEXTURE0); gd.bindTexture(gd.TEXTURE_2D, e.tex); gd.uniform1i(D.quad.u.u_tex, 0);
        gd.uniform4f(D.quad.u.u_crop, e.crop[0], e.crop[1], e.crop[2], e.crop[3]);
        drawQuad(gd, D.quad, e, 6, k, e.x, e.y - Math.sin(k * 3.1416) * 6, e.w, e.h, [1, 1, 1], k * k * e.spin);
      } else if (e.kind === "smoke") {
        setQuad(gd, D.quad, QD);
        var s = e.size * (1 + k * 1.4);
        drawQuad(gd, D.quad, e, 7, k, e.x + e.vx * k, e.y + e.vy * k, s, s, e.col);
      } else if (e.kind === "beam" && e.curse) {
        var H = headOf(e, T);
        gd.useProgram(D.strip.p); gd.bindBuffer(gd.ARRAY_BUFFER, SB_D); gd.bufferData(gd.ARRAY_BUFFER, stripVerts(e, 24), gd.DYNAMIC_DRAW);
        gd.enableVertexAttribArray(0); gd.vertexAttribPointer(0, 2, gd.FLOAT, false, 16, 0); gd.enableVertexAttribArray(1); gd.vertexAttribPointer(1, 2, gd.FLOAT, false, 16, 8);
        gd.uniform2f(D.strip.u.u_view, VW, VH); gd.uniform1f(D.strip.u.u_head, H.hd); gd.uniform1f(D.strip.u.u_tail, H.tl);
        gd.uniform1f(D.strip.u.u_time, T - t0); gd.uniform1f(D.strip.u.u_seed, e.seed); gd.uniform1f(D.strip.u.u_alpha, Math.max(0, 1 - Math.max(0, H.el - e.travel) / .5));
        gd.drawArrays(gd.TRIANGLE_STRIP, 0, 98);
      }
    });

    /* strato di luce: prima in una texture, poi il bagliore */
    gl.bindFramebuffer(gl.FRAMEBUFFER, RT.scene.f); gl.viewport(0, 0, RT.scene.w, RT.scene.h);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    fx.forEach(function (e) {
      var k = (T - e.t0) / e.dur; if (k < 0) return;
      switch (e.kind) {
        case "form": {
          drawShards(gl, L.shard, GEO[e.geo].l, e, k, formAlpha(e, k));
          var t = e.to, c = e.col, P9 = L.quad;
          if (e.mode === 2) { // faville viola che salgono dalle crepe
            if (k > .1 && k < .7 && Math.random() < .45) spark(t.x + rnd(-.5, .5) * t.w, t.y + rnd(-.5, .5) * t.h, rnd(-25, 25), rnd(-110, -40), mix(c, [.9, .8, 1]), rnd(.3, .5), { g: -30, w: 1.4 });
            break;
          }
          setQuad(gl, P9, QL); gl.uniform2f(P9.u.u_aux, t.w + 36, t.h + 36);
          if (e.mode === 0) {
            var f = (k - .12) / .46; // dove è arrivata la scansione (0 = prima tessera, 1 = ultima)
            var on = sstep(-.12, .04, f) * (1 - sstep(.95, 1.12, f)), st = e.style, cs = [c[0] * on, c[1] * on, c[2] * on];
            var lx = t.x, ly = t.y, len = t.w * 1.4, ang = 0, sl = Math.max(30, t.w * .5), sx = 0, sy = 0;
            if (st === 0) { ly = t.y + t.h * (1.3 * f - .65); ang = Math.atan(-.3 * t.h / t.w); len = t.w * 1.5; } // di sbieco, in giù
            else if (st === 1) ly = t.y + t.h * (f - .5);                                                       // dritta, in giù
            else if (st === 2 || st === 5) { ly = t.y + t.h * (.5 - f); ang = Math.PI; }                        // dritta, in su
            else if (st === 4) { lx = t.x + t.w * (f - .5); ang = -Math.PI / 2; len = t.h * 1.3; }              // in piedi, verso destra
            if (on > 0) {
              if (st === 3) { // la Congrega non ha una riga: le tessere tornano dal centro in fuori, a vortice
                var ra = rnd(0, 6.283); sx = t.x + Math.cos(ra) * f * .707 * t.w; sy = t.y + Math.sin(ra) * f * .707 * t.h;
              } else {
                drawQuad(gl, P9, e, 8, 0, lx, ly, len, sl, cs, ang);
                var ux = rnd(-.5, .5) * len * .68; sx = lx + Math.cos(ang) * ux; sy = ly + Math.sin(ang) * ux;
              }
              if (f > 0 && f < 1 && Math.random() < (e.big ? 1 : .65)) {
                if (st === 5) spark(sx, sy, rnd(-30, 30), rnd(-190, -70), mix(c, [1, .8, .5]), rnd(.3, .55), { g: -60, w: 1.5 });       // braci che salgono
                else if (st === 2) spark(sx, sy, rnd(60, 150) * ((e.seed * .37) % 1 < .5 ? -1 : 1), rnd(-60, 20), mix(c, [1, .95, .85]), rnd(.25, .45), { g: 60, w: 1.4 });
                else spark(sx, sy, rnd(-50, 50), rnd(-130, -30), mix(c, [1, .95, .85]), rnd(.22, .42), { g: 260, w: 1.4 });
              }
            }
            var lock = sstep(.7, .82, k) * (1 - sstep(.84, 1, k)), I = (.4 * (st ? sstep(-.1, .8, f) : 1) + lock * (e.big ? 1.9 : 1.3)) * (1 - sstep(.9, 1, k));
            gl.uniform1f(P9.u.u_p, st ? 2 : f);
            drawQuad(gl, P9, e, 9, 0, t.x, t.y, t.w + 36, t.h + 36, [c[0] * I, c[1] * I, c[2] * I]);
          } else {
            var I2 = sstep(.55, .84, k) * (1 - sstep(.86, 1, k)) * 1.25;
            if (I2 > 0) { gl.uniform1f(P9.u.u_p, 2); drawQuad(gl, P9, e, 9, 0, t.x, t.y, t.w + 36, t.h + 36, [c[0] * I2, c[1] * I2, c[2] * I2]); }
            // qualche scintilla resta indietro lungo la scia
            var m2 = Math.max(0, Math.min(1, (k - .1) / .55));
            if (k > .08 && k < .7 && Math.random() < .6) spark(e.from.x + (t.x - e.from.x) * m2 + rnd(-14, 14), e.from.y + (t.y - e.from.y) * m2 + rnd(-14, 14), rnd(-40, 40), rnd(-40, 40), mix(c, [1, .95, .85]), rnd(.2, .38), { g: 90, w: 1.4 });
          }
          break;
        }
        case "glow": setQuad(gl, L.quad, QL); drawQuad(gl, L.quad, e, 0, k, e.x, e.y, e.size, e.size, e.col); break;
        case "ring": setQuad(gl, L.quad, QL); drawQuad(gl, L.quad, e, 1, k, e.x, e.y, e.size, e.size * (e.squash || 1), e.col); break;
        case "rune": setQuad(gl, L.quad, QL); drawQuad(gl, L.quad, e, 2, k, e.x, e.y, e.size, e.size * .42, e.col); break;
        case "nova": setQuad(gl, L.quad, QL); drawQuad(gl, L.quad, e, 3, k, e.x, e.y, e.size, e.size, e.col); break;
        case "pillar": setQuad(gl, L.quad, QL); drawQuad(gl, L.quad, e, 4, k, e.x, e.y, e.w, e.h, e.col); break;
        case "hex": setQuad(gl, L.quad, QL); drawQuad(gl, L.quad, e, 5, k, e.x, e.y, e.size, e.size, e.col, e.seed); break;
        case "flame": setQuad(gl, L.quad, QL); drawQuad(gl, L.quad, e, 6, k, e.x, e.y, e.w, e.h, e.col); break;
        case "burn": break; // la luce della carta che brucia la fanno le fiamme dipinte
        case "sprite": {
          var tx = TEX[e.tex]; if (!tx) break;
          var P = L.sprite; setQuad(gl, P, QL);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform1i(P.u.u_tex, 0);
          var ein = e.fin || .12, eout = e.fout || .5;
          var al = Math.min(1, k / ein) * Math.min(1, (1 - k) / eout) * (e.a || 1);
          var sc = e.s0 + (e.s1 - e.s0) * (1 - Math.pow(1 - k, e.pow || 3));
          gl.uniform1f(P.u.u_alpha, al); gl.uniform1f(P.u.u_tintAmt, e.tintAmt || 0); gl.uniform3f(P.u.u_tint, (e.tint || [1, 1, 1])[0], (e.tint || [1, 1, 1])[1], (e.tint || [1, 1, 1])[2]);
          gl.uniform1f(P.u.u_wipe, e.wipe ? Math.min(1.06, (T - e.t0) / e.wipe * 1.06) : 1.06);
          gl.uniform1f(P.u.u_dissolve, e.dis ? Math.max(0, (k - (1 - e.dis)) / e.dis) : 0);
          gl.uniform1f(P.u.u_seed, e.seed);
          gl.uniform2f(P.u.u_c, e.x + (e.vx || 0) * k, e.y + (e.vy || 0) * k);
          gl.uniform2f(P.u.u_s, e.w * sc, e.h * sc); gl.uniform1f(P.u.u_rot, (e.rot || 0) + (e.spin || 0) * (T - e.t0));
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          break;
        }
        case "beam": {
          var H = headOf(e, T);
          gl.useProgram(L.strip.p); gl.bindBuffer(gl.ARRAY_BUFFER, SB_L); gl.bufferData(gl.ARRAY_BUFFER, stripVerts(e, e.curse ? 16 : 13), gl.DYNAMIC_DRAW);
          gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8); gl.disableVertexAttribArray(2);
          gl.uniform2f(L.strip.u.u_view, VW, VH); gl.uniform1f(L.strip.u.u_head, H.hd); gl.uniform1f(L.strip.u.u_tail, H.tl);
          gl.uniform1f(L.strip.u.u_time, T - t0); gl.uniform1f(L.strip.u.u_curse, e.curse ? 1 : 0); gl.uniform1f(L.strip.u.u_seed, e.seed);
          gl.uniform1f(L.strip.u.u_alpha, Math.max(0, 1 - Math.max(0, H.el - e.travel) / .45)); gl.uniform3f(L.strip.u.u_col, e.col[0], e.col[1], e.col[2]);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 98);
          if (H.el < e.travel) {
            var hp = bez(e.a, e.c, e.b, H.hd);
            setQuad(gl, L.quad, QL); drawQuad(gl, L.quad, e, 7, 0, hp[0], hp[1], e.curse ? 54 : 46, e.curse ? 54 : 46, e.col);
            if (Math.random() < .8) { var an = Math.random() * 6.28; spark(hp[0], hp[1], Math.cos(an) * 90, Math.sin(an) * 90 - 30, e.col, .35, { g: 120, w: 1.6 }); }
          }
          if (!e.hit && H.el >= e.travel) { e.hit = true; if (e.onHit) e.onHit(); }
          break;
        }
      }
    });
    // scintille
    if (sparks.length) {
      var arr = [];
      sparks.forEach(function (s) {
        var a = T - s.t0; if (a < 0) return;
        var k = a / s.life;
        var x = s.x + s.vx * a, y = s.y + s.vy * a + .5 * s.g * a * a, vx = s.vx, vy = s.vy + s.g * a;
        var sp = Math.hypot(vx, vy) || 1, ux = vx / sp, uy = vy / sp, len = Math.min(34, 6 + sp * .045) * s.len, w = s.w;
        var tx = x - ux * len, ty = y - uy * len, nx = -uy * w, ny = ux * w, al = 1 - k, c = s.col;
        arr.push(tx + nx, ty + ny, 0, 0, c[0], c[1], c[2], al, tx - nx, ty - ny, 0, 1, c[0], c[1], c[2], al, x + nx, y + ny, 1, 0, c[0], c[1], c[2], al,
          tx - nx, ty - ny, 0, 1, c[0], c[1], c[2], al, x - nx, y - ny, 1, 1, c[0], c[1], c[2], al, x + nx, y + ny, 1, 0, c[0], c[1], c[2], al);
      });
      if (arr.length) {
        gl.useProgram(L.spark.p); gl.bindBuffer(gl.ARRAY_BUFFER, PB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 32, 0);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 8);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
        gl.uniform2f(L.spark.u.u_view, VW, VH);
        gl.drawArrays(gl.TRIANGLES, 0, arr.length / 8);
      }
    }
    // bagliore: soglia e rimpicciolimento, sfocatura in due passi, unione sullo schermo
    gl.disable(gl.BLEND);
    function full(P) { gl.useProgram(P.p); gl.bindBuffer(gl.ARRAY_BUFFER, QL); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, RT.a.f); gl.viewport(0, 0, RT.a.w, RT.a.h);
    full(L.down); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, RT.scene.t); gl.uniform1i(L.down.u.u_src, 0); gl.uniform2f(L.down.u.u_px, 1 / RT.scene.w, 1 / RT.scene.h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    for (var pass = 0; pass < 2; pass++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, RT.b.f); full(L.blur); gl.bindTexture(gl.TEXTURE_2D, RT.a.t); gl.uniform1i(L.blur.u.u_src, 0); gl.uniform2f(L.blur.u.u_dir, (1.5 + pass) / RT.a.w, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, RT.a.f); full(L.blur); gl.bindTexture(gl.TEXTURE_2D, RT.b.t); gl.uniform1i(L.blur.u.u_src, 0); gl.uniform2f(L.blur.u.u_dir, 0, (1.5 + pass) / RT.a.h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cvL.width, cvL.height);
    full(L.comp); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, RT.scene.t); gl.uniform1i(L.comp.u.u_a, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, RT.a.t); gl.uniform1i(L.comp.u.u_b, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.activeTexture(gl.TEXTURE0);
  }

  /* ───────── le scene ───────── */
  function pieceAt(uid) { return board.querySelector('.piece[data-uid="' + uid + '"]'); }
  function react(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  function sprite(o) { o.kind = "sprite"; return add(o); }
  // le carte sul tavolo del telefono sono piccole: gli effetti si misurano su una carta "minima"
  function grow(r) { var W = Math.max(r.width, 70), H = Math.max(r.height, 98); return { left: r.left + (r.width - W) / 2, top: r.top + (r.height - H) / 2, width: W, height: H, bottom: r.bottom + (H - r.height) / 2 }; }
  /* La carta si scompone e si ricompone: "form" è la carta fatta di tessere.
   *   to / from = dove deve comporsi e (per la posa) da dove parte: centro e misure in px
   * L'illustrazione viene ridisegnata piccola su una tela (taglio, sfumatura e bordo come nel CSS) e
   * passata alla scheda grafica; se non è ancora arrivata le tessere sono di vetro colorato e
   * l'immagine entra appena pronta. La carta vera resta nascosta finché le tessere non hanno finito. */
  function box(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }
  function bake(e, el, im, scale) {
    if (e.dead) return;
    try {
      var w = e.to.w, h = e.to.h, S = Math.min(4, scale), pw = Math.max(8, Math.round(w * S)), ph = Math.max(8, Math.round(h * S));
      if (pw > 384) { S *= 384 / pw; pw = 384; ph = Math.round(h * S); }
      var lk = e.look, rad = lk.rad * S, bw = lk.bw * S;
      var cv = document.createElement("canvas"); cv.width = pw; cv.height = ph;
      var x = cv.getContext("2d");
      x.beginPath(); x.moveTo(rad, 0); x.arcTo(pw, 0, pw, ph, rad); x.arcTo(pw, ph, 0, ph, rad); x.arcTo(0, ph, 0, 0, rad); x.arcTo(0, 0, pw, 0, rad); x.closePath();
      x.save(); x.clip();
      x.fillStyle = "#15111a"; x.fillRect(0, 0, pw, ph);
      if (im && im.naturalWidth) {
        var iw = im.naturalWidth, ih = im.naturalHeight, k = Math.max(pw / iw, ph / ih), sw = pw / k, sh = ph / k;
        x.imageSmoothingQuality = "high";
        x.drawImage(im, (iw - sw) * .5, (ih - sh) * e.posY, sw, sh, 0, 0, pw, ph);
        var g = x.createLinearGradient(0, 0, 0, ph);
        g.addColorStop(0, "rgba(0,0,0,.35)"); g.addColorStop(.3, "rgba(0,0,0,0)"); g.addColorStop(.62, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.7)");
        x.fillStyle = g; x.fillRect(0, 0, pw, ph);
      }
      lk.marks.forEach(function (m) { // costo e forza, come sulla carta vera
        var X = m.x * S, Y = m.y * S, Wm = m.w * S, Hm = m.h * S, R = Math.min(m.rad * S, Wm / 2, Hm / 2);
        x.save(); x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + Wm, Y, X + Wm, Y + Hm, R); x.arcTo(X + Wm, Y + Hm, X, Y + Hm, R); x.arcTo(X, Y + Hm, X, Y, R); x.arcTo(X, Y, X + Wm, Y, R); x.closePath();
        x.fillStyle = m.bg; x.fill();
        x.fillStyle = m.fg; x.font = m.weight + " " + (m.size * S) + "px " + m.family; x.textAlign = "center"; x.textBaseline = "middle";
        x.fillText(m.text, X + Wm / 2, Y + Hm / 2 + m.size * S * .06);
        x.restore();
      });
      x.lineWidth = bw * 2; x.strokeStyle = e.edge || lk.bc; x.stroke();
      x.restore();
      var t = gd.createTexture(); gd.bindTexture(gd.TEXTURE_2D, t);
      gd.pixelStorei(gd.UNPACK_FLIP_Y_WEBGL, false); gd.pixelStorei(gd.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gd.texImage2D(gd.TEXTURE_2D, 0, gd.RGBA, gd.RGBA, gd.UNSIGNED_BYTE, cv);
      gd.pixelStorei(gd.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gd.texParameteri(gd.TEXTURE_2D, gd.TEXTURE_MIN_FILTER, gd.LINEAR); gd.texParameteri(gd.TEXTURE_2D, gd.TEXTURE_MAG_FILTER, gd.LINEAR);
      gd.texParameteri(gd.TEXTURE_2D, gd.TEXTURE_WRAP_S, gd.CLAMP_TO_EDGE); gd.texParameteri(gd.TEXTURE_2D, gd.TEXTURE_WRAP_T, gd.CLAMP_TO_EDGE);
      if (e.tex) gd.deleteTexture(e.tex);
      e.tex = t;
    } catch (err) { /* resta di vetro colorato */ }
  }
  // ogni casata ha il suo modo di scomporsi e ricomporsi (numero dello stile negli shader)
  var STYLE = { misto: 0, guardia: 1, selva: 2, congrega: 3, tesoro: 4, fondo: 5 };
  function look(el, withMarks) {
    var cs = getComputedStyle(el), pr = el.getBoundingClientRect();
    var o = { rad: parseFloat(cs.borderTopLeftRadius) || 8, bw: parseFloat(cs.borderTopWidth) || 1.5, bc: cs.borderTopColor, marks: [] };
    if (withMarks) [].forEach.call(el.querySelectorAll(".p-cost, .p-power"), function (m) {
      var r = m.getBoundingClientRect(), ms = getComputedStyle(m);
      if (!r.width || ms.display === "none") return;
      o.marks.push({ x: r.left - pr.left, y: r.top - pr.top, w: r.width, h: r.height, rad: parseFloat(ms.borderTopLeftRadius) || r.height / 2, bg: ms.backgroundColor, fg: ms.color,
        weight: ms.fontWeight, size: parseFloat(ms.fontSize) || 12, family: ms.fontFamily, text: m.textContent });
    });
    return o;
  }
  function form(e, el, scale) {
    e.kind = "form"; e.style = e.style || 0; e.posY = .3; e.look = look(el, e.marks);
    e.geo = (e.style === 1 ? 2 : e.style === 4 ? 4 : 0) + (e.to.w < 58 ? 0 : 1); // mattoni, quadretti o triangoli; piccoli o grandi
    var src = el.querySelector("img");
    if (src) { var op = (getComputedStyle(src).objectPosition || "").split(" ")[1]; if (op && op.indexOf("%") > 0) e.posY = parseFloat(op) / 100; }
    add(e);
    if (e.t0 == null) return e; // tempo fermo (prove): niente effetto
    scale = (scale || 1) * Math.min(2, window.devicePixelRatio || 1);
    var im = null;
    if (src && (src.currentSrc || src.src)) {
      // una copia dell'immagine tutta nostra: quella della carta viene rifatta a ogni ridisegno del tavolo
      im = new Image(); im.src = src.currentSrc || src.src;
      if (!(im.complete && im.naturalWidth)) { var late = im; late.onload = function () { bake(e, el, late, scale); }; im = null; }
    }
    bake(e, el, im, scale);
    return e;
  }
  // la carta vera è nascosta mentre le tessere lavorano, poi riappare sotto di loro con un ultimo bagliore
  function veil(el, secs, back) {
    if (!el.animate) return;
    var op = getComputedStyle(el).opacity, T = secs + .1, a = Math.max(.05, (secs - back) / T), b = (secs - back * .45) / T;
    el.animate([
      { opacity: 0, filter: "brightness(1.25)", offset: 0 }, { opacity: 0, filter: "brightness(1.25)", offset: a },
      { opacity: op, filter: "brightness(1.25)", offset: b }, { opacity: op, filter: "brightness(1.25)", offset: secs / T }, { opacity: op, filter: "brightness(1)", offset: 1 }
    ], { duration: T * 1000 });
    var marks = el.querySelectorAll(".p-power, .p-cost");
    for (var i = 0; i < marks.length; i++) marks[i].animate([{ transform: "scale(0)" }, { transform: "scale(1.35)", offset: .55 }, { transform: "scale(1)" }],
      { duration: 170, delay: (secs - back * .6) * 1000, fill: "backwards", easing: "cubic-bezier(.2,.8,.3,1)" });
  }
  // rivelazione: la carta si spacca in tessere, la riga di luce la percorre e la ricompone
  function reveal(c, i) {
    var el = pieceAt(c.uid);
    if (!el || frozen != null) return;
    el.classList.remove("fresh"); // niente giravolta: la misura deve essere quella vera
    var rc = el.getBoundingClientRect();
    if (!rc.width) return;
    var col = HOUSE[c.house] || GOLD, st = STYLE[c.house] || 0, d = i * .05;
    var tier = c.cost >= 5 ? 2 : c.cost >= 3 ? 1 : 0, big = tier === 2, dur = [.46, .5, .52][tier]; // leggera, media, grossa: coda compresa sta nei 620 ms tra una carta e la successiva
    var b = box(rc), W = Math.max(b.w, 56), base = rc.bottom - 2, lock = d + dur * .78;
    form({ mode: 0, style: st, to: b, col: col, amp: W * [.09, .12, .2][tier], big: big, start: c.side !== "rival", dur: dur, delay: d }, el, 1.3);
    veil(el, d + dur, dur * .2);
    // quando l'ultima tessera va a posto: qualche scintilla dal bordo (e un'onda a terra per le carte grosse)
    for (var s2 = 0; s2 < [5, 9, 22][tier]; s2++) { var an = rnd(Math.PI * 1.05, Math.PI * 1.95), sp = rnd(120, big ? 380 : 220); spark(b.x + rnd(-W * .5, W * .5), base, Math.cos(an) * sp * .7, Math.sin(an) * sp, col, rnd(.35, .7), { delay: lock, g: 420 }); }
    if (big) {
      sprite({ tex: "anello", x: b.x, y: base, w: W * 4.2, h: W * 4.2 * .38, s0: .2, s1: 1, fin: .03, fout: .7, dur: .7, tint: col, tintAmt: .4, a: .8, delay: lock });
      if (c.cost >= 6) sprite({ tex: "stella", x: b.x, y: b.y, w: W * 3.2, h: W * 3.2, s0: .3, s1: 1.1, rot: Math.random() * 3, spin: .6, fin: .03, fout: .85, dur: .4, tint: col, tintAmt: .35, a: .32, delay: lock });
      setTimeout(function () { react(app, "fx-quake"); }, lock * 1000);
    }
  }
  // l'impatto sul bersaglio
  function impact(p, r, curse, col, uid, from, power) {
    r = grow(r);
    var W = r.width;
    if (curse) {
      var el = pieceAt(uid), live = el && OK && frozen == null ? el.getBoundingClientRect() : null;
      if (live && live.width) {
        // la carta si incrina dal lato da cui arriva il colpo; più forte la maledizione, più si scuote
        var b = box(live);
        form({ mode: 2, to: b, from: { x: from ? from[0] : b.x, y: from ? from[1] : b.y - b.h, w: 1, h: 1 }, col: col, amp: Math.max(b.w, 56) * (.07 + .025 * Math.min(4, power || 1)), dur: .62, marks: true }, el, 1.3);
      } else react(el, "fx-hurt");
      for (var i = 0; i < 2; i++) sprite({ tex: "fumo", x: p[0] + rnd(-10, 10), y: p[1] + rnd(-10, 10), vx: rnd(-90, 90), vy: rnd(-90, -30), w: W * 1.3, h: W * 1.3, s0: .4, s1: 1.4, rot: Math.random() * 6, spin: rnd(-.8, .8), fin: .15, fout: .7, dur: rnd(1, 1.5), a: .18, dis: .6, delay: .1 + i * .08 });
      for (var j = 0; j < 2; j++) add({ kind: "smoke", x: p[0] + rnd(-12, 12), y: p[1] + rnd(-12, 12), vx: rnd(-40, 40), vy: rnd(10, 50), size: W * rnd(.9, 1.4), col: [.5, .2, .9], dur: rnd(1, 1.4), delay: .12 });
      for (var m = 0; m < 10; m++) { var a2 = Math.random() * 6.283, s3 = rnd(60, 180); spark(p[0], p[1], Math.cos(a2) * s3, Math.sin(a2) * s3, [.75, .45, 1], rnd(.4, .7), { g: -40, w: 1.6 }); }
    } else {
      sprite({ tex: "stella", x: p[0], y: p[1], w: W * 2.2, h: W * 2.2, s0: .2, s1: 1.1, rot: Math.random() * 3, spin: 1.2, fin: .03, fout: .75, dur: .65, tint: col, tintAmt: .25, a: .65 });
      sprite({ tex: "anello", x: p[0], y: p[1], w: W * 2.6, h: W * 2.6, s0: .15, s1: 1, fin: .03, fout: .7, dur: .55, tint: col, tintAmt: .3, a: .75 });
      for (var n = 0; n < 22; n++) { var an = Math.random() * 6.283, sp = rnd(160, 420); spark(p[0], p[1], Math.cos(an) * sp, Math.sin(an) * sp - 120, col, rnd(.4, .7), { g: 600 }); }
      react(pieceAt(uid), "fx-boost");
    }
  }
  // il numero esplode sulla carta e vola nel medaglione della forza
  function number(p, text, curse, lane, side) {
    var s = document.createElement("span");
    s.className = "fx-num " + (curse ? "down" : "up");
    s.textContent = text;
    numLayer.appendChild(s);
    var medal = board.querySelector('.lane[data-lane="' + lane + '"] .score.' + side);
    var mr = medal ? medal.getBoundingClientRect() : null;
    var to = mr ? center(mr) : [p[0], p[1] - 80];
    if (!s.animate) { setTimeout(function () { s.remove(); }, 1200); return; }
    var anim = s.animate([
      { transform: "translate(" + p[0] + "px," + p[1] + "px) translate(-50%,-50%) scale(.2)", opacity: 0 },
      { transform: "translate(" + p[0] + "px," + (p[1] - 18) + "px) translate(-50%,-50%) scale(1.5)", opacity: 1, offset: .14 },
      { transform: "translate(" + p[0] + "px," + (p[1] - 28) + "px) translate(-50%,-50%) scale(1)", opacity: 1, offset: .45 },
      { transform: "translate(" + to[0] + "px," + to[1] + "px) translate(-50%,-50%) scale(.45)", opacity: .9, offset: .92 },
      { transform: "translate(" + to[0] + "px," + to[1] + "px) translate(-50%,-50%) scale(.3)", opacity: 0 }
    ], { duration: 1150, easing: "cubic-bezier(.3,.7,.3,1)", fill: "forwards" });
    anim.onfinish = function () {
      s.remove();
      var m = board.querySelector('.lane[data-lane="' + lane + '"] .score.' + side);
      if (m) { react(m, "fx-take"); if (mr) add({ kind: "glow", x: to[0], y: to[1], size: 90, col: curse ? CURSE : GOLD, dur: .4 }); }
    };
  }

  // la carta brucia: serve la sua illustrazione come texture
  function burn(a) {
    var r = a.rect, p = center(r);
    sprite({ tex: "anello", x: p[0], y: p[1], w: r.width * 3, h: r.width * 3, s0: .2, s1: 1, fin: .03, fout: .7, dur: .6, tint: [1, .5, .2], tintAmt: .5, a: .8 });
    for (var i = 0; i < 26; i++) { var an = rnd(Math.PI * 1.1, Math.PI * 1.9), sp = rnd(60, 220); spark(p[0] + rnd(-r.width / 2, r.width / 2), p[1] + rnd(-r.height / 2, r.height / 2), Math.cos(an) * sp * .5, Math.sin(an) * sp, [1, .55, .2], rnd(.6, 1.2), { g: -60, delay: rnd(0, .6), w: 1.8 }); }
    for (var f = 0; f < 3; f++) sprite({ tex: "fiamma", x: p[0] + rnd(-r.width * .3, r.width * .3), y: p[1] + r.height * .1, vy: -50, w: r.width * 1.2, h: r.width * 1.7, s0: .4, s1: 1.2, pow: 2, fin: .15, fout: .6, dur: rnd(.8, 1.1), a: .45, dis: .5, delay: .1 + f * .14 });
    sprite({ tex: "stella", x: p[0], y: p[1], w: r.width * 1.8, h: r.width * 1.8, s0: .3, s1: 1, spin: .8, fin: .03, fout: .7, dur: .45, tint: [1, .5, .2], tintAmt: .5, a: .55 });
    var e = { kind: "burn", x: p[0], y: p[1], w: r.width, h: r.height, dur: 1.15, spin: rnd(-.15, .15), crop: [0, 0, 1, 1] };
    if (a.img && a.img.naturalWidth) {
      var iw = a.img.naturalWidth, ih = a.img.naturalHeight, s = Math.max(r.width / iw, r.height / ih), vw = r.width / s / iw, vh = r.height / s / ih;
      // nel quadrato v = 0 è in alto, come la riga 0 dell'immagine (texture non capovolta); taglio "cover" al 30% come nel CSS
      e.crop = [(1 - vw) / 2, (1 - vh) * .3, vw, vh];
      try {
        var t = gd.createTexture(); gd.bindTexture(gd.TEXTURE_2D, t);
        gd.pixelStorei(gd.UNPACK_FLIP_Y_WEBGL, false);
        gd.texImage2D(gd.TEXTURE_2D, 0, gd.RGBA, gd.RGBA, gd.UNSIGNED_BYTE, a.img);
        gd.texParameteri(gd.TEXTURE_2D, gd.TEXTURE_MIN_FILTER, gd.LINEAR); gd.texParameteri(gd.TEXTURE_2D, gd.TEXTURE_WRAP_S, gd.CLAMP_TO_EDGE); gd.texParameteri(gd.TEXTURE_2D, gd.TEXTURE_WRAP_T, gd.CLAMP_TO_EDGE);
        e.tex = t;
        setTimeout(function () { gd.deleteTexture(t); }, 1500);
      } catch (x) { /* immagine non utilizzabile */ }
    }
    add(e);
  }
  function comet(A, B, col) {
    var C = [(A[0] + B[0]) / 2 + (B[1] - A[1]) * .1, Math.min(A[1], B[1]) - Math.max(60, Math.abs(B[0] - A[0]) * .3)];
    add({ kind: "beam", a: A, b: B, c: C, col: col, curse: false, travel: .5, dur: 1, onHit: function () { add({ kind: "ring", x: B[0], y: B[1], size: 160, col: col, dur: .5 }); add({ kind: "glow", x: B[0], y: B[1], size: 120, col: col, dur: .4 }); } });
  }

  // La carta posata: in mano si scompone in tessere di luce, che volano in fila sulla rovina e lì si
  // ricompongono. Parte da dove stava in mano, o da dove l'hai lasciata se l'hai trascinata.
  var lastPick = {}, lastDrop = null;
  document.addEventListener("pointerdown", function (e) {
    var c = e.target.closest && e.target.closest("#hand [data-uid]");
    if (c) lastPick[c.getAttribute("data-uid")] = c.getBoundingClientRect();
  }, true);
  document.addEventListener("pointerup", function () {
    var g = document.querySelector(".drag-ghost");
    lastDrop = g ? { r: g.getBoundingClientRect(), t: performance.now() } : null;
  }, true);
  function place(el, from, info) {
    el.classList.remove("fresh");
    var to = el.getBoundingClientRect();
    if (!to.width || REDUCED) return;
    if (lastDrop && performance.now() - lastDrop.t < 400 && lastDrop.r.width) from = lastDrop.r;
    lastDrop = null;
    var col = HOUSE[info.house] || GOLD, B = center(to);
    var A = from && from.width ? center(from) : [B[0], window.innerHeight - 40];
    if (OK && frozen == null) {
      var fw = from && from.width ? Math.min(from.width, to.width * 2.6) : to.width * 1.4, dist = Math.hypot(A[0] - B[0], A[1] - B[1]);
      var st = STYLE[info.house] || 0, tier = info.cost >= 5 ? 2 : info.cost >= 3 ? 1 : 0, dur = [.46, .5, .54][tier];
      var W = Math.max(to.width, 56), base = to.bottom - 2;
      // la curva del volo: la Guardia va dritta, la Selva fa un giro largo, il Tesoro quasi un filo teso
      form({ mode: 1, style: st, to: box(to), from: { x: A[0], y: A[1], w: fw, h: fw * to.height / to.width }, col: col, edge: "rgb(" + Math.round(col[0] * 255) + "," + Math.round(col[1] * 255) + "," + Math.round(col[2] * 255) + ")",
        amp: Math.min(60, 16 + dist * .07), bend: (A[0] > B[0] ? -1 : 1) * Math.min(70, dist * .12) * [1, 0, 2.2, .6, .25, 1.3][st], dur: dur }, el, Math.min(2, fw / to.width));
      veil(el, dur, dur * .18);
      sprite({ tex: "anello", x: B[0], y: base, w: W * [1.8, 2.2, 3][tier], h: W * [1.8, 2.2, 3][tier] * .38, s0: .2, s1: 1, fin: .03, fout: .7, dur: .42, tint: col, tintAmt: .5, a: [.4, .55, .75][tier], delay: dur * .8 });
      for (var i = 0; i < [5, 8, 16][tier]; i++) { var an = rnd(Math.PI * 1.1, Math.PI * 1.9), sp = rnd(70, tier === 2 ? 260 : 180); spark(B[0] + rnd(-W * .4, W * .4), base, Math.cos(an) * sp, Math.sin(an) * sp * .4, mix(col, [1, .9, .7]), rnd(.25, .45), { g: 300, w: 1.6, delay: dur * .8 }); }
      return;
    }
    // senza scheda grafica: la carta vola intera dalla mano alla rovina
    var sc = from && from.width ? Math.min(2.4, from.width / to.width) : 1.4;
    var dx = A[0] - B[0], dy = A[1] - B[1];
    var lift = Math.max(24, Math.abs(dy) * .14);
    app.classList.add("fx-flying"); el.classList.add("fx-fly");
    place.n = (place.n || 0) + 1;
    var landed = function () { el.classList.remove("fx-fly"); if (--place.n <= 0) { place.n = 0; app.classList.remove("fx-flying"); } };
    if (!el.animate) { landed(); return; }
    var fly = el.animate([
      { transform: "translate(" + dx + "px," + dy + "px) scale(" + sc + ") rotate(" + (dx > 0 ? 8 : -8) + "deg)", filter: "brightness(1.4) blur(.5px)", opacity: .95, offset: 0 },
      { transform: "translate(" + dx * .45 + "px," + (dy * .45 - lift) + "px) scale(" + (1 + (sc - 1) * .5) + ") rotate(" + (dx > 0 ? -4 : 4) + "deg)", filter: "brightness(1.9) blur(1.5px)", opacity: .85, offset: .45 },
      { transform: "translate(0,0) scale(1.12)", filter: "brightness(2.6) blur(0)", opacity: 1, offset: .82 },
      { transform: "none", filter: "none", opacity: 1, offset: 1 }
    ], { duration: 460, easing: "cubic-bezier(.35,.1,.25,1)" });
    fly.onfinish = fly.oncancel = landed;
  }
  function mix(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }

  /* ───────── cosa è successo ───────── */
  var prev = null, prevMatch = null;
  function snapshot() {
    var m = G.match && G.match();
    if (!m) return null;
    var view = E.view(m);
    var snap = { map: {}, hand: {}, inc: {}, handRect: {} };
    view.lanes.forEach(function (lane, li) {
      lane.incoming.forEach(function (c) { if (c.uid) snap.inc[c.uid] = { lane: li, house: c.house, cost: c.cost }; });
      [["you", lane.yours], ["rival", lane.rivals]].forEach(function (pair) {
        pair[1].forEach(function (c) {
          if (!c.uid) return;
          var el = pieceAt(c.uid);
          var img = el ? el.querySelector("img") : null;
          snap.map[c.uid] = { uid: c.uid, lane: li, side: pair[0], power: c.current, shown: !c.hidden && c.revealed !== false, house: c.house, cost: c.cost,
            rect: el ? el.getBoundingClientRect() : null, img: img && img.complete ? img : null };
        });
      });
    });
    (view.hand || []).forEach(function (c) { snap.hand[c.uid] = true; });
    // dove stanno le carte in mano: serve per farle volare sulla rovina quando le posi
    var hs = document.querySelectorAll('#hand [data-uid]');
    for (var i = 0; i < hs.length; i++) { var r = hs[i].getBoundingClientRect(); if (r.width) snap.handRect[hs[i].getAttribute("data-uid")] = r; }
    return snap;
  }
  function plaqueCenter(li) { var p = board.querySelectorAll(".plaque")[li]; return p ? center(p.getBoundingClientRect()) : null; }

  function onRender() {
    var m = G.match && G.match();
    var cur = snapshot();
    if (!cur || m !== prevMatch || !prev || !OK) { prev = cur; prevMatch = m; return; }
    var revealed = [], deltas = [];
    Object.keys(cur.map).forEach(function (uid) {
      var a = prev.map[uid], b = cur.map[uid];
      if (!b.rect) return;
      if (b.shown && (!a || !a.shown)) revealed.push(b);
      else if (a && a.shown && b.shown && a.power !== b.power) deltas.push({ card: b, d: b.power - a.power });
      if (a && a.shown && b.shown && a.lane !== b.lane && a.rect) comet(center(a.rect), center(b.rect), HOUSE[b.house] || GOLD);
    });
    Object.keys(prev.map).forEach(function (uid) {
      var a = prev.map[uid];
      if (cur.map[uid] || !a.shown || !a.rect) return;
      if (cur.hand[uid]) comet(center(a.rect), [window.innerWidth / 2, window.innerHeight - 70], [.6, .85, 1]);
      else burn(a);
    });
    Object.keys(cur.inc).forEach(function (uid) {
      if (prev.inc[uid]) return;
      var el = pieceAt(uid), from = prev.handRect[uid] || lastPick[uid];
      if (el) place(el, from, cur.inc[uid]);
    });
    revealed.forEach(reveal);
    deltas.forEach(function (dl, i) {
      var curse = dl.d < 0, T = center(dl.card.rect), r = dl.card.rect;
      var src = revealed.filter(function (x) { return x.uid !== dl.card.uid; });
      var S = null, col = curse ? CURSE : GOLD;
      if (src.length) {
        src.sort(function (x, y) { return (x.lane === dl.card.lane ? 0 : 1) - (y.lane === dl.card.lane ? 0 : 1); });
        S = center(src[0].rect);
        if (curse && HOUSE[src[0].house]) { var hc = HOUSE[src[0].house]; col = [(hc[0] + CURSE[0] * 2) / 3, (hc[1] + CURSE[1] * 2) / 3, (hc[2] + CURSE[2] * 2) / 3]; } // un'ombra del colore di chi la lancia
        if (!curse && HOUSE[src[0].house]) { var h = HOUSE[src[0].house]; col = [(h[0] + GOLD[0]) / 2, (h[1] + GOLD[1]) / 2, (h[2] + GOLD[2]) / 2]; }
      } else S = plaqueCenter(dl.card.lane);
      var label = (dl.d > 0 ? "+" : "−") + Math.abs(dl.d);
      var hit = function () { impact(T, r, curse, col, dl.card.uid, S, Math.abs(dl.d)); number(T, label, curse, dl.card.lane, dl.card.side); };
      if (!S || Math.hypot(S[0] - T[0], S[1] - T[1]) < 14) { setTimeout(hit, i * 70); return; }
      var C = [(S[0] + T[0]) / 2 + (T[1] - S[1]) * .2, (S[1] + T[1]) / 2 - Math.max(50, Math.abs(T[0] - S[0]) * .28 + Math.abs(T[1] - S[1]) * .1)];
      add({ kind: "beam", a: S, b: T, c: C, col: col, curse: curse, travel: .38, dur: .9, delay: .12 + i * .08 });
      setTimeout(hit, (.12 + i * .08 + .38) * 1000); // il colpo a tempo, anche se i fotogrammi rallentano
    });
    prev = cur;
  }

  new MutationObserver(function () { try { onRender(); } catch (err) { console.warn("effetti:", err); prev = null; } }).observe(board, { childList: true });
  window.SigilEffetti = { ok: OK, add: add, reveal: reveal, impact: impact, burn: burn, number: number, live: function () { return fx.map(function (e) { return e.kind; }); },
    freeze: function (on) { frozen = on ? performance.now() / 1000 : null; kick(); } };
})();
