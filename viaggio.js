"use strict";

/*
 * SIGIL — Il Viaggio.
 * Trenta tappe contro l'Ombra, su un sentiero che sale. Ogni capitolo è
 * un'arena; l'Ombra diventa più forte e le rovine aumentano (3, poi 4, poi 5).
 * Si sblocca una tappa alla volta. Fino a tre stelle per tappa:
 *   ★   vinci
 *   ★★  vinci con almeno 8 di forza di scarto in totale
 *   ★★★ vinci tenendo tutte le rovine
 */
(function () {
  var E = window.Lume;
  var G = window.SigilGame;
  if (!E || !G) return;

  var CHAPTERS = [
    { id: "valle", name: "Valle delle tre rovine", arena: "valle", poster: "art/copertina.jpg", lanes: 3, ai: [1, 1, 2, 2, 2, 3], sign: "fontana",
      boss: "Il Guardiano della Valle", tale: "Dove tutto comincia: tre torri, tre fiamme, e un'Ombra che ancora non conosce le tue mani." },
    { id: "cripta", name: "Cripta del Silenzio", arena: "cripta", poster: "art/places/vicolo.jpg", lanes: 3, ai: [2, 3, 3, 3, 4, 4], sign: "vicolo",
      boss: "La Badessa muta", tale: "Sotto la valle le candele non si spengono mai. Qui le preghiere non fanno eco, e le abilità Sempre tacciono spesso." },
    { id: "palude", name: "Palude dei Rovi", arena: "palude", poster: "art/arene/palude.jpg", lanes: 4, ai: [3, 4, 4, 4, 5, 5], sign: "cantiere",
      boss: "La Strega dei Rovi", tale: "La terra cede. Quattro rovine affiorano dal fango, e l'Ombra ha imparato ad aspettare." },
    { id: "porto", name: "Porto del Leviatano", arena: "porto", poster: "art/arene/porto.jpg", lanes: 4, ai: [4, 5, 5, 5, 6, 6], sign: "osteria",
      boss: "Il Pescatore d'ossa", tale: "Il faro è spento da cent'anni. Al largo, qualcosa che sembra un'isola respira." },
    { id: "piana", name: "Piana del drago", arena: "piana", poster: "art/arene/piana.jpg", lanes: 5, ai: [5, 6, 6, 6, 7, 7], sign: "piazza",
      boss: "Il Dormiente", tale: "L'ultima piana. Cinque rovine sulla terra che brucia. Sotto di te, il Dormiente apre un occhio." }
  ];

  var HOUSE_IDS = E.HOUSES.map(function (h) { return h.id; });
  var LOC_IDS = E.LOCATIONS.map(function (l) { return l.id; });
  var DIFF = ["", "Ombra acerba", "Ombra incerta", "Ombra attenta", "Ombra scaltra", "Ombra antica", "Ombra feroce", "Ombra senza nome"];

  function hash(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rnd(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Tutte le tappe, calcolate una volta: stesse rovine e stessa Ombra per tutti.
  var LEVELS = [];
  CHAPTERS.forEach(function (ch, ci) {
    ch.ai.forEach(function (ai, li) {
      var n = LEVELS.length + 1;
      var r = rnd(hash("viaggio|" + n));
      var pool = LOC_IDS.filter(function (id) { return id !== ch.sign; });
      for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      var locs = pool.slice(0, ch.lanes - 1);
      locs.splice(Math.floor(ch.lanes / 2), 0, ch.sign); // la rovina simbolo del capitolo sta al centro
      var boss = li === ch.ai.length - 1;
      LEVELS.push({
        n: n,
        chapter: ci,
        step: li + 1,
        lanes: ch.lanes,
        aiLevel: ai,
        seed: hash("viaggio-seme|" + n),
        rivalHouse: HOUSE_IDS[hash("ombra-viaggio|" + n) % HOUSE_IDS.length],
        locations: locs,
        boss: boss,
        foe: boss ? ch.boss : DIFF[ai]
      });
    });
  });

  /* ───────── salvataggio ───────── */
  function J() {
    var s = G.save();
    if (!s.journey) s.journey = { unlocked: 1, stars: {} };
    return s.journey;
  }
  function totalStars() {
    var st = J().stars;
    return Object.keys(st).reduce(function (a, k) { return a + (st[k] || 0); }, 0);
  }
  function starsFor(view) {
    if (view.winner !== "you") return 0;
    var diff = view.lanes.reduce(function (a, l) { return a + (l.you - l.rival); }, 0);
    var s = 1;
    if (diff >= 8) s++;
    if (view.youLanes === view.lanes.length) s++;
    return s;
  }
  function starRow(n, max) {
    var out = "";
    for (var i = 0; i < (max || 3); i++) out += '<i class="' + (i < n ? "on" : "") + '">★</i>';
    return '<span class="stars">' + out + "</span>";
  }

  /* ───────── l'atlante del Sigillo ─────────
   * Una mappa che si esplora: le cinque regioni sono dipinti sospesi nel buio,
   * disposti intorno al Sigillo. Si entra dalla Valle (in basso), si gira in
   * senso orario (Cripta, Palude, Porto) e si finisce al centro, nella Piana
   * del drago, dove il Dormiente riposa sotto il Sigillo. Si trascina per
   * muoversi e si usa la rotella (o due dita) per avvicinarsi. Le regioni
   * ancora chiuse restano nella nebbia. */
  var W = 2700, H = 2200, CX = 1350, CY = 1100;
  var REGIONS = [
    { x: 1350, y: 1820, r: 290 },  // I · Valle, a sud: da qui comincia tutto
    { x: 630, y: 1100, r: 290 },   // II · Cripta, a ovest
    { x: 1350, y: 380, r: 290 },   // III · Palude, a nord
    { x: 2070, y: 1100, r: 290 },  // IV · Porto, a est
    { x: 1350, y: 1100, r: 330 }   // V · Piana del drago, al centro, sotto il Sigillo
  ];
  var ROMAN = ["I", "II", "III", "IV", "V"];

  function unit(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; }

  // Dove sta ogni tappa sull'atlante: un arco che attraversa la regione, dall'ingresso all'uscita.
  var NODES = [];
  REGIONS.forEach(function (R, ci) {
    var prev = REGIONS[ci - 1], next = REGIONS[ci + 1];
    var din = prev ? unit(R.x, R.y, prev.x, prev.y) : [0, 1];
    var count = LEVELS.filter(function (l) { return l.chapter === ci; }).length;
    var i, t;
    if (!next) {
      // L'ultima regione: una spirale che scende fino al cuore del Sigillo.
      var a0 = Math.atan2(din[1], din[0]);
      for (i = 0; i < count; i++) {
        t = i / (count - 1);
        var ang = a0 + t * Math.PI * 1.55;
        var rad = R.r * 0.74 * (1 - t);
        NODES.push({ x: R.x + Math.cos(ang) * rad, y: R.y + Math.sin(ang) * rad });
      }
      return;
    }
    var dout = unit(R.x, R.y, next.x, next.y);
    var a = [R.x + din[0] * R.r * 0.72, R.y + din[1] * R.r * 0.72];
    var b = [R.x + dout[0] * R.r * 0.72, R.y + dout[1] * R.r * 0.72];
    var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    var n = unit(mid[0], mid[1], R.x, R.y);
    var c = [R.x + n[0] * R.r * 0.62, R.y + n[1] * R.r * 0.62];
    for (i = 0; i < count; i++) {
      t = i / (count - 1);
      var u = 1 - t;
      NODES.push({ x: u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], y: u * u * a[1] + 2 * u * t * c[1] + t * t * b[1] });
    }
  });

  var sheet = document.createElement("section");
  sheet.className = "sheet journey-sheet";
  sheet.id = "journey";
  sheet.hidden = true;
  sheet.innerHTML =
    '<header class="journey-head">' +
      '<button type="button" class="icon-button" id="journeyBack" aria-label="Torna alla soglia">←</button>' +
      '<div><p class="eyebrow">Il Viaggio</p><h2>L\'atlante del Sigillo</h2></div>' +
      '<div class="journey-total" id="journeyTotal"></div>' +
    "</header>" +
    '<div class="atlas" id="atlas"><div class="atlas-world" id="atlasWorld"></div>' +
      '<div class="atlas-tip" id="atlasTip" hidden></div>' +
      '<div class="atlas-tools">' +
        '<button type="button" class="icon-button" data-zoom="in" aria-label="Avvicina">+</button>' +
        '<button type="button" class="icon-button" data-zoom="out" aria-label="Allontana">−</button>' +
        '<button type="button" class="icon-button" data-zoom="here" aria-label="Vai alla tappa di oggi" title="La tappa di oggi">◎</button>' +
        '<button type="button" class="icon-button" data-zoom="all" aria-label="Tutto l\'atlante" title="Tutto l\'atlante">⤢</button>' +
      "</div>" +
      '<p class="atlas-hint">Trascina per muoverti · rotella o due dita per avvicinarti</p>' +
    "</div>" +
    '<div class="modal" id="levelBox" hidden><div class="modal-card level-card" id="levelCard"></div></div>';
  document.body.appendChild(sheet);
  var atlas = sheet.querySelector("#atlas");
  var map = sheet.querySelector("#atlasWorld");
  var tip = sheet.querySelector("#atlasTip");
  var levelBox = sheet.querySelector("#levelBox");
  var levelCard = sheet.querySelector("#levelCard");
  map.style.width = W + "px";
  map.style.height = H + "px";

  function stateOf(l, j) {
    var st = j.stars[l.n] || 0;
    return l.n < j.unlocked || st ? "done" : l.n === j.unlocked ? "current" : "locked";
  }

  function road(p, q, bend, cls) {
    var mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    var cx = mx + bend[0], cy = my + bend[1];
    return '<path class="' + cls + '" d="M' + p.x.toFixed(1) + " " + p.y.toFixed(1) + " Q" + cx.toFixed(1) + " " + cy.toFixed(1) + " " + q.x.toFixed(1) + " " + q.y.toFixed(1) + '"/>';
  }

  function paintMap() {
    var j = J();
    sheet.querySelector("#journeyTotal").innerHTML = "★ " + totalStars() + " / " + LEVELS.length * 3;
    var html = "";
    var currentChapter = (LEVELS[Math.min(j.unlocked, LEVELS.length) - 1] || LEVELS[0]).chapter;

    // Il Sigillo: anelli che girano piano dietro a tutto, e i raggi verso le regioni.
    var seal = '<svg class="atlas-seal" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true"><g class="seal-turn">' +
      '<circle cx="' + CX + '" cy="' + CY + '" r="560" class="seal-ring"/>' +
      '<circle cx="' + CX + '" cy="' + CY + '" r="600" class="seal-ring dashed"/>' +
      '<circle cx="' + CX + '" cy="' + CY + '" r="980" class="seal-ring faint"/>';
    for (var k = 0; k < 12; k++) {
      var an = k * Math.PI / 6;
      seal += '<line x1="' + (CX + Math.cos(an) * 600) + '" y1="' + (CY + Math.sin(an) * 600) + '" x2="' + (CX + Math.cos(an) * 640) + '" y2="' + (CY + Math.sin(an) * 640) + '" class="seal-tick"/>';
    }
    seal += '</g><g class="seal-turn back">' +
      '<circle cx="' + CX + '" cy="' + CY + '" r="1040" class="seal-ring dashed faint"/></g>';
    REGIONS.slice(0, 4).forEach(function (R) {
      seal += '<line x1="' + CX + '" y1="' + CY + '" x2="' + R.x + '" y2="' + R.y + '" class="seal-spoke"/>';
    });
    seal += "</svg>";
    html += seal;

    // Le regioni: il dipinto dell'arena in un cerchio di luce, la nebbia se è ancora chiusa.
    CHAPTERS.forEach(function (ch, ci) {
      var R = REGIONS[ci];
      var levels = LEVELS.filter(function (l) { return l.chapter === ci; });
      var locked = levels[0].n > j.unlocked;
      var got = levels.reduce(function (a, l) { return a + (j.stars[l.n] || 0); }, 0);
      var away = ci === 4 ? [0, -1] : unit(CX, CY, R.x, R.y);
      var lx = R.x + away[0] * (R.r + 34), ly = R.y + away[1] * (R.r + 34);
      var ax = -50 + away[0] * 50, ay = -50 + away[1] * 50;
      html += '<div class="region' + (locked ? " locked" : "") + (ci === currentChapter && !locked ? " current" : "") + '" style="left:' + (R.x - R.r) + "px;top:" + (R.y - R.r) + "px;width:" + R.r * 2 + "px;height:" + R.r * 2 + 'px">' +
        "<div class=\"region-art\" style=\"background-image:url('" + ch.poster + "')\"></div>" +
        '<div class="region-fog"></div><div class="region-ring"></div></div>' +
        '<div class="region-label' + (locked ? " locked" : "") + '" style="left:' + lx + "px;top:" + ly + "px;--ax:" + ax + "%;--ay:" + ay + '%">' +
          "<span>Capitolo " + ROMAN[ci] + " · " + ch.lanes + " rovine</span><b>" + G.esc(ch.name) + "</b>" +
          (locked ? "<em>Nella nebbia: si apre battendo " + G.esc(CHAPTERS[ci - 1] ? CHAPTERS[ci - 1].boss : "") + "</em>"
                  : "<em>★ " + got + " / " + levels.length * 3 + "</em>") +
        "</div>";
    });

    // I sentieri tra le tappe: d'oro quelli percorsi, accesi quelli aperti, spenti gli altri.
    var roads = "";
    LEVELS.forEach(function (l, i) {
      if (!i) return;
      var p = NODES[i - 1], q = NODES[i];
      var prev = LEVELS[i - 1];
      var cls = stateOf(l, j) === "done" ? "road done" : stateOf(l, j) === "current" ? "road open" : "road";
      var bend;
      if (prev.chapter !== l.chapter) {
        // Tra due regioni: la strada piega verso l'esterno, lontano dal Sigillo.
        var m = unit(CX, CY, (p.x + q.x) / 2, (p.y + q.y) / 2);
        bend = l.chapter === 4 ? [0, 0] : [m[0] * 140, m[1] * 140];
        cls += " long";
      } else {
        var d = unit(p.x, p.y, q.x, q.y);
        var s = i % 2 ? 14 : -14;
        bend = [-d[1] * s, d[0] * s];
      }
      roads += road(p, q, bend, cls);
    });
    html += '<svg class="atlas-roads" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true">' + roads + "</svg>";

    // Le tappe
    LEVELS.forEach(function (l, i) {
      var p = NODES[i];
      var st = j.stars[l.n] || 0;
      var state = stateOf(l, j);
      html += '<button type="button" class="stop ' + state + (l.boss ? " boss" : "") + '" data-level="' + l.n + '" style="left:' + p.x.toFixed(1) + "px;top:" + p.y.toFixed(1) + 'px" aria-label="Tappa ' + l.n + (l.boss ? ", " + G.esc(l.foe) : "") + (state === "locked" ? ", ancora chiusa" : "") + '">' +
        (l.boss ? '<svg class="boss-sigil" aria-hidden="true"><use href="#g-sigillo"/></svg>' : "") +
        '<span class="num">' + (state === "locked" ? "" : l.n) + "</span>" +
        (state !== "locked" ? starRow(st) : "") +
        (l.boss ? '<span class="boss-name">' + G.esc(l.foe) + "</span>" : "") +
        "</button>";
    });
    map.innerHTML = html;
    apply();
  }

  /* ───────── muoversi sull'atlante ───────── */
  var view = { s: 0.6, x: 0, y: 0 };
  var placed = false;

  function minScale() { return Math.min(atlas.clientWidth / W, atlas.clientHeight / H) * 0.92; }
  function clampView() {
    var vw = atlas.clientWidth, vh = atlas.clientHeight;
    view.s = Math.max(minScale(), Math.min(1.5, view.s));
    // il centro dello schermo resta sempre dentro l'atlante
    view.x = Math.min(vw / 2, Math.max(vw / 2 - W * view.s, view.x));
    view.y = Math.min(vh / 2, Math.max(vh / 2 - H * view.s, view.y));
  }
  function apply() {
    clampView();
    map.style.transform = "translate(" + view.x.toFixed(1) + "px," + view.y.toFixed(1) + "px) scale(" + view.s.toFixed(4) + ")";
    // Da lontano tappe e nomi restano leggibili.
    map.style.setProperty("--k", Math.max(1, 0.62 / view.s).toFixed(3));
  }
  function glide() {
    map.classList.add("glide");
    clearTimeout(glide.t);
    glide.t = setTimeout(function () { map.classList.remove("glide"); }, 650);
  }
  function lookAt(x, y, s) {
    view.s = s;
    view.x = atlas.clientWidth / 2 - x * s;
    view.y = atlas.clientHeight / 2 - y * s;
    apply();
  }
  function zoomAt(px, py, factor) {
    var s = Math.max(minScale(), Math.min(1.5, view.s * factor));
    var wx = (px - view.x) / view.s, wy = (py - view.y) / view.s;
    view.s = s;
    view.x = px - wx * s;
    view.y = py - wy * s;
    apply();
  }
  function here() {
    var j = J();
    var i = Math.min(j.unlocked, LEVELS.length) - 1;
    var R = REGIONS[LEVELS[i].chapter];
    var fit = Math.min(atlas.clientWidth, atlas.clientHeight) / (R.r * 2.9);
    lookAt((NODES[i].x + R.x) / 2, (NODES[i].y + R.y) / 2, Math.max(minScale(), Math.min(1.1, fit)));
  }
  function all() { lookAt(CX, CY, minScale()); }

  // Trascinare con il mouse o un dito; avvicinarsi con due dita.
  var pts = {};
  var drag = null;
  var moved = false;
  atlas.addEventListener("pointerdown", function (e) {
    if (e.target.closest(".atlas-tools")) return;
    atlas.classList.add("used");
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pts);
    if (ids.length === 1) { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; moved = false; }
    else if (ids.length === 2) {
      var a = pts[ids[0]], b = pts[ids[1]];
      drag = { pinch: Math.hypot(a.x - b.x, a.y - b.y), s: view.s };
    }
  });
  window.addEventListener("pointermove", function (e) {
    if (sheet.hidden) return;
    if (pts[e.pointerId]) pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pts);
    if (drag && ids.length === 1 && !drag.pinch) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) { moved = true; atlas.classList.add("dragging"); tip.hidden = true; }
      if (moved) { view.x = drag.vx + dx; view.y = drag.vy + dy; apply(); }
    } else if (drag && ids.length === 2 && drag.pinch) {
      var a = pts[ids[0]], b = pts[ids[1]];
      var r = atlas.getBoundingClientRect();
      moved = true;
      zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, (Math.hypot(a.x - b.x, a.y - b.y) / drag.pinch) * drag.s / view.s);
    }
  });
  function lift(e) {
    delete pts[e.pointerId];
    var ids = Object.keys(pts);
    if (!ids.length) { drag = null; atlas.classList.remove("dragging"); }
    else if (ids.length === 1) { var p = pts[ids[0]]; drag = { x: p.x, y: p.y, vx: view.x, vy: view.y }; }
  }
  window.addEventListener("pointerup", lift);
  window.addEventListener("pointercancel", lift);
  atlas.addEventListener("wheel", function (e) {
    e.preventDefault();
    var r = atlas.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
  sheet.querySelector(".atlas-tools").addEventListener("click", function (e) {
    var b = e.target.closest("[data-zoom]");
    if (!b) return;
    glide();
    var z = b.dataset.zoom;
    if (z === "in") zoomAt(atlas.clientWidth / 2, atlas.clientHeight / 2, 1.35);
    else if (z === "out") zoomAt(atlas.clientWidth / 2, atlas.clientHeight / 2, 1 / 1.35);
    else if (z === "here") here();
    else all();
  });
  window.addEventListener("resize", function () { if (!sheet.hidden) apply(); });

  // Il cartiglio che segue il mouse sopra una tappa.
  map.addEventListener("pointerover", function (e) {
    var b = e.target.closest(".stop");
    if (!b || e.pointerType !== "mouse" || moved) return;
    var l = LEVELS[Number(b.dataset.level) - 1];
    var st = stateOf(l, J());
    tip.innerHTML = "<span>Tappa " + l.n + " · " + G.esc(CHAPTERS[l.chapter].name) + "</span><b>" + G.esc(l.boss ? l.foe : DIFF[l.aiLevel]) + "</b>" +
      (st === "locked" ? "<em>Ancora chiusa</em>" : starRow(J().stars[l.n] || 0));
    tip.hidden = false;
  });
  map.addEventListener("pointerout", function (e) { if (e.target.closest(".stop")) tip.hidden = true; });
  atlas.addEventListener("pointermove", function (e) {
    if (tip.hidden) return;
    var r = atlas.getBoundingClientRect();
    tip.style.left = (e.clientX - r.left + 16) + "px";
    tip.style.top = (e.clientY - r.top + 16) + "px";
  });

  function open() {
    G.showMenu(false);
    sheet.hidden = false;
    paintMap();
    // La prima volta, e dopo ogni tappa nuova, l'atlante si apre sulla tappa di oggi.
    if (placed !== J().unlocked) { here(); placed = J().unlocked; } else apply();
  }
  function close() {
    sheet.hidden = true;
    levelBox.hidden = true;
    tip.hidden = true;
  }

  function showLevel(n) {
    var l = LEVELS[n - 1];
    var ch = CHAPTERS[l.chapter];
    var st = J().stars[n] || 0;
    var locNames = l.locations.map(function (id) { return E.LOCATIONS.filter(function (x) { return x.id === id; })[0].name; });
    levelCard.innerHTML =
      '<p class="eyebrow">Tappa ' + n + " · " + G.esc(ch.name) + "</p>" +
      "<h2>" + (l.boss ? G.esc(l.foe) : "La " + ["prima", "seconda", "terza", "quarta", "quinta", "sesta"][l.step - 1] + " veglia") + "</h2>" +
      '<p class="level-foe">' + (l.boss ? "Custode del capitolo · " : "") + G.esc(DIFF[l.aiLevel]) + " · gioca la casata " + G.esc(G.houseName(l.rivalHouse)) + "</p>" +
      '<ul class="level-facts"><li><b>' + l.lanes + " rovine</b>" + G.esc(locNames.join(" · ")) + "</li>" +
      (E.AI_LEVELS[l.aiLevel].bonus ? '<li><b>Attenzione</b>L\'Ombra riceve un lume in più dalla ' + ["", "prima", "seconda", "terza", "quarta", "quinta", "sesta"][E.AI_LEVELS[l.aiLevel].bonusFrom] + " ora.</li>" : "") +
      (E.AI_LEVELS[l.aiLevel].extraCard ? "<li><b>Attenzione</b>L'Ombra comincia con una carta in più.</li>" : "") +
      (E.AI_LEVELS[l.aiLevel].awakened ? "<li><b>Il Risveglio</b>L'Ombra conosce anche le carte dell'espansione.</li>" : "") +
      "</ul>" +
      '<div class="level-stars">' + starRow(st) + "</div>" +
      '<ul class="level-goals"><li>★ Tieni più rovine dell\'Ombra</li><li>★★ …con almeno 8 di forza di scarto</li><li>★★★ …tenendo tutte le rovine</li></ul>' +
      '<div class="modal-actions"><button type="button" class="button ghost" data-act="close">Non ancora</button><button type="button" class="button primary" data-act="go" data-level="' + n + '">Accendi le candele</button></div>';
    levelBox.hidden = false;
  }

  function play(n) {
    var l = LEVELS[n - 1];
    close();
    G.start({
      mode: "viaggio",
      journeyLevel: l.n, // serve alla musica (musica.js)
      seed: l.seed,
      lanes: l.lanes,
      aiLevel: l.aiLevel,
      rivalHouse: l.rivalHouse,
      locations: l.locations,
      arena: CHAPTERS[l.chapter].arena
    }, hooksFor(l));
  }

  function hooksFor(l) {
    var earned = 0;
    var improved = false;
    return {
      settle: function (view, save) {
        var j = J();
        earned = starsFor(view);
        var before = j.stars[l.n] || 0;
        var m = G.match();
        if (m) m._journey = { level: l.n, stars: earned };
        // Il nemico finale di ogni capitolo, battuto la prima volta, regala una carta: la sceglie il server
        // quando riceve il resoconto (subito, oppure al ritorno della rete). Solo senza registro la do qui.
        if (earned && l.boss && !before && window.SigilCollezione && !window.SigilCloud) window.SigilCollezione.grant(1, l.foe);
        if (earned > before) {
          j.stars[l.n] = earned;
          save.gettoni += earned - before; // ogni stella nuova vale un pegno
          improved = true;
        }
        if (earned && l.n >= j.unlocked && l.n < LEVELS.length) j.unlocked = l.n + 1;
        if (earned && l.n === LEVELS.length) j.finished = true;
        G.persist();
      },
      fillEnd: function (view, el) {
        el.eyebrow.textContent = "Tappa " + l.n + " · " + CHAPTERS[l.chapter].name;
        var next = LEVELS[l.n];
        var html = '<div class="end-stars">' + starRow(earned) + "</div>";
        if (earned && improved) html += '<p class="end-note">Nuove stelle: ogni stella vale un pegno.</p>';
        if (earned && next && next.chapter !== l.chapter) html += '<p class="end-note">Si apre un nuovo capitolo: <b>' + G.esc(CHAPTERS[next.chapter].name) + "</b>, con " + CHAPTERS[next.chapter].lanes + " rovine.</p>";
        if (earned && !next) html += '<p class="end-note">Il Dormiente torna a dormire. Hai completato il Viaggio.</p>';
        el.extra.innerHTML = html;
        el.again.textContent = earned && next ? "Tappa successiva" : "Riprova la tappa";
      },
      again: function () {
        var next = LEVELS[l.n];
        if (earned && next) play(next.n);
        else play(l.n);
      },
      back: function () { open(); }
    };
  }

  /* ───────── eventi ───────── */
  sheet.querySelector("#journeyBack").addEventListener("click", function () { close(); G.showMenu(true); });
  map.addEventListener("click", function (e) {
    if (moved) return; // era un trascinamento, non un tocco
    var b = e.target.closest(".stop");
    if (!b || b.classList.contains("locked")) return;
    showLevel(Number(b.dataset.level));
  });
  levelBox.addEventListener("click", function (e) {
    var a = e.target.closest("[data-act]");
    if (e.target === levelBox || (a && a.dataset.act === "close")) { levelBox.hidden = true; return; }
    if (a && a.dataset.act === "go") play(Number(a.dataset.level));
  });

  function label() {
    var el = document.getElementById("journeyLabel");
    if (!el) return;
    var j = J();
    el.textContent = j.finished ? "completato · ★ " + totalStars() : "tappa " + j.unlocked + " di " + LEVELS.length;
  }
  var btn = document.getElementById("journeyButton");
  if (btn) btn.addEventListener("click", open);
  var prevMenu = G.onMenu;
  G.onMenu = function () { if (prevMenu) prevMenu(); label(); };
  label();

  window.SigilViaggio = { open: open, LEVELS: LEVELS, CHAPTERS: CHAPTERS };
})();
