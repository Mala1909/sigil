"use strict";

/*
 * SIGIL — Il tavolo vivo (16 nov 2026).
 *
 * Le rovine sono tessere dipinte (come le location di Marvel Snap) e ognuna è una scena viva: un
 * programma WebGL suo lavora sul dipinto e sulla sua profondità (art/places/<id>.jpg e <id>-d.png).
 *   Forgia ........ l'aria trema sopra il fuoco, la luce del focolare pulsa, colpi sull'incudine con
 *                   ventagli di scintille
 *   Palude ........ nebbia che scorre a strati, acqua che increspa il riflesso della luna, fuochi fatui
 *   Fonte di luna . raggi di luna, riflessi che danzano nella vasca, stelle che brillano, lucciole d'argento
 *   Cimitero ...... nebbia bassa che striscia, lampi che illuminano il cielo, corvi in volo
 *   Cripta ........ candele che tremano e illuminano le volte, fascio di luce con la polvere dentro
 *   Piana del drago crepe di lava che pulsano, l'occhio del drago che si accende, calore e fumo, braci
 *   Nido .......... nuvole che corrono, piume nel vento, le uova che pulsano di una luce dorata
 *   Campo d'ossa .. lo stendardo che sventola, cenere che cade, nebbia, uno spirito che sale dalle ossa
 *   Mercato d'ombra lanterne vive, fumo viola, un'ombra che passa in fondo al vicolo, selciato bagnato
 *   Taverna ....... il camino che respira e illumina la stanza, fumo dal paiolo, la candela sul tavolo
 *   Campanile ..... la campana rintocca: oscilla, un'onda d'urto attraversa il quadro, gli uccelli girano
 *   Torrione ...... torce, stendardi al vento, pioggia, lampi lontani nella tempesta
 *   Strettoia ..... raffiche di polvere giù per la gola, sassi che cadono, foglie nel vento
 * In più per tutte: un filo di profondità (si muovono inclinando il telefono o col mouse), il "respiro"
 * del quadro e la luce di chi vince la rovina (oro dal basso per te, viola dall'alto per l'Ombra).
 *
 * game.js rifà le corsie a ogni mossa: qui il canvas di ogni tessera resta lo stesso (con il suo
 * WebGL già pronto) e viene rimesso nella tessera nuova, così gli effetti non ripartono mai.
 * A inizio partita le rovine si girano una dopo l'altra. Senza WebGL resta il dipinto fermo.
 */
(function () {
  var G = window.SigilGame;
  var board = document.getElementById("board");
  var app = document.getElementById("app");

  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var V = "?v=1";
  // Effetto per rovina (id in engine.js) e ogni quanto succede il suo "evento" (secondi, min-max).
  var MODES = { forno: 0, cantiere: 1, fontana: 2, orto: 3, vicolo: 4, piazza: 5, balcone: 6, mercato: 7, bar: 8, osteria: 9, semaforo: 10, terrazza: 11, panchina: 12 };
  var EVENT = { 0: [4, 7], 3: [6, 11], 7: [7, 12], 8: [8, 13], 10: [7, 10], 11: [5, 9] };

  /* ───────── shader ───────── */
  var VS = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }";
  var COMMON = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH", "precision highp float;", "#else", "precision mediump float;", "#endif",
    "uniform sampler2D u_img, u_dep; uniform vec2 u_res, u_cov, u_ctr, u_tilt; uniform float u_t, u_ev, u_lead, u_seed;",
    "const float ASP = 1.34;",
    "float h1(float n){ return fract(sin(n) * 43758.5453); }",
    "float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);",
    "  return mix(mix(h2(i), h2(i + vec2(1., 0.)), f.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1., 1.)), f.x), f.y); }",
    "float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * nz(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return s; }",
    // luce morbida attorno a un punto, in coordinate del dipinto (distanze giuste in orizzontale)
    "float glow(vec2 p, vec2 c, float r){ vec2 d = (p - c) * vec2(ASP, 1.); return exp(-dot(d, d) / (r * r)); }",
    "float box(vec2 p, vec4 b, float s){ return smoothstep(b.x - s, b.x + s, p.x) * smoothstep(b.z + s, b.z - s, p.x) * smoothstep(b.y - s, b.y + s, p.y) * smoothstep(b.w + s, b.w - s, p.y); }",
    // un uccello lontano: una V che batte le ali
    "float bird(vec2 p, vec2 c, float s, float flap){ vec2 q = (p - c) * vec2(ASP, 1.) / s; float ax = abs(q.x);",
    "  float y = ax * (.55 * flap) - ax * ax * .25; float d = abs(q.y + y); return smoothstep(.22, .06, d) * smoothstep(1.05, .85, ax); }",
    "float streak(vec2 p, vec2 c, vec2 dir, float len, float w){ vec2 q = (p - c) * vec2(ASP, 1.); float a = dot(q, dir);",
    "  vec2 pr = q - dir * clamp(a, -len, 0.); float dd = dot(pr, pr); return exp(-dd / (w * w)) * (1. - clamp(-a / len, 0., 1.) * .9); }",
    "vec3 tex(vec2 uv){ return texture2D(u_img, clamp(uv, .001, .999)).rgb; }",
    "void main(){",
    "  vec2 v = gl_FragCoord.xy / u_res; v.y = 1. - v.y;",
    "  float t = u_t, e = u_ev;",
    "  float br = .965 - .012 * sin(t * .09 + u_seed);",
    "  vec2 uv = u_ctr + (v - .5) * u_cov * br;",
    "  float d0 = texture2D(u_dep, uv).r;",
    "  uv += u_tilt * (d0 - .45) * .014;",
    "  vec2 o = vec2(0.);",
    "  vec3 add = vec3(0.);",
    "  float mulL = 1.;"
  ].join("\n");
  var TAIL = [
    "  vec3 c = tex(uv + o) * mulL + add;",
    // luce di chi vince la rovina
    "  float lead = u_lead;",
    "  c += vec3(.95, .72, .32) * max(lead, 0.) * smoothstep(.55, 1.05, v.y) * .16;",
    "  c += vec3(.55, .45, 1.) * max(-lead, 0.) * smoothstep(.45, -.05, v.y) * .16;",
    // grana e vignetta
    "  c += (h2(v * u_res + fract(t) * 91.) - .5) * .025;",
    "  c *= .78 + .22 * smoothstep(1.05, .35, length((v - .5) * vec2(1.15, 1.)));",
    "  gl_FragColor = vec4(c, 1.);",
    "}"
  ].join("\n");

  var BODY = [];
  // 0 · Forgia: aria che trema sopra il fuoco, luce che pulsa, scintille, colpi sull'incudine
  BODY[0] = [
    "  vec2 F = vec2(.57, .53);",
    "  float hz = box(uv, vec4(.38, .08, .78, .52), .08) * smoothstep(.56, .3, uv.y);",
    "  o += vec2(nz(uv * vec2(9., 5.) + vec2(0., -t * 1.6)) - .5, nz(uv * vec2(7., 9.) + vec2(3., -t * 1.2)) - .5) * .009 * hz;",
    "  float fl = .55 + .3 * nz(vec2(t * 2.3, 1.)) + .15 * sin(t * 13.);",
    "  float warm = glow(uv, F, .42);",
    "  mulL = 1. + warm * (fl - .55) * .9;",
    "  float flame = glow(uv, F + vec2(0., -.03), .09) * fbm(uv * vec2(18., 9.) + vec2(0., t * 2.8));",
    "  add += vec3(1., .55, .18) * flame * .55 * fl;",
    "  for (int i = 0; i < 26; i++) { float fi = float(i); float s = h1(fi * 13.7 + u_seed); float sp = .12 + .18 * h1(fi * 3.1);",
    "    float life = fract(t * sp + s); vec2 pp = F + vec2((h1(fi * 7.3) - .5) * .16 + sin(t * 1.7 + fi) * .02 * life, -.02 - life * .62);",
    "    vec2 dv = normalize(vec2(cos(t * 1.7 + fi) * .3 * life, -1.));",
    "    add += mix(vec3(1., .45, .1), vec3(1., .92, .7), h1(fi * 1.9)) * streak(uv, pp, dv, .018 + .02 * h1(fi * 5.5), .0022) * (1. - life) * 1.6; }",
    "  vec2 A = vec2(.41, .615);",
    "  float hit = exp(-e * 9.);",
    "  add += vec3(1., .85, .55) * glow(uv, A, .05 + e * .1) * hit * 1.2;",
    "  mulL += hit * glow(uv, A, .45) * .5;",
    "  for (int i = 0; i < 18; i++) { float fi = float(i); float an = 3.14159 * (1.05 + h1(fi * 4.7 + floor(u_seed * 9.)) * .9); float sp = .35 + .45 * h1(fi * 2.3);",
    "    vec2 pp = A + vec2(cos(an), sin(an)) * sp * e * vec2(.75, 1.) + vec2(0., e * e * .9);",
    "    vec2 vel = vec2(cos(an) * sp * .75 * ASP, sin(an) * sp + 1.8 * e);",
    "    add += vec3(1., .8, .45) * streak(uv, pp, normalize(vel), .03 + .03 * h1(fi), .0024) * smoothstep(.8, .05, e) * 2.2; }"
  ].join("\n");
  // 1 · Palude: nebbia a strati, acqua che increspa la luna, fuochi fatui
  BODY[1] = [
    "  float water = smoothstep(.5, .58, uv.y) * (1. - box(uv, vec4(.38, .52, .64, 1.1), .03));",
    "  o.x += sin(uv.y * 160. + t * 1.4 + nz(uv * 12. + t * .3) * 4.) * .0016 * water;",
    "  o.y += sin(uv.x * 90. - t * 1.1) * .0012 * water;",
    "  float moonRef = water * glow(vec2(uv.x * 2.8, uv.y), vec2(.48 * 2.8, .66), .45) * (.5 + .5 * nz(vec2(uv.x * 30., uv.y * 60. - t * 1.5)));",
    "  add += vec3(.75, .85, .8) * moonRef * .28;",
    "  float f1 = fbm(uv * vec2(3., 7.) + vec2(t * .025, 0.)), f2 = fbm(uv * vec2(5., 11.) + vec2(-t * .04, t * .01));",
    "  float band = smoothstep(.3, .5, uv.y) * smoothstep(.95, .55, uv.y);",
    "  float fog = clamp((f1 * .65 + f2 * .5 - .45) * 1.7, 0., 1.) * band;",
    "  vec3 fogC = vec3(.62, .72, .7);",
    "  add += fogC * fog * .32;",
    "  mulL = 1. - fog * .18;",
    "  for (int i = 0; i < 5; i++) { float fi = float(i); vec2 pp = vec2(.15 + .7 * h1(fi * 3.3 + u_seed) + .07 * sin(t * (.3 + .2 * h1(fi)) + fi * 2.), .5 + .14 * h1(fi * 9.1) + .03 * sin(t * .7 + fi * 4.));",
    "    float pul = .6 + .4 * sin(t * 2.3 + fi * 1.7);",
    "    add += vec3(.45, 1., .6) * (glow(uv, pp, .012) * 1.4 + glow(uv, pp, .05) * .25) * pul; }"
  ].join("\n");
  // 2 · Fonte di luna: raggi, vasca che brilla, stelle, lucciole d'argento
  BODY[2] = [
    "  vec2 M = vec2(.5, .17);",
    "  vec2 dm = (uv - M) * vec2(ASP, 1.); float ang = atan(dm.y, dm.x); float rr = length(dm);",
    "  float rays = pow(nz(vec2(ang * 7., t * .15)), 3.) * smoothstep(.9, .05, rr) * smoothstep(.0, .1, rr);",
    "  add += vec3(.75, .82, 1.) * (rays * .22 + glow(uv, M, .12) * (.18 + .06 * sin(t * .8)));",
    "  float basin = glow(vec2(uv.x, uv.y * 3.6), vec2(.48, .66 * 3.6), .2);",
    "  basin = smoothstep(.25, .6, basin);",
    "  o += vec2(sin(uv.y * 220. + t * 2.) , cos(uv.x * 180. - t * 1.6)) * .0012 * basin;",
    "  float caus = pow(abs(sin(nz(uv * vec2(40., 120.) + t * .6) * 6.28)), 6.);",
    "  add += vec3(.8, .9, 1.) * basin * (caus * .2 + glow(uv, vec2(.5 + .02 * sin(t * .5), .655), .03) * .35);",
    "  float sky = smoothstep(.42, .2, uv.y);",
    "  vec2 g = floor(uv * vec2(90., 60.)); float st = step(.985, h2(g)); float tw = pow(.5 + .5 * sin(t * (1.5 + 3. * h2(g + 3.)) + h2(g) * 40.), 4.);",
    "  add += vec3(.9, .95, 1.) * st * tw * sky * glow(fract(uv * vec2(90., 60.)), vec2(.5), .25) * .9;",
    "  for (int i = 0; i < 10; i++) { float fi = float(i); float life = fract(t * (.05 + .05 * h1(fi * 2.7)) + h1(fi * 8.3 + u_seed));",
    "    vec2 pp = vec2(.15 + .7 * h1(fi * 5.1) + .03 * sin(t + fi), .85 - life * .6);",
    "    add += vec3(.85, .92, 1.) * glow(uv, pp, .006) * sin(life * 3.14159) * (.6 + .4 * sin(t * 4. + fi)); }"
  ].join("\n");
  // 3 · Cimitero: nebbia che striscia, lampi, corvi in volo
  BODY[3] = [
    "  float f1 = fbm(uv * vec2(2.5, 8.) + vec2(t * .03, 0.)), f2 = fbm(uv * vec2(6., 14.) + vec2(-t * .05, 0.));",
    "  float band = smoothstep(.45, .62, uv.y) * smoothstep(1., .8, uv.y);",
    "  float fog = clamp((f1 * .7 + f2 * .45 - .42) * 1.8, 0., 1.) * band;",
    "  add += vec3(.68, .7, .76) * fog * .38;",
    "  float sky = smoothstep(.5, .25, uv.y);",
    "  float fl = exp(-e * 10.) + .7 * exp(-pow((e - .22) * 18., 2.)) + .35 * exp(-pow((e - .4) * 22., 2.));",
    "  mulL = 1. + fl * (.25 + sky * .9);",
    "  float bx = .12 + .5 * h1(floor(u_seed * 13.) + floor((t - e) * .37));",
    "  float path = bx + (fbm(vec2(uv.y * 9., bx * 20.)) - .5) * .12 + (nz(vec2(uv.y * 40., bx * 7.)) - .5) * .025;",
    "  float bolt = exp(-pow((uv.x - path) * ASP / .0035, 2.)) * smoothstep(.36, .3, uv.y) * smoothstep(-.02, .02, uv.y);",
    "  float bh = exp(-pow((uv.x - path) * ASP / .025, 2.)) * smoothstep(.36, .3, uv.y);",
    "  add += vec3(.85, .88, 1.) * (bolt * 1.6 + bh * .25) * (exp(-e * 14.) + .8 * exp(-pow((e - .22) * 18., 2.)));",
    "  add += vec3(.55, .6, .85) * fl * sky * .3;",
    "  for (int i = 0; i < 3; i++) { float fi = float(i); float life = fract(t * (.035 + .015 * fi) + h1(fi * 4.4 + u_seed));",
    "    vec2 pp = vec2(-.1 + life * 1.2, .12 + .12 * h1(fi * 6.1) + .02 * sin(t * .9 + fi));",
    "    mulL *= 1. - .75 * bird(uv, pp, .022 - .004 * fi, sin(t * 9. + fi * 2.)); }"
  ].join("\n");
  // 4 · Cripta: candele vive, fascio di luce con la polvere
  BODY[4] = [
    "  vec2 C[10]; C[0] = vec2(.05, .58); C[1] = vec2(.09, .63); C[2] = vec2(.17, .71); C[3] = vec2(.24, .78); C[4] = vec2(.37, .52);",
    "  C[5] = vec2(.53, .74); C[6] = vec2(.82, .77); C[7] = vec2(.95, .6); C[8] = vec2(.92, .68); C[9] = vec2(.28, .7);",
    "  float L = 0.;",
    "  for (int i = 0; i < 10; i++) { float fi = float(i); float fl = .7 + .3 * nz(vec2(t * 3.1 + fi * 7., fi));",
    "    L += glow(uv, C[i], .16) * fl; add += vec3(1., .75, .4) * glow(uv, C[i] + vec2(0., -.012), .012) * fl * .9; }",
    "  mulL = .82 + L * .32;",
    "  vec2 S = vec2(.6, .26), Dr = normalize(vec2(-.42, .78));",
    "  vec2 q = uv - S; float along = dot(q, Dr); vec2 perp = q - Dr * along;",
    "  float w = .035 + along * .16; float beam = smoothstep(w, w * .2, length(perp * vec2(ASP, 1.))) * smoothstep(0., .05, along) * smoothstep(.7, .3, along);",
    "  float dust = fbm(uv * 14. + vec2(t * .15, -t * .1));",
    "  add += vec3(.7, .78, .85) * beam * (.12 + .18 * dust);",
    "  vec2 g = floor(uv * vec2(70., 50.) + vec2(0., -t * .6)); float mote = step(.97, h2(g)) * glow(fract(uv * vec2(70., 50.) + vec2(0., -t * .6)), vec2(.5), .2);",
    "  add += vec3(1., .95, .85) * mote * beam * .9;"
  ].join("\n");
  // 5 · Piana del drago: lava che pulsa, l'occhio del drago, calore, fumo, braci
  BODY[5] = [
    "  float hz = smoothstep(.42, .6, uv.y);",
    "  o += vec2(nz(uv * vec2(10., 6.) + vec2(0., -t * 1.3)) - .5, nz(uv * vec2(8., 10.) + vec2(5., -t)) - .5) * .006 * hz;",
    "  vec3 base = tex(uv + o);",
    "  float lava = smoothstep(.12, .3, base.r - base.g * 1.1) * smoothstep(.55, .65, uv.y);",
    "  float pul = .55 + .45 * sin(t * 1.6 + uv.x * 9. + nz(uv * 8. + t * .3) * 5.);",
    "  float halo = 0.; for (int i = 0; i < 6; i++) { float a = float(i) * 1.047; vec2 dd = vec2(cos(a), sin(a)) * .012; vec3 s = tex(uv + o + dd); halo += smoothstep(.12, .3, s.r - s.g * 1.1); }",
    "  halo = halo / 6. * smoothstep(.55, .65, uv.y);",
    "  add += vec3(1., .38, .08) * (lava * pul * .55 + halo * pul * .35);",
    "  vec2 EY = vec2(.652, .641);",
    "  float eye = .35 + .65 * pow(.5 + .5 * sin(t * .55), 3.);",
    "  add += vec3(1., .32, .06) * (glow(uv, EY, .007) * 2.6 + glow(uv, EY, .028) * .55 + glow(uv, EY, .08) * .12) * eye;",
    "  float sm = fbm(uv * vec2(4., 3.) + vec2(t * .03, t * .08)); add += vec3(.45, .4, .38) * smoothstep(.55, .85, sm) * smoothstep(.85, .45, uv.y) * .25;",
    "  for (int i = 0; i < 16; i++) { float fi = float(i); float life = fract(t * (.09 + .08 * h1(fi * 2.9)) + h1(fi * 11.3 + u_seed));",
    "    vec2 pp = vec2(h1(fi * 4.1) + .05 * sin(t + fi), .95 - life * .7);",
    "    add += vec3(1., .55, .2) * streak(uv, pp, normalize(vec2(sin(t * .8 + fi) * .25, -1.)), .016, .002) * sin(life * 3.14) * 1.6; }"
  ].join("\n");
  // 6 · Nido: nuvole che corrono, piume, uova che pulsano, uccelli lontani
  BODY[6] = [
    "  float sky = smoothstep(.45, .2, uv.y);",
    "  float cl = fbm(uv * vec2(3., 6.) + vec2(-t * .06, 0.)); add += vec3(.85, .85, .82) * smoothstep(.45, .8, cl) * sky * .18; mulL = 1. - smoothstep(.5, .9, cl) * sky * .15;",
    "  float nest = box(uv, vec4(.42, .3, .88, .62), .05);",
    "  o.x += sin(t * 1.3 + uv.y * 20.) * .0018 * nest * smoothstep(.55, .3, uv.y);",
    "  float egg = .5 + .5 * sin(t * .8);",
    "  add += vec3(1., .82, .45) * (glow(uv, vec2(.6, .47), .05) + glow(uv, vec2(.665, .455), .05)) * egg * .22;",
    "  for (int i = 0; i < 6; i++) { float fi = float(i); float life = fract(t * (.06 + .03 * h1(fi * 3.3)) + h1(fi * 7.7 + u_seed));",
    "    vec2 pp = vec2(1.1 - life * 1.3, .2 + .6 * h1(fi * 5.9) + .06 * sin(t * 1.5 + fi * 3.));",
    "    vec2 q = (uv - pp) * vec2(ASP, 1.); float a = sin(t * 2. + fi) * .8; q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;",
    "    add += vec3(.92, .9, .85) * smoothstep(1., .5, length(q / vec2(.022, .006))) * .55; }",
    "  for (int i = 0; i < 2; i++) { float fi = float(i); vec2 pp = vec2(.2 + .25 * fi + .08 * sin(t * .15 + fi * 3.), .18 + .05 * fi + .02 * sin(t * .3 + fi));",
    "    mulL *= 1. - .6 * bird(uv, pp, .016, .4 + .3 * sin(t * 2. + fi)); }"
  ].join("\n");
  // 7 · Campo d'ossa: stendardo al vento, cenere, nebbia, uno spirito che sale
  BODY[7] = [
    "  float ban = box(uv, vec4(.47, .17, .74, .4), .02);",
    "  float k = clamp((uv.x - .47) * 3.5, 0., 1.);",
    "  o.y += sin((uv.x - .47) * 26. - t * 5.) * .008 * k * ban; o.x += sin((uv.y) * 30. - t * 4.) * .003 * k * ban;",
    "  mulL = 1. + sin((uv.x - .47) * 26. - t * 5. + 1.2) * .12 * k * ban;",
    "  float f1 = fbm(uv * vec2(3., 8.) + vec2(t * .03, 0.)); float fog = clamp((f1 - .42) * 1.8, 0., 1.) * smoothstep(.45, .6, uv.y) * smoothstep(.95, .7, uv.y);",
    "  add += vec3(.7, .72, .74) * fog * .3;",
    "  for (int i = 0; i < 28; i++) { float fi = float(i); float life = fract(t * (.05 + .05 * h1(fi * 3.7)) + h1(fi * 9.3 + u_seed));",
    "    vec2 pp = vec2(fract(h1(fi * 6.1) + life * .25 + .03 * sin(t + fi)), -.05 + life * 1.1);",
    "    add += vec3(.78, .76, .74) * glow(uv, pp, .0035 + .002 * h1(fi)) * .55; }",
    "  float sp = smoothstep(0., .6, e) * smoothstep(5., 3., e);",
    "  vec2 SP = vec2(.372, .75 - e * .07);",
    "  vec2 gq = uv - SP; gq.x += (nz(vec2(gq.y * 14. - e * 3., t)) - .5) * .05 * clamp(gq.y * 6. + .4, 0., 1.);",
    "  float trail = exp(-pow(gq.x * ASP / (.018 + max(gq.y, 0.) * .08), 2.)) * smoothstep(.26, .0, gq.y) * smoothstep(-.04, .02, gq.y);",
    "  float head = glow(uv, SP + vec2(0., -.018), .024) + glow(uv, SP + vec2(0., -.018), .07) * .3;",
    "  float wisp = (trail * (.45 + .4 * nz(vec2(gq.y * 30. - t * 2., gq.x * 40.))) + head);",
    "  add += vec3(.62, .86, .95) * wisp * sp * .85;",
    "  mulL *= 1. - .08 * glow(uv, SP, .25) * sp;"
  ].join("\n");
  // 8 · Mercato d'ombra: lanterne, fumo viola, un'ombra che passa, selciato bagnato
  BODY[8] = [
    "  vec2 Lp[6]; Lp[0] = vec2(.26, .29); Lp[1] = vec2(.71, .17); Lp[2] = vec2(.73, .47); Lp[3] = vec2(.53, .47); Lp[4] = vec2(.67, .5); Lp[5] = vec2(.38, .4);",
    "  float Lt = 0.;",
    "  for (int i = 0; i < 6; i++) { float fi = float(i); float fl = .72 + .28 * nz(vec2(t * 2.6 + fi * 5., fi * 2.));",
    "    Lt += glow(uv, Lp[i], .14) * fl; add += vec3(1., .62, .25) * glow(uv, Lp[i], .018) * fl * .7; }",
    "  mulL = .88 + Lt * .2;",
    "  vec2 sq = uv - vec2(.22, .62); float col = smoothstep(.06, 0., abs(sq.x - sin(sq.y * 9. + t * .9) * .03 + sq.y * .05)) * smoothstep(.04, -.4, sq.y);",
    "  float sm = fbm(uv * vec2(6., 4.) + vec2(sin(t * .2), -t * .12));",
    "  add += vec3(.55, .3, .75) * col * smoothstep(.35, .75, sm) * .5;",
    "  float vis = smoothstep(0., .5, e) * smoothstep(4.5, 3.6, e);",
    "  vec2 Sh = vec2(mix(.33, .5, clamp(e / 4.5, 0., 1.)), .585);",
    "  vec2 sd = (uv - Sh) * vec2(ASP, 1.);",
    "  float sway = sin(e * 9.) * .004;",
    "  float cloak = smoothstep(1., .75, length((sd - vec2(sway, 0.)) / vec2(.022 + max(sd.y, 0.) * .25, .06)));",
    "  float hood = smoothstep(1., .65, length((sd - vec2(sway * 1.5, -.06)) / vec2(.014, .017)));",
    "  float fig = clamp(cloak + hood, 0., 1.);",
    "  mulL *= 1. - fig * vis * .78;",
    "  add += vec3(1., .6, .25) * fig * vis * .02;",
    "  float wet = smoothstep(.72, .85, uv.y);",
    "  add += vec3(1., .7, .4) * wet * pow(nz(uv * vec2(60., 20.) + vec2(0., t * .4)), 8.) * (Lt * .9 + .2);"
  ].join("\n");
  // 9 · Taverna: camino che respira, fumo dal paiolo, candela, polvere
  BODY[9] = [
    "  vec2 F = vec2(.55, .63);",
    "  float fl = .6 + .25 * nz(vec2(t * 2.1, 3.)) + .15 * sin(t * 11.);",
    "  mulL = .85 + glow(uv, F, .6) * fl * .45;",
    "  add += vec3(1., .5, .15) * glow(uv, F + vec2(0., .01), .07) * fbm(uv * vec2(16., 8.) + vec2(0., t * 2.5)) * fl * .7;",
    "  float cfl = .7 + .3 * nz(vec2(t * 4., 9.));",
    "  add += vec3(1., .78, .45) * (glow(uv, vec2(.533, .692), .01) * 1.2 + glow(uv, vec2(.533, .7), .07) * .2) * cfl;",
    "  vec2 sq = uv - vec2(.55, .5); float colm = smoothstep(.07, 0., abs(sq.x - sin(sq.y * 12. - t * .8) * .025)) * smoothstep(.02, -.38, sq.y);",
    "  add += vec3(.55, .52, .5) * colm * smoothstep(.4, .8, fbm(uv * vec2(7., 5.) + vec2(0., t * .2))) * .45;",
    "  vec2 g = floor(uv * vec2(60., 40.) + vec2(t * .2, -t * .3)); add += vec3(1., .85, .6) * step(.975, h2(g)) * glow(fract(uv * vec2(60., 40.) + vec2(t * .2, -t * .3)), vec2(.5), .2) * glow(uv, F, .5) * .6;"
  ].join("\n");
  // 10 · Campanile: la campana rintocca, onda d'urto, uccelli che girano
  BODY[10] = [
    "  vec2 P = vec2(.5, .315);",
    "  float sw = .16 * sin(e * 5.5) * exp(-e * .7);",
    "  float bellm = box(uv, vec4(.43, .3, .57, .5), .015);",
    "  vec2 q = uv - P; q.x *= ASP; q = mat2(cos(sw), -sin(sw), sin(sw), cos(sw)) * q; q.x /= ASP;",
    "  o += (P + q - uv) * bellm;",
    "  vec2 B = vec2(.5, .41); float rr = length((uv - B) * vec2(ASP, 1.)); float R = e * .55;",
    "  float ring = exp(-pow((rr - R) / .025, 2.)) * exp(-e * 1.1);",
    "  o += normalize((uv - B) + 1e-4) * ring * .012;",
    "  add += vec3(1., .85, .55) * (ring * .45 + glow(uv, B, .08) * exp(-e * 2.) * .6);",
    "  mulL += ring * .25;",
    "  float cl = fbm(uv * vec2(3., 5.) + vec2(t * .03, 0.)); add += vec3(.95, .8, .65) * smoothstep(.5, .85, cl) * smoothstep(.7, .3, uv.y) * .12;",
    "  float scare = 1. + 2.5 * exp(-e * .8);",
    "  for (int i = 0; i < 9; i++) { float fi = float(i); float a = t * (.25 + .12 * h1(fi)) * (h1(fi * 3.) > .5 ? 1. : -1.) * scare * .5 + fi * .7;",
    "    vec2 pp = vec2(.5 + cos(a) * (.18 + .12 * h1(fi * 5.)), .32 + sin(a) * (.08 + .06 * h1(fi * 7.)) - .03 * exp(-e * .8));",
    "    mulL *= 1. - .7 * bird(uv, pp, .014 + .006 * h1(fi * 2.), sin(t * (8. + 4. * h1(fi)) * (1. + exp(-e)) + fi)); }"
  ].join("\n");
  // 11 · Torrione: torce, stendardi al vento, pioggia, lampi lontani
  BODY[11] = [
    "  vec2 T1 = vec2(.385, .645), T2 = vec2(.6, .645);",
    "  float f1 = .7 + .3 * nz(vec2(t * 3., 1.)), f2 = .7 + .3 * nz(vec2(t * 3.2, 7.));",
    "  mulL = .9 + (glow(uv, T1, .2) * f1 + glow(uv, T2, .2) * f2) * .35;",
    "  add += vec3(1., .55, .2) * (glow(uv, T1, .02) * f1 + glow(uv, T2, .02) * f2) * .9;",
    "  float flg = box(uv, vec4(.36, .0, .48, .1), .02) + box(uv, vec4(.62, .02, .74, .12), .02);",
    "  o.y += sin(uv.x * 60. - t * 7.) * .004 * flg; o.x += sin(uv.y * 50. - t * 6.) * .002 * flg;",
    "  float sky = smoothstep(.45, .2, uv.y);",
    "  float fl = exp(-e * 7.) * .8 + .4 * exp(-pow((e - .25) * 16., 2.));",
    "  vec2 Lx = vec2(.15 + .7 * h1(floor(u_seed * 7.) + floor(t / 9.)), .15);",
    "  add += vec3(.75, .7, .9) * fl * sky * (.25 + glow(uv, Lx, .3) * .6);",
    "  vec2 rp = vec2(uv.x * 240. + uv.y * 40., uv.y * 7. - t * 9.); vec2 rid = floor(rp);",
    "  float rain = step(.9, h2(rid)) * smoothstep(.16, .0, abs(fract(rp.x) - .5)) * smoothstep(0., .25, fract(rp.y)) * smoothstep(1., .55, fract(rp.y));",
    "  add += vec3(.75, .78, .88) * rain * .16;"
  ].join("\n");
  // 12 · Strettoia: raffiche di polvere, sassi che cadono, foglie nel vento
  BODY[12] = [
    "  float gust = .5 + .5 * sin(t * .7) * sin(t * .23 + 1.);",
    "  float lane = smoothstep(.22, .0, abs(uv.x - .5 - (uv.y - .6) * .25)) * smoothstep(.35, .55, uv.y);",
    "  float st = fbm(vec2(uv.x * 6., uv.y * 2.2 - t * (.6 + gust)) );",
    "  add += vec3(.85, .7, .5) * smoothstep(.5, .8, st) * lane * (.15 + .25 * gust);",
    "  o.x += (nz(uv * 6. + vec2(t * .5, 0.)) - .5) * .004 * lane * gust;",
    "  add += vec3(1., .9, .7) * glow(uv, vec2(.5, .05), .2) * (.1 + .05 * sin(t * .5));",
    "  for (int i = 0; i < 6; i++) { float fi = float(i); float life = fract(t * (.12 + .1 * h1(fi * 3.)) + h1(fi * 8.8 + u_seed));",
    "    vec2 pp = vec2((h1(fi * 2.2) > .5 ? .3 : .7) + (h1(fi * 4.4) - .5) * .1, .2 + life * life * .8);",
    "    mulL *= 1. - .7 * glow(uv, pp, .006); }",
    "  for (int i = 0; i < 7; i++) { float fi = float(i); float life = fract(t * (.08 + .05 * h1(fi * 5.)) + h1(fi * 6.6 + u_seed));",
    "    vec2 pp = vec2(.35 + .3 * h1(fi * 7.) + .05 * sin(t * 2. + fi), .95 - life * .8);",
    "    vec2 q = (uv - pp) * vec2(ASP, 1.); float a = t * 3. + fi; q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;",
    "    add += vec3(.75, .5, .25) * smoothstep(1., .5, length(q / vec2(.012, .006))) * .5 * gust; }"
  ].join("\n");

  // Per le prove (e per altri effetti): i sorgenti degli shader.
  window.SigilTavoloSrc = { VS: VS, src: function (m) { return [COMMON, BODY[m], TAIL].join("\n"); }, MODES: MODES };
  if (!G || !board || !app) return;

  /* ───────── WebGL per tessera ───────── */
  function makeGL(canvas) {
    var gl = null;
    try { gl = canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false }); } catch (e) { gl = null; }
    if (!gl) return null;
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    return { gl: gl, progs: {}, tex: null };
  }
  function program(ctx, mode) {
    if (ctx.progs[mode]) return ctx.progs[mode];
    var gl = ctx.gl;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn("tavolo: shader " + mode, gl.getShaderInfoLog(s)); return null; } return s; }
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, COMMON + "\n" + BODY[mode] + "\n" + TAIL);
    if (!vs || !fs) return (ctx.progs[mode] = null);
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return (ctx.progs[mode] = null);
    var u = {};
    ["u_img", "u_dep", "u_res", "u_cov", "u_ctr", "u_tilt", "u_t", "u_ev", "u_lead", "u_seed"].forEach(function (n) { u[n] = gl.getUniformLocation(pr, n); });
    return (ctx.progs[mode] = { pr: pr, u: u, loc: gl.getAttribLocation(pr, "p") });
  }
  function texture(gl, img, unit) {
    var tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tx;
  }

  // Una "scena" per corsia: il canvas resta lo stesso tra un ridisegno e l'altro.
  var scenes = [];
  function sceneFor(i, id) {
    var s = scenes[i];
    if (!s) {
      var c = document.createElement("canvas");
      c.className = "place-fx";
      c.setAttribute("aria-hidden", "true");
      s = scenes[i] = { canvas: c, ctx: REDUCED ? null : makeGL(c), id: null, ready: false, seed: Math.random() * 10, evAt: 0, evNext: 0 };
    }
    if (s.id !== id) {
      s.id = id; s.ready = false; s.mode = MODES[id];
      if (s.ctx && s.mode != null) {
        var img = new Image(), dep = new Image(), left = 2;
        var done = function () {
          if (--left || s.id !== id) return;
          var gl = s.ctx.gl;
          s.texI = texture(gl, img, 0); s.texD = texture(gl, dep, 1);
          s.aspect = img.naturalWidth / img.naturalHeight;
          s.ready = !!program(s.ctx, s.mode);
        };
        img.onload = done; dep.onload = done;
        img.src = "art/places/" + id + ".jpg" + V; dep.src = "art/places/" + id + "-d.png" + V;
      }
      // il primo evento arriva poco dopo l'apertura della partita
      s.evAt = performance.now() / 1000 + .8 + Math.random() * 2.5; s.evNext = 99;
    }
    return s;
  }

  // Inclinazione: mouse sul tavolo o telefono inclinato, morbida.
  var tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    tilt.tx = (e.clientX / window.innerWidth - .5) * 2; tilt.ty = (e.clientY / window.innerHeight - .5) * 2;
  }, { passive: true });
  window.addEventListener("deviceorientation", function (e) {
    if (e.gamma == null) return;
    tilt.tx = Math.max(-1, Math.min(1, e.gamma / 25)); tilt.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
  }, { passive: true });

  /* ───────── dopo ogni ridisegno del tavolo ───────── */
  var t0 = performance.now();
  var dealt = null, dealAt = 0;
  function dress() {
    var plaques = board.querySelectorAll(".plaque");
    var now = performance.now();
    var m = G.match && G.match();
    if (m && m !== dealt) { dealt = m; dealAt = now; }
    var since = (now - dealAt) / 1000;
    var dealing = since < 2.4;
    board.classList.toggle("deal", dealing);
    for (var i = 0; i < plaques.length; i++) {
      var pl = plaques[i];
      var art = pl.querySelector(".place-art");
      var id = art ? art.getAttribute("data-art") : "";
      if (art) art.style.animationDelay = (-((now - t0) / 1000 + i * 7) % 52).toFixed(2) + "s";
      pl.style.animationDelay = dealing ? (i * .2 - since).toFixed(2) + "s" : "";
      var s = sceneFor(i, id);
      if (s.canvas.parentNode !== pl) pl.insertBefore(s.canvas, pl.querySelector(".plaque-text"));
      pl.classList.toggle("gl-on", !!s.ready);
    }
  }
  new MutationObserver(dress).observe(board, { childList: true });
  setInterval(function () { if (board.classList.contains("deal") && (performance.now() - dealAt) / 1000 >= 2.4) dress(); }, 400);

  /* ───────── disegno ───────── */
  var lastDraw = 0;
  function frame(nowMs) {
    requestAnimationFrame(frame);
    if (document.hidden || !app.classList.contains("playing")) return;
    // 30 fotogrammi al secondo bastano per nebbia, luci e scintille, e il telefono respira
    if (nowMs - lastDraw < 30) return;
    lastDraw = nowMs;
    var now = nowMs / 1000;
    tilt.x += (tilt.tx - tilt.x) * .06; tilt.y += (tilt.ty - tilt.y) * .06;
    var dpr = Math.min(1.5, window.devicePixelRatio || 1);
    var plaques = board.querySelectorAll(".plaque");
    for (var i = 0; i < plaques.length; i++) {
      var s = scenes[i];
      if (!s || !s.ctx || s.canvas.parentNode !== plaques[i]) continue;
      if (!s.ready) { plaques[i].classList.remove("gl-on"); continue; }
      plaques[i].classList.add("gl-on");
      var c = s.canvas, w = Math.round(c.offsetWidth * dpr), h = Math.round(c.offsetHeight * dpr);
      if (!w || !h) continue;
      // non più di ~900 px di lato: sul telefono basta e avanza
      var k = Math.min(1, 720 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
      var gl = s.ctx.gl, P = program(s.ctx, s.mode);
      if (!P) continue;
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      gl.viewport(0, 0, w, h);
      gl.useProgram(P.pr);
      gl.enableVertexAttribArray(P.loc); gl.vertexAttribPointer(P.loc, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.texI); gl.uniform1i(P.u.u_img, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, s.texD); gl.uniform1i(P.u.u_dep, 1);
      // il dipinto copre la tessera, centrato un po' sotto la metà
      var A = w / h, B = s.aspect || 1.34;
      var cov = A > B ? [1, B / A] : [A / B, 1];
      var cy = Math.max(cov[1] / 2, Math.min(1 - cov[1] / 2, .55));
      gl.uniform2f(P.u.u_res, w, h); gl.uniform2f(P.u.u_cov, cov[0], cov[1]); gl.uniform2f(P.u.u_ctr, .5, cy);
      gl.uniform2f(P.u.u_tilt, tilt.x, tilt.y);
      gl.uniform1f(P.u.u_t, (now % 600) + s.seed * 10);
      // l'evento della rovina (colpo sull'incudine, lampo, rintocco…) a intervalli irregolari
      var ev = EVENT[s.mode];
      if (ev && now - s.evAt > s.evNext) { s.evAt = now; s.evNext = ev[0] + Math.random() * (ev[1] - ev[0]); }
      gl.uniform1f(P.u.u_ev, ev && now >= s.evAt ? now - s.evAt : 99);
      var lane = plaques[i].closest(".lane"), lead = lane && lane.getAttribute("data-lead");
      s.lead = (s.lead || 0) + (((lead === "you") ? 1 : (lead === "rival") ? -1 : 0) - (s.lead || 0)) * .05;
      gl.uniform1f(P.u.u_lead, s.lead);
      gl.uniform1f(P.u.u_seed, s.seed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
  if (!REDUCED) requestAnimationFrame(frame);

  window.SigilTavolo = { scenes: scenes, MODES: MODES };
})();
