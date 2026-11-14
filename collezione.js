"use strict";

/*
 * SIGIL — Collezione, mazzo e premi.
 *
 * Primo avvio: giuri fedeltà a una casata. Ricevi le sue 13 carte più 7 carte
 * base delle altre casate. Il mazzo iniziale sono 12 carte della tua casata.
 * Tutte le altre si scoprono giocando:
 *   - ogni partita dà esperienza; ogni livello (100 punti) regala una carta;
 *   - ogni nemico finale del Viaggio, battuto la prima volta, regala una carta;
 *   - il Duello dà più esperienza.
 * Il mazzo si compone nella schermata "Mazzo e collezione": 12 carte diverse.
 */
(function () {
  var E = window.Lume;
  var G = window.SigilGame;
  if (!E || !G) return;

  var SIZE = E.DECK_SIZE || 12;
  var XP_LEVEL = 100;
  // Carte base: semplici, una manciata da ogni casata. Ne ricevi 7 che non siano della tua.
  var BASE = ["corriere", "vigile", "barista", "giullare", "candela", "chiavi", "ladro", "corvo", "grifone", "lampione", "orso", "caduta"];
  // Tutte le carte che si possono avere (set base + «Il Risveglio»).
  // Le carte iniziali vengono solo dal set base (E.CARDS).
  var ALL = E.ALL_CARDS || E.CARDS;
  var BY_ID = {};
  ALL.forEach(function (c) { BY_ID[c.id] = c; });
  var HOUSE = {};
  E.HOUSES.forEach(function (h) { HOUSE[h.id] = h; });

  function S() { return G.save(); }
  function ready() { var s = S(); return !!(s.collection && s.deck && s.sworn); }
  function owns(id) { var s = S(); return !!(s.collection && s.collection[id]); }
  function ownedIds() { var c = S().collection || {}; return Object.keys(c).filter(function (k) { return c[k] && BY_ID[k]; }); }
  function byCost(a, b) { return BY_ID[a].cost - BY_ID[b].cost || BY_ID[a].name.localeCompare(BY_ID[b].name); }

  function starter(house) {
    var mine = E.CARDS.filter(function (c) { return c.house === house; }).map(function (c) { return c.id; }).sort(byCost);
    var base = BASE.filter(function (id) { return BY_ID[id].house !== house; }).slice(0, 7);
    var deck = mine.slice(0, SIZE); // la più costosa resta fuori dal mazzo, ma è nella collezione
    return { owned: mine.concat(base), deck: deck };
  }

  function Cloud() { return window.SigilCloud && window.SigilCloud.online() ? window.SigilCloud : null; }

  function swear(house, name) {
    var s = S();
    var st = starter(house);
    s.sworn = house;
    s.house = house;
    s.name = name || "Custode";
    s.collection = {};
    st.owned.forEach(function (id) { s.collection[id] = 1; });
    s.deck = st.deck;
    s.xp = s.xp || 0;
    s.level = s.level || 1;
    G.persist();
    // Sul server: stesse carte iniziali, più l'ambra di benvenuto.
    if (window.SigilCloud) window.SigilCloud.ready().then(function () {
      var c = Cloud();
      if (c) c.init(house, s.name).then(function () { menuLine(); }).catch(function (e) { console.warn(e); });
    });
  }

  // Il mazzo per giocare: se non è completo lo completo con le carte meno costose che possiedi.
  function deckForPlay() {
    if (!ready()) return null;
    var s = S();
    var deck = (s.deck || []).filter(function (id) { return owns(id); });
    var seen = {};
    deck = deck.filter(function (id) { if (seen[id]) return false; seen[id] = 1; return true; });
    if (deck.length < SIZE) {
      ownedIds().sort(byCost).forEach(function (id) { if (deck.length < SIZE && !seen[id]) { deck.push(id); seen[id] = 1; } });
    }
    return deck.length === SIZE ? deck.slice(0, SIZE) : null;
  }

  /* ───────── premi ───────── */
  var rewards = [];
  var pending = false;   // il server sta ancora annotando la partita
  var rewardNote = "";
  function grant(n, reason) {
    var s = S();
    var locked = ALL.filter(function (c) { return !owns(c.id); });
    for (var i = 0; i < n; i++) {
      if (!locked.length) { s.gettoni = (s.gettoni || 0) + 3; rewards.push({ type: "pegni", amount: 3, reason: reason }); continue; }
      var pick = locked.splice(Math.floor(Math.random() * locked.length), 1)[0];
      s.collection[pick.id] = 1;
      s.fresh = s.fresh || {};
      s.fresh[pick.id] = 1;
      rewards.push({ type: "card", id: pick.id, reason: reason });
    }
    G.persist();
  }
  function beginSettle() { rewards = []; pending = false; rewardNote = ""; }

  // Mostra i premi decisi dal server: res = { xp, levels, cards, note }.
  function fromServer(promise) {
    pending = true;
    paintRewards();
    promise.then(function (res) {
      pending = false;
      rewards = [];
      if (!res) { paintRewards(); return; }
      if (res.ignored) rewardNote = IGNORED[res.ignored] || "Il registro non ha annotato questa veglia.";
      if (res.note) rewardNote = res.note;
      if (res.queued) rewardNote = res.queued;
      if (res.xp) rewards.push({ type: "xp", amount: res.xp });
      var lv = S().level || 1;
      for (var i = (res.levels || 0) - 1; i >= 0; i--) rewards.push({ type: "level", level: lv - i });
      (res.objectives || []).forEach(function (label) { rewards.push({ type: "objective", label: label }); });
      (res.cards || []).forEach(function (id) { if (BY_ID[id]) rewards.push({ type: "card", id: id }); });
      paintRewards();
      menuLine();
    }).catch(function (e) {
      pending = false;
      rewardNote = "Il registro non risponde: " + e.message;
      paintRewards();
    });
  }

  var IGNORED = {
    "partita troppo breve": "Il registro non annota veglie così brevi (meno di 40 secondi).",
    "troppo presto": "Il registro non annota due veglie a meno di 30 secondi l'una dall'altra.",
    "già annotata": "Questa veglia era già annotata."
  };
  function queuedNote(n) {
    return "Sei senza rete: la veglia è annotata qui e il registro dei Custodi la conterà appena torni online" +
      (n > 1 ? " (" + n + " in attesa)." : ".") + " Esperienza, carte e obiettivi arriveranno allora.";
  }

  function onSettle(view, mode) {
    if (!ready()) return;
    var s = S();
    var pvp = mode === "pvp";
    var cloud = window.SigilCloud;
    var c = Cloud();
    if (cloud && !pvp) {
      var m = G.match() || {};
      var j = m._journey || {};
      var result = view.reason === "ritiro" && view.retreated === "you" ? "retreat" : view.winner === "you" ? "win" : view.winner === "tie" ? "tie" : "loss";
      var entry = {
        mode: mode === "viaggio" ? "viaggio" : view.daily ? "daily" : "libera",
        result: result,
        stake: view.stake,
        seconds: Math.round((Date.now() - (m._t0 || Date.now())) / 1000),
        level: j.level,
        stars: j.stars
      };
      // Senza rete (o se la rete cade proprio adesso) la veglia va in coda: niente premi in anticipo, niente perso.
      var later = function () { return { queued: queuedNote(cloud.queue(entry)) }; };
      fromServer(c ? c.report(entry).catch(function (e) {
        if (/fetch|network|rete|Failed|connessione|risponde/i.test(e.message || "")) return later();
        throw e;
      }) : Promise.resolve(later()));
      return;
    }
    if (c || pvp) return; // il Duello annota da sé (serve il resoconto di entrambi)
    var gain = view.winner === "you" ? (pvp ? 60 : 40) : view.winner === "tie" ? (pvp ? 30 : 20) : (pvp ? 20 : 15);
    if (view.reason === "ritiro" && view.retreated === "you") gain = 5;
    s.xp = (s.xp || 0) + gain;
    s.level = s.level || 1;
    rewards.unshift({ type: "xp", amount: gain });
    while (s.xp >= XP_LEVEL) {
      s.xp -= XP_LEVEL;
      s.level += 1;
      rewards.push({ type: "level", level: s.level });
      grant(1, "livello " + s.level);
    }
    G.persist();
  }
  function fillEnd(view, el) {
    if (!el.extra) return;
    el.extra.insertAdjacentHTML("beforeend", '<div class="rewards" id="rewardBox"></div>');
    paintRewards();
  }
  function paintRewards() {
    var box = document.getElementById("rewardBox");
    if (!box) return;
    if (pending) { box.innerHTML = '<p class="end-note pending">Il registro dei Custodi annota la veglia…</p>'; return; }
    var html = rewardNote ? '<p class="end-note">' + G.esc(rewardNote) + "</p>" : "";
    rewards.forEach(function (r) {
      if (r.type === "xp") html += '<p class="xp-line">+' + r.amount + " esperienza · livello " + S().level + " <span class=\"xp-bar\"><i style=\"width:" + Math.round((S().xp / XP_LEVEL) * 100) + '%"></i></span></p>';
      if (r.type === "level") html += '<p class="level-up">Sali al livello ' + r.level + "!</p>";
      if (r.type === "pegni") html += '<p class="end-note">Hai già ogni carta: ricevi ' + r.amount + " pegni.</p>";
      if (r.type === "objective") html += '<p class="objective-done">Obiettivo compiuto: ' + G.esc(r.label) + ' <small>· riscatta il premio in Obiettivi</small></p>';
    });
    var cards = rewards.filter(function (r) { return r.type === "card"; });
    if (cards.length) {
      html += '<p class="reward-title">' + (cards.length === 1 ? "Una nuova carta si unisce a te" : cards.length + " nuove carte si uniscono a te") + "</p>";
      html += '<div class="reward-cards">' + cards.map(function (r) { return G.cardHTML(BY_ID[r.id], { cls: "reward-card" }); }).join("") + "</div>";
      html += '<p class="end-note">Le trovi in Mazzo e collezione.</p>';
    }
    box.innerHTML = html;
    G.bindArt(box);
  }

  /* ───────── giuramento (primo avvio) ───────── */
  var oath = document.createElement("section");
  oath.className = "sheet oath-sheet";
  oath.id = "oath";
  oath.hidden = true;
  document.body.appendChild(oath);

  function paintOath(selected) {
    oath.innerHTML =
      '<div class="oath-inner">' +
        '<p class="eyebrow">Prima della prima notte</p>' +
        "<h2>Giura fedeltà a una casata</h2>" +
        '<p class="oath-lore">Nessun Custode veglia da solo. Scegli chi camminerà al tuo fianco: ti darà le sue tredici carte e il tuo primo mazzo. Le altre casate le incontrerai lungo la strada, una carta alla volta.</p>' +
        '<div class="oath-grid">' + E.HOUSES.map(function (h) {
          var sample = E.CARDS.filter(function (c) { return c.house === h.id; }).sort(function (a, b) { return b.power - a.power; }).slice(0, 3);
          return '<button type="button" class="oath-house' + (selected === h.id ? " on" : "") + '" data-house="' + h.id + '" data-swear="' + h.id + '">' +
            G.glyph(h.id, "oath-glyph") +
            "<b>" + G.esc(h.name) + "</b>" +
            "<em>" + G.esc(h.motto) + "</em>" +
            "<span>" + G.esc(h.text) + "</span>" +
            '<small>' + sample.map(function (c) { return G.esc(c.name); }).join(" · ") + "</small>" +
            "</button>";
        }).join("") + "</div>" +
        '<div class="oath-preview" id="oathPreview"></div>' +
        '<label class="oath-name">Il tuo nome di Custode<input id="oathName" maxlength="20" autocomplete="off" placeholder="come ti chiameranno gli altri Custodi" value="' + G.esc(oathName) + '"></label>' +
        '<button type="button" class="button primary oath-go" id="oathGo"' + (selected ? "" : " disabled") + ">" + (selected ? "Giuro fedeltà · " + G.esc(HOUSE[selected].name) : "Scegli una casata") + "</button>" +
      "</div>";
    if (selected) {
      var st = starter(selected);
      oath.querySelector("#oathPreview").innerHTML = '<p class="label">Il tuo primo mazzo</p><div class="mini-deck">' +
        st.deck.map(function (id) { return G.cardHTML(BY_ID[id], { cls: "tiny-card" }); }).join("") + "</div>" +
        '<p class="end-note">In più ricevi 1 carta della casata da tenere da parte e 7 carte base delle altre casate.</p>';
      G.bindArt(oath);
    }
  }
  var oathPick = null;
  var oathName = "";
  oath.addEventListener("input", function (e) { if (e.target.id === "oathName") oathName = e.target.value; });
  oath.addEventListener("click", function (e) {
    var b = e.target.closest("[data-swear]");
    if (b) { oathPick = b.dataset.swear; paintOath(oathPick); return; }
    if (e.target.closest("#oathGo") && oathPick) {
      var n = oathName.trim();
      if (n && n.length < 2) { oath.querySelector("#oathName").focus(); return; }
      swear(oathPick, n || "Custode");
      oath.hidden = true;
      G.showMenu(true);
      openDeck(true);
    }
  });
  function needOath() {
    if (ready()) return false;
    G.showMenu(false);
    oathPick = null;
    paintOath(null);
    oath.hidden = false;
    return true;
  }

  /* ───────── mazzo e collezione ───────── */
  var deckSheet = document.createElement("section");
  deckSheet.className = "sheet deck-sheet";
  deckSheet.id = "deckSheet";
  deckSheet.hidden = true;
  deckSheet.innerHTML =
    '<header class="journey-head">' +
      '<button type="button" class="icon-button" id="deckBack" aria-label="Torna alla soglia">←</button>' +
      '<div><p class="eyebrow">Mazzo e collezione</p><h2>Le carte del Custode</h2></div>' +
      '<div class="journey-total" id="deckOwned"></div>' +
    "</header>" +
    '<div class="deck-body">' +
      '<aside class="deck-panel">' +
        '<div class="deck-top"><p class="label">Il tuo mazzo</p><b id="deckCount"></b></div>' +
        '<div class="deck-curve" id="deckCurve"></div>' +
        '<ol class="deck-list" id="deckList"></ol>' +
        '<p class="deck-hint" id="deckHint"></p>' +
        '<div class="deck-level" id="deckLevel"></div>' +
      "</aside>" +
      '<section class="deck-collection">' +
        '<div class="codex-filters" id="deckFilters"></div>' +
        '<div class="codex-grid deck-grid" id="deckGrid"></div>' +
      "</section>" +
    "</div>";
  document.body.appendChild(deckSheet);
  var filter = { show: "tutte", house: "tutte" };
  var $ = function (id) { return document.getElementById(id); };

  function paintDeck() {
    var s = S();
    var deck = (s.deck || []).filter(owns);
    s.deck = deck;
    var owned = ownedIds();
    $("deckOwned").textContent = owned.length + " / " + ALL.length + " carte";
    $("deckCount").textContent = deck.length + " / " + SIZE;
    $("deckCount").className = deck.length === SIZE ? "ok" : "";
    // Curva dei costi
    var curve = [1, 2, 3, 4, 5, 6].map(function (c) { return deck.filter(function (id) { return BY_ID[id].cost === c; }).length; });
    var max = Math.max(3, Math.max.apply(null, curve));
    $("deckCurve").innerHTML = curve.map(function (n, i) {
      return '<span><i style="height:' + Math.round((n / max) * 100) + '%"></i><b>' + n + "</b><small>" + (i + 1) + "</small></span>";
    }).join("");
    $("deckList").innerHTML = deck.slice().sort(byCost).map(function (id) {
      var c = BY_ID[id];
      return '<li data-house="' + c.house + '" data-remove="' + id + '" title="Togli dal mazzo"><span class="dl-cost">' + c.cost + "</span><span class=\"dl-name\">" + G.esc(c.name) + '</span><span class="dl-pow">' + c.power + "</span></li>";
    }).join("") + (deck.length < SIZE ? new Array(SIZE - deck.length + 1).join('<li class="empty">— posto libero —</li>') : "");
    var hint = "";
    if (deck.length < SIZE) hint = "Mancano " + (SIZE - deck.length) + " carte. Se giochi così, il mazzo si completa da solo con le tue carte più economiche.";
    else if (!deck.some(function (id) { return BY_ID[id].cost === 1; })) hint = "Nessuna carta da 1 lume: la prima ora rischi di restare a guardare.";
    else hint = "Pronto. Tocca una carta del mazzo per toglierla, una della collezione per aggiungerla.";
    $("deckHint").textContent = hint;
    $("deckLevel").innerHTML = "Livello " + (s.level || 1) + '<span class="xp-bar"><i style="width:' + Math.round(((s.xp || 0) / XP_LEVEL) * 100) + '%"></i></span><small>Ogni livello porta una carta nuova. Le vittorie valgono di più, i duelli ancora di più.</small>';

    var chips = [{ id: "tutte", name: "Tutte" }, { id: "mie", name: "Le mie" }, { id: "nuove", name: "Da scoprire" }];
    $("deckFilters").innerHTML = chips.map(function (c) {
      return '<button type="button" class="house-chip" data-house="misto" data-show="' + c.id + '" aria-checked="' + (filter.show === c.id) + '"><span>' + c.name + "</span></button>";
    }).join("") + '<span class="chip-sep"></span>' + [{ id: "tutte", name: "Ogni casata" }].concat(E.HOUSES).map(function (h) {
      return '<button type="button" class="house-chip" data-house="' + (h.id === "tutte" ? "misto" : h.id) + '" data-hfilter="' + h.id + '" aria-checked="' + (filter.house === h.id) + '">' + G.glyph(h.id === "tutte" ? "misto" : h.id) + "<span>" + G.esc(h.name) + "</span></button>";
    }).join("");

    var inDeck = {};
    deck.forEach(function (id) { inDeck[id] = 1; });
    var list = ALL.slice().sort(function (a, b) { return byCost(a.id, b.id); }).filter(function (c) {
      if (filter.house !== "tutte" && c.house !== filter.house) return false;
      if (filter.show === "mie" && !owns(c.id)) return false;
      if (filter.show === "nuove" && owns(c.id)) return false;
      return true;
    });
    var fresh = s.fresh || {};
    $("deckGrid").innerHTML = list.map(function (c) {
      var have = owns(c.id);
      var cls = (have ? "" : "locked") + (inDeck[c.id] ? " in-deck" : "") + (fresh[c.id] ? " is-new" : "");
      return '<div class="codex-item">' + G.cardHTML(c, { tag: "button", cls: cls.trim(), attrs: ' data-pick="' + c.id + '"' }) +
        (have ? (inDeck[c.id] ? '<p class="in-deck-label">Nel mazzo</p>' : "<p>" + G.esc(c.lore) + "</p>") : '<p class="locked-label">Da scoprire giocando</p>') + "</div>";
    }).join("");
    G.bindArt(deckSheet);
  }

  function openDeck(first) {
    if (needOath()) return;
    G.showMenu(false);
    deckSheet.hidden = false;
    paintDeck();
    if (first) $("deckHint").textContent = "Ecco il tuo primo mazzo. Puoi cambiarlo quando vuoi: le carte nuove arriveranno giocando.";
  }
  function syncDeck() { var c = Cloud(); if (c) c.setDeck(S().deck); }
  function closeDeck() {
    var s = S();
    s.fresh = {};
    G.persist();
    syncDeck();
    deckSheet.hidden = true;
    G.showMenu(true);
  }
  deckSheet.addEventListener("click", function (e) {
    var s = S();
    var t;
    if ((t = e.target.closest("#deckBack"))) { closeDeck(); return; }
    if ((t = e.target.closest("[data-show]"))) { filter.show = t.dataset.show; paintDeck(); return; }
    if ((t = e.target.closest("[data-hfilter]"))) { filter.house = t.dataset.hfilter; paintDeck(); return; }
    if ((t = e.target.closest("[data-remove]"))) {
      s.deck = s.deck.filter(function (id) { return id !== t.dataset.remove; });
      G.persist(); paintDeck(); return;
    }
    if ((t = e.target.closest("[data-pick]"))) {
      var id = t.dataset.pick;
      if (!owns(id)) { $("deckHint").textContent = "Questa carta non è ancora tua: la scoprirai giocando, o la trovi in Bottega."; return; }
      if (s.deck.indexOf(id) >= 0) s.deck = s.deck.filter(function (x) { return x !== id; });
      else if (s.deck.length >= SIZE) { $("deckHint").textContent = "Il mazzo è pieno: togli prima una carta (tocca il suo nome a sinistra)."; return; }
      else s.deck.push(id);
      G.persist(); paintDeck(); syncDeck();
    }
  });

  /* ───────── menu ───────── */
  function menuLine() {
    var el = document.getElementById("menuLevel");
    if (!el) return;
    if (!ready()) { el.innerHTML = ""; return; }
    var s = S();
    var cloud = window.SigilCloud;
    var cs = cloud ? cloud.state() : "offline";
    var waiting = cloud ? cloud.pending() : 0;
    var dot = cs === "online" ? '<span class="cloud-dot on" title="Progressi salvati nel registro dei Custodi">●</span>'
      : cs === "connecting" ? '<span class="cloud-dot" title="Mi collego al registro…">◌</span>'
      : '<button type="button" class="cloud-dot off" id="cloudRetry" title="Il registro non risponde: le veglie restano in attesa qui e verranno contate al ritorno. Tocca per riprovare.">○</button>';
    if (waiting) dot += '<span class="sync-wait" title="Veglie giocate senza rete, in attesa del registro">' + waiting + " in attesa</span>";
    el.innerHTML = dot + G.glyph(s.sworn, "mini-sigil") + '<span data-house="' + s.sworn + '">' + G.esc(s.name || "Custode") + " · " + G.esc(HOUSE[s.sworn].name) + "</span> · livello " + (s.level || 1) +
      '<span class="xp-bar"><i style="width:' + Math.round(((s.xp || 0) / XP_LEVEL) * 100) + '%"></i></span>' + ownedIds().length + "/" + ALL.length + " carte" +
      (s.ambra != null ? ' · <span class="ambra-count" title="Ambra">◆ ' + s.ambra + "</span>" : "");
    var retry = document.getElementById("cloudRetry");
    if (retry) retry.addEventListener("click", function () { window.SigilCloud.retry(); });
    // Riepilogo delle veglie giocate senza rete, appena il registro le ha contate.
    var sync = cloud && cloud.lastSync();
    var note = document.getElementById("syncNote");
    if (!note && el.parentNode) {
      note = document.createElement("button");
      note.type = "button";
      note.id = "syncNote";
      note.className = "sync-note";
      note.hidden = true;
      el.parentNode.insertBefore(note, el.nextSibling);
      note.addEventListener("click", function () { window.SigilCloud.clearSync(); note.hidden = true; });
    }
    if (note) {
      if (sync && (sync.accepted || sync.ignored)) {
        var bits = [];
        if (sync.xp) bits.push("+" + sync.xp + " esperienza");
        if (sync.cards && sync.cards.length) bits.push(sync.cards.length === 1 ? "1 carta nuova" : sync.cards.length + " carte nuove");
        if (sync.objectives && sync.objectives.length) bits.push(sync.objectives.length === 1 ? "1 obiettivo compiuto" : sync.objectives.length + " obiettivi compiuti");
        note.innerHTML = "Il registro ha contato " + (sync.accepted === 1 ? "1 veglia" : sync.accepted + " veglie") + " giocate senza rete" +
          (bits.length ? ": " + bits.join(", ") : "") + "." + (sync.ignored ? " " + sync.ignored + " non valide (troppo brevi o troppo fitte)." : "") + " <small>Tocca per chiudere</small>";
        note.hidden = false;
      } else note.hidden = true;
    }
    var fresh = Object.keys(s.fresh || {}).length;
    var btn = document.getElementById("deckButton");
    var badge = btn && btn.querySelector(".mode-badge");
    if (badge) badge.innerHTML = fresh ? '<small class="new-badge">' + fresh + " nuove</small>" : "";
  }
  var prev = G.onMenu;
  G.onMenu = function () { if (prev) prev(); menuLine(); };
  var deckBtn = document.getElementById("deckButton");
  if (deckBtn) deckBtn.addEventListener("click", function () { openDeck(false); });

  window.SigilCollezione = {
    ready: ready,
    owns: owns,
    needOath: needOath,
    deckForPlay: deckForPlay,
    grant: grant,
    beginSettle: beginSettle,
    onSettle: onSettle,
    fillEnd: fillEnd,
    fromServer: fromServer,
    openDeck: openDeck,
    refreshMenu: menuLine
  };
  menuLine();
  // Quando il registro risponde: aggiorno la soglia e, se il server ti conosce già, salto il giuramento.
  if (window.SigilCloud) window.SigilCloud.on(function () {
    menuLine();
    if (ready() && !oath.hidden) { oath.hidden = true; G.showMenu(true); }
    if (!deckSheet.hidden) paintDeck();
  });
  // Se l'intro non è in corso (già vista in questa sessione), il giuramento parte subito.
  var intro = document.getElementById("intro");
  if (!ready() && (!intro || intro.hasAttribute("hidden"))) needOath();
})();
