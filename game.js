"use strict";

/* SIGILLO — interfaccia. Il motore sta in engine.js (window.Lume). */
(function () {
  var E = window.Lume;
  if (!E) return;

  var KEY = "lume-v1";
  // Cambia questo numero quando sostituisci delle illustrazioni, così il browser non usa le vecchie.
  var ART_VERSION = 7;
  var KIND = { none: "", ongoing: "Sempre", reveal: "Scopri", anchor: "Fermo" };
  var MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  var ORE = ["Prima", "Seconda", "Terza", "Quarta", "Quinta", "Sesta"];
  var ROMAN = ["I", "II", "III", "IV", "V", "VI"];
  var HOUSE = {};
  E.HOUSES.forEach(function (h) { HOUSE[h.id] = h; });
  var MISTO = { id: "misto", name: "Misto", motto: "Chi non giura a nessuno.", text: "Un mazzo raccolto dalle cinque casate, come il destino lo mescola." };
  var SHOWCASE = {
    misto: ["sindaca", "camion", "sacerdotessa"],
    guardia: ["vigile", "sindaca", "barista"],
    selva: ["lupo", "camion", "grifone"],
    congrega: ["strega", "sacerdotessa", "sguardo"],
    tesoro: ["candela", "golem", "orologio"],
    fondo: ["spettro", "titano", "fenice"]
  };
  var ALL = E.ALL_CARDS || E.CARDS;
  var BY_ID = {};
  ALL.forEach(function (c) { BY_ID[c.id] = c; });

  var match = null;
  var lastOpts = null;
  var selected = null;
  var detailId = null;
  var laneInfo = null;
  var timer = null;
  var seenFresh = {};
  var lastStake = 1;
  var lastScores = null;
  var audioCtx = null;
  var codexFilter = "tutte";
  var save = loadSave();

  var $ = function (id) { return document.getElementById(id); };
  var app = $("app");
  var menu = $("menu");
  var endSheet = $("end");
  var rules = $("rules");
  var confirmBox = $("confirm");
  var peek = $("peek");
  var narrow = window.matchMedia ? window.matchMedia("(max-width: 980px)") : { matches: false };
  // Telefoni, tablet e pieghevoli (schermi touch) giocano «alla Snap»: in mano solo
  // l'illustrazione, e la carta toccata si apre grande con le rovine dove deporla.
  var snapMode = window.matchMedia ? window.matchMedia("(pointer: coarse), (max-width: 699px)") : { matches: false };
  function applySnapMode() { document.documentElement.classList.toggle("alla-snap", !!snapMode.matches); }
  applySnapMode();
  if (snapMode.addEventListener) snapMode.addEventListener("change", applySnapMode);

  /* ───────── salvataggio ───────── */
  function loadSave() {
    var base = { gettoni: 0, wins: 0, losses: 0, ties: 0, streak: 0, bestStreak: 0, bestStake: 0, daily: {}, sound: true, house: "misto" };
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "{}");
      Object.keys(base).forEach(function (k) { if (raw[k] == null) raw[k] = base[k]; });
      if (raw.house !== "misto" && !HOUSE[raw.house]) raw.house = "misto";
      return raw;
    } catch (err) {
      return base;
    }
  }
  function saveSave() {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (err) { /* navigazione privata */ }
  }

  /* ───────── utilità ───────── */
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function pretty(iso) {
    if (!iso) return "";
    var p = iso.split("-");
    return Number(p[2]) + " " + MONTHS[Number(p[1]) - 1];
  }
  function reduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function show(el, visible) {
    if (visible) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  }
  function glyph(house, cls) {
    var id = HOUSE[house] ? house : "misto";
    return '<svg class="' + (cls || "") + '"><use href="#g-' + id + '"/></svg>';
  }
  function houseName(id) {
    return HOUSE[id] ? HOUSE[id].name : "Misto";
  }

  /* ───────── suono ───────── */
  function blip(kind) {
    if (!save.sound) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      var now = audioCtx.currentTime;
      var tones = {
        play: [[330, 0.1, "sine"]],
        flip: [[520, 0.06, "triangle"]],
        snap: [[196, 0.3, "triangle"], [294, 0.3, "triangle"]],
        win: [[392, 0.25, "sine"], [523, 0.35, "sine"], [659, 0.5, "sine"]],
        lose: [[220, 0.35, "sine"], [185, 0.5, "sine"]],
        no: [[140, 0.12, "square"]]
      }[kind] || [[360, 0.1, "sine"]];
      tones.forEach(function (t, i) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        var at = now + i * 0.12;
        osc.type = t[2];
        osc.frequency.value = t[0];
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, (kind === "no" ? 0.025 : 0.07) * sfxVolume()), at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + t[1]);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(at);
        osc.stop(at + t[1] + 0.05);
      });
    } catch (err) { /* niente audio */ }
  }
  // Volume degli effetti (0-1), deciso nelle impostazioni (impostazioni.js).
  function sfxVolume() { return save.sfxVol == null ? 1 : Math.max(0, Math.min(1, save.sfxVol)); }
  function setSound(on) {
    save.sound = on;
    saveSave();
  }
  // Avvisa gli altri moduli (musica, impostazioni) di cosa succede al tavolo.
  function tell(phase, extra) {
    try { window.dispatchEvent(new CustomEvent("sigil:match", { detail: Object.assign({ phase: phase }, extra || {}) })); } catch (err) { /* ignora */ }
  }

  /* ───────── arte ───────── */
  function artImg(id, kind) {
    var src = (kind === "place" ? "art/places/" + id : "art/cards/" + id) + ".jpg?v=" + ART_VERSION;
    var cls = kind === "place" ? "place-art" : "genart";
    return '<img class="' + cls + '" alt="" loading="lazy" src="' + esc(src) + '" data-art="' + esc(id) + '" data-kind="' + kind + '">';
  }
  function bindArt(scope) {
    var imgs = (scope || document).querySelectorAll("img[data-art]");
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].dataset.bound) continue;
      imgs[i].dataset.bound = "1";
      imgs[i].onerror = fallbackArt;
    }
  }
  function fallbackArt() {
    if (this.dataset.failed) return;
    this.dataset.failed = "1";
    var c = document.createElement("canvas");
    c.className = this.className;
    var place = this.dataset.kind === "place";
    c.width = place ? 480 : 300;
    c.height = place ? 200 : 420;
    this.replaceWith(c);
    if (window.LumePaint) window.LumePaint.draw(c, this.dataset.art, place ? "place" : "card");
  }

  /* ───────── carta intera ───────── */
  function cardHTML(card, o) {
    o = o || {};
    var tag = o.tag || "div";
    var cls = "card" + (o.cls ? " " + o.cls : "");
    // Evoluzioni (carta3d.js): le tue carte mostrano la cornice del loro livello.
    var evo = o.evo === false || card.owner === "rival" || !window.SigilEvo ? 1 : window.SigilEvo.level(card.id);
    if (evo > 1) cls += " evo-" + evo;
    var kind = KIND[card.kind] || "";
    var power = o.power != null ? o.power : card.power;
    var body = card.text
      ? esc(card.text)
      : '<span class="lore">' + esc(card.lore) + "</span>";
    var attrs = o.attrs || "";
    if (tag === "button") attrs += ' type="button"';
    return "<" + tag + ' class="' + cls + '" data-house="' + esc(card.house || "misto") + '"' + attrs + ">" +
      '<span class="art">' + artImg(card.id, "card") + "</span>" +
      (evo > 1 ? '<span class="c-evo" title="Livello ' + evo + '">' + new Array(evo).join("<i></i>") + "</span>" : "") +
      '<span class="c-cost" title="Lumi da spendere">' + card.cost + "</span>" +
      '<span class="c-house" title="' + esc(houseName(card.house)) + '">' + glyph(card.house) + "</span>" +
      '<span class="c-name">' + esc(card.name) + "</span>" +
      '<span class="c-kind">' + esc(kind || houseName(card.house)) + "</span>" +
      '<span class="c-text">' + body + "</span>" +
      '<span class="c-power" title="Forza">' + esc(power) + "</span>" +
      "</" + tag + ">";
  }

  /* ───────── pezzo sul tavolo ───────── */
  function freshKey(key, isFresh) {
    if (!isFresh || seenFresh[key]) return "";
    seenFresh[key] = true;
    return " fresh";
  }
  function pieceHTML(card, lane, index, ghost) {
    if (card.hidden) {
      return '<span class="piece back' + freshKey("back-" + lane + "-" + index, card.fresh) + '"><svg><use href="#g-sigillo"/></svg></span>';
    }
    var base = card.power;
    var now = card.current;
    var trend = card.revealed ? (now > base ? " up" : now < base ? " down" : "") : "";
    var evo = card.owner !== "rival" && window.SigilEvo ? window.SigilEvo.level(card.id) : 1;
    var cls = "piece " + (card.owner === "rival" ? "rival" : "you") + (evo > 1 ? " evo-" + evo : "") + (ghost ? " ghost" : "") + (!ghost && !card.revealed ? " covered" : "");
    var key = card.uid || (lane + "-" + index);
    return '<button type="button" class="' + cls + freshKey(key, card.fresh) + '" data-house="' + esc(card.house) + '" data-uid="' + esc(card.uid) +
      '" data-act="' + (ghost ? "unstage" : "detail") + '"' + (ghost ? ' data-order="' + card.order + '" title="Tocca per riprenderla in mano"' : ' title="' + esc(card.name) + '"') + ">" +
      artImg(card.id, "card") +
      '<span class="p-cost">' + card.cost + "</span>" +
      '<span class="p-power' + trend + '">' + esc(ghost ? card.power : now) + "</span></button>";
  }
  function slotsHTML(cards, max, cls, lane) {
    var html = cards.join("");
    for (var i = cards.length; i < max; i++) html += '<span class="slot"></span>';
    return '<div class="slots ' + cls + '" data-max="' + max + '">' + html + "</div>";
  }

  /* ───────── ingresso ───────── */
  function paintMenu() {
    var today = E.todayKey();
    $("dailyLabel").textContent = pretty(today);
    $("menuCoins").textContent = String(save.gettoni);
    $("menuStreak").textContent = String(save.streak);
    $("menuWins").textContent = String(save.wins);
    var daily = save.daily[today];
    $("menuDaily").textContent = daily ? (daily.winner === "you" ? "retta" : daily.winner === "tie" ? "in bilico" : "caduta") : "—";
    var list = [MISTO].concat(E.HOUSES);
    if ($("housePicker")) $("housePicker").innerHTML = list.map(function (h) {
      return '<button type="button" class="house-chip" role="radio" data-house="' + h.id + '" data-pick="' + h.id + '" aria-checked="' + (save.house === h.id) + '">' +
        glyph(h.id) + "<span>" + esc(h.name) + "</span></button>";
    }).join("");
    var cur = HOUSE[save.house] || MISTO;
    var blurb = $("houseBlurb");
    if (blurb) { blurb.setAttribute("data-house", cur.id); blurb.innerHTML = "<em>" + esc(cur.motto) + "</em> " + esc(cur.text); }
    var showcase = $("menuShow");
    if (showcase) showcase.innerHTML = (SHOWCASE[cur.id] || SHOWCASE.misto).map(function (id) { return cardHTML(BY_ID[id]); }).join("");
    bindArt(menu);
    if (window.SigilGame && window.SigilGame.onMenu) window.SigilGame.onMenu();
  }

  /* ───────── partita ───────── */
  // Una modalità (Viaggio, Duello) può agganciarsi: commit, snap, retreat, settle, fillEnd, again, leave.
  var hooks = {};

  function start(opts, modeHooks) {
    if (timer) clearTimeout(timer);
    timer = null;
    selected = null;
    detailId = null;
    laneInfo = null;
    seenFresh = {};
    lastScores = null;
    reviewing = false;
    endAt = 0;
    var C = window.SigilCollezione;
    if (C && !(opts && opts.seat) && C.needOath()) return;
    hooks = modeHooks || {};
    lastOpts = opts || {};
    var o = Object.assign({}, lastOpts);
    if (save.house !== "misto" && !o.seat) o.house = save.house;
    if (!o.seat && !o.deck && C) o.deck = C.deckForPlay() || undefined;
    match = E.createMatch(o);
    match._t0 = Date.now();
    lastStake = match.stake;
    document.body.setAttribute("data-mode", match.mode);
    show(menu, false);
    show(endSheet, false);
    show(rules, false);
    show(confirmBox, false);
    show(peek, false);
    app.classList.add("playing");
    if (window.SigilLive) {
      window.SigilLive.stopMenu();
      var arena = window.SigilLive.mountArena(o.arena != null ? o.arena : match.seed);
      $("arenaName").textContent = arena ? arena.name : "";
    }
    render();
    tell("start", { mode: match.mode, opts: lastOpts });
    if (match.phase === "reveal") pump();
  }

  function clearMatch() {
    if (timer) clearTimeout(timer);
    timer = null;
    var h = hooks;
    hooks = {};
    if (h.leave) h.leave();
    match = null;
    selected = null;
    document.body.removeAttribute("data-mode");
    app.classList.remove("playing");
    if (window.SigilLive) {
      window.SigilLive.unmountArena();
      window.SigilLive.startMenu();
    }
    show(menu, true);
    show(endSheet, false);
    show(confirmBox, false);
    show(peek, false);
    paintMenu();
    tell("leave");
  }

  function settle(view) {
    if (!match || match._settled || view.phase !== "over") return;
    match._settled = true;
    var delta = 0;
    if (view.winner === "you") {
      delta = view.stake;
      save.wins += 1;
      save.streak += 1;
      save.bestStreak = Math.max(save.bestStreak, save.streak);
      save.bestStake = Math.max(save.bestStake, view.stake);
      blip("win");
    } else if (view.winner === "rival") {
      delta = -view.stake;
      save.losses += 1;
      save.streak = 0;
      blip("lose");
    } else {
      save.ties += 1;
      save.streak = 0;
    }
    // Nel Duello il pegno pesa sul punteggio in classifica, non sui pegni.
    if (match.mode !== "pvp") save.gettoni = Math.max(0, save.gettoni + delta);
    var C = window.SigilCollezione;
    if (C) C.beginSettle();
    if (hooks.settle) hooks.settle(view, save);
    if (C) C.onSettle(view, match.mode);
    if (view.daily && view.date) {
      var rank = view.winner === "you" ? 100 + view.stake : view.winner === "tie" ? 50 : 10;
      var prev = save.daily[view.date];
      if (!prev || rank > prev.rank) save.daily[view.date] = { rank: rank, stake: view.stake, winner: view.winner };
    }
    saveSave();
  }

  function render() {
    if (!match) return;
    var view = E.view(match);
    if (view.stake > lastStake) {
      app.classList.add("snapped");
      blip("snap");
      setTimeout(function () { app.classList.remove("snapped"); }, 600);
    }
    lastStake = view.stake;
    settle(view);

    renderTop(view);
    renderBoard(view);
    renderHand(view);
    renderSide(view);

    bindArt(app);
    // Fine della veglia: prima si lascia vedere il tavolo com'è finito, poi arriva il cartiglio.
    // «Analizza il risultato» lo chiude e lascia il tavolo da esplorare con calma.
    var over = view.phase === "over";
    if (over && !endAt) {
      tell("over", { winner: view.winner, mode: match.mode, opts: lastOpts });
      endAt = Date.now() + (reduced() ? 0 : END_PAUSE);
      setTimeout(function () { if (match && match.phase === "over") render(); }, Math.max(0, endAt - Date.now()) + 20);
    }
    var endNow = over && Date.now() >= endAt;
    show(endSheet, endNow && !reviewing);
    show(reviewBar, over && reviewing);
    app.classList.toggle("reviewing", over && reviewing);
    if (over) fillEnd(view);
  }
  var END_PAUSE = 1800;
  var endAt = 0;
  var reviewing = false;
  var reviewBar = document.createElement("div");
  reviewBar.className = "review-bar";
  reviewBar.hidden = true;
  reviewBar.innerHTML = '<span class="review-note">La veglia è finita. Tocca carte e rovine per rileggerla.</span>' +
    '<button type="button" class="button primary" id="reviewBack">Torna al risultato</button>';
  app.appendChild(reviewBar);
  function review(on) {
    reviewing = on;
    if (!on) endAt = Math.min(endAt, Date.now());
    render();
  }

  function renderTop(view) {
    $("hourName").textContent = ORE[view.turn - 1] + " ora";
    var hours = "";
    for (var i = 1; i <= 6; i++) {
      var cls = i < view.turn ? "hour past" : i === view.turn ? "hour now" : "hour";
      if (i === 6) cls += " last";
      hours += '<span class="' + cls + '" title="' + ORE[i - 1] + ' ora"><i></i><small>' + ROMAN[i - 1] + "</small></span>";
    }
    $("hours").innerHTML = hours;
    $("lume").querySelector("b").textContent = String(view.energy);
    $("lumeNext").textContent = view.nextEnergy ? "+" + view.nextEnergy + " dopo" : "";
    $("pegno").querySelector("b").textContent = String(view.stake);
    $("pegno").title = "Il pegno di stanotte: " + view.stake;
  }

  function renderBoard(view) {
    $("rivalSigil").innerHTML = '<use href="#g-' + (view.rivalHouse || "misto") + '"/>';
    $("rivalSigil").setAttribute("data-house", view.rivalHouse || "misto");
    $("youSigil").innerHTML = '<use href="#g-' + (view.house || "misto") + '"/>';
    $("youSigil").setAttribute("data-house", view.house || "misto");
    $("rivalInfo").textContent = (hooks.rivalName ? hooks.rivalName() + " · " : "") + houseName(view.rivalHouse) + " · " + view.rivalHand + (view.rivalHand === 1 ? " carta in mano" : " carte nascoste in mano");
    $("youInfo").textContent = houseName(view.house) + " · " + view.deck + " nel mazzo";
    $("priority").textContent = view.priorityText + (view.rivalSnapped ? " · ha alzato il pegno" : "");

    var hint = view.line;
    if (view.phase === "plan") {
      var staged = view.lanes.some(function (l) { return l.incoming.length; });
      if (selected) hint = "Scegli la rovina che la accoglierà: quelle accese ti attendono.";
      else if (staged) hint = "Si riveleranno nell'ordine in cui le hai deposte.";
      else if (view.turn === 1) hint = "Prendi una carta dalla tua mano, poi deponila su una rovina.";
    } else if (view.phase === "reveal") hint = "Le carte si voltano…";
    $("whisper").textContent = hint;

    var quotes = selected ? E.quote(match, selected) : null;
    var scores = view.lanes.map(function (l) { return [l.rival, l.you]; });
    $("board").setAttribute("data-lanes", String(view.lanes.length));
    $("board").style.setProperty("--lanes", String(view.lanes.length));
    $("board").innerHTML = view.lanes.map(function (lane, index) {
      var legal = quotes && quotes[index].ok;
      var rivals = lane.rivals.map(function (card, n) { return pieceHTML(card, index, n, false); });
      var yours = lane.yours.map(function (card, n) { return pieceHTML(card, index, n, false); })
        .concat(lane.incoming.map(function (card, n) { return pieceHTML(card, index, "g" + n, true); }));
      var bumpR = lastScores && lastScores[index][0] !== lane.rival ? " bump" : "";
      var bumpY = lastScores && lastScores[index][1] !== lane.you ? " bump" : "";
      var cls = "lane" + (legal ? " legal" : quotes ? " illegal" : "") + (lane.closed ? " closed" : "");
      return '<section class="' + cls + '" data-lane="' + index + '" data-act="lane" data-lead="' + lane.lead + '">' +
        slotsHTML(rivals, lane.max, "rival-slots", index) +
        '<div class="plaque" data-act="place" data-lane="' + index + '">' + artImg(lane.id, "place") +
        '<div class="plaque-text"><h3><span class="key">' + "QWERT"[index] + "</span>" + esc(lane.name) + "</h3><p>" + esc(lane.text) + "</p></div>" +
        '<div class="scores"><span class="score rival' + (lane.lead === "rival" ? " ahead" : "") + bumpR + '" title="Ombra">' + lane.rival + "</span>" +
        '<span class="score you' + (lane.lead === "you" ? " ahead" : "") + bumpY + '" title="Custode">' + lane.you + "</span></div>" +
        (legal ? '<em class="cost-hint">costa ' + quotes[index].paid + "</em>" : "") +
        "</div>" +
        slotsHTML(yours, lane.max, "you-slots", index) +
        "</section>";
    }).join("");
    lastScores = scores;
  }

  function renderHand(view) {
    var hand = $("hand");
    if (!view.hand.length) {
      hand.innerHTML = '<p class="empty">Le tue mani sono vuote. Attendi il prossimo rintocco.</p>';
    } else {
      var n = view.hand.length;
      hand.innerHTML = view.hand.map(function (card, index) {
        var q = view.phase === "plan" ? E.quote(match, card.uid) : null;
        var can = q && q.some(function (x) { return x.ok; });
        var held = match.you.hand[index] && match.you.hand[index].hold;
        var tilt = n > 1 ? (index - (n - 1) / 2) * 1.6 : 0;
        var cls = (card.uid === selected ? "selected" : "") + (can ? "" : " cant") + (held ? " held" : "") + changed(card);
        return cardHTML(card, {
          tag: "button",
          power: card.current,
          cls: cls.trim(),
          attrs: ' data-act="hand" data-uid="' + esc(card.uid) + '" style="--tilt:' + tilt.toFixed(2) + 'deg" aria-label="' + esc(card.name + ", costo " + card.cost + ", potenza " + card.power) + '"'
        });
      }).join("");
    }
    var staged = view.lanes.some(function (l) { return l.incoming.length; });
    $("undoButton").hidden = !(view.phase === "plan" && staged);
  }

  // Carte in mano toccate da Cronista, Bambola di pezza, Chiavi: i numeri cambiano colore.
  function changed(card) {
    var out = "";
    if (card.baseCost != null && card.cost < card.baseCost) out += " cheaper";
    if (card.current != null && !card.revealed) {
      if (card.current > card.power) out += " buffed";
      else if (card.current < card.power) out += " nerfed";
    }
    return out;
  }

  function findShown(view, uid) {
    if (!uid) return null;
    var found = null;
    view.hand.forEach(function (card) { if (card.uid === uid) found = card; });
    view.lanes.forEach(function (lane) {
      lane.yours.concat(lane.incoming, lane.rivals).forEach(function (card) {
        if (!card.hidden && card.uid === uid) found = card;
      });
    });
    return found;
  }

  function inspectHTML(shown, wide) {
    var onBoard = shown.revealed && shown.current != null;
    var html = cardHTML(shown, { power: onBoard ? shown.current : shown.power });
    if (shown.text) html += '<p class="lore-line">' + esc(shown.lore) + "</p>";
    if (onBoard && shown.current !== shown.power) {
      var d = shown.current - shown.power;
      html += '<p class="math">Base <b>' + shown.power + "</b> · qui " + (d > 0 ? "+" : "−") + Math.abs(d) + " · ora vale <b>" + shown.current + "</b></p>";
    } else if (shown.incoming) {
      html += '<p class="math">Ancora coperta. Si volterà allo scoccare dell\'ora.</p>';
    }
    return html;
  }

  function placeHTML(view, i) {
    var lane = view.lanes[i];
    return '<p class="eyebrow">Rovina ' + ["prima", "seconda", "terza"][i] + "</p>" +
      '<p class="place-name">' + esc(lane.name) + "</p>" +
      '<p class="place-rule">' + esc(lane.text) + "</p>" +
      '<p class="lore-line" style="text-align:left">' + esc(lane.lore) + "</p>" +
      '<p class="math" style="text-align:left">Custode <b>' + lane.you + "</b> · Ombra <b>" + lane.rival + "</b>" + (lane.closed ? " · il ponte è alzato" : "") + "</p>";
  }

  function renderSide(view) {
    var box = $("inspector");
    var shown = findShown(view, detailId || selected);
    if (shown) {
      box.innerHTML = inspectHTML(shown);
    } else if (laneInfo != null) {
      box.innerHTML = placeHTML(view, laneInfo);
    } else {
      box.innerHTML = '<p class="eyebrow">Questa notte</p><p class="empty-hint">Sfiora una carta o una rovina, e il grimorio te ne racconterà la storia.</p>' +
        '<div class="houses-line"><span data-house="' + esc(view.house || "misto") + '">' + glyph(view.house) + "Tu servi " + (view.house ? "la casata " + esc(houseName(view.house)) : "tutte le casate") + "</span>" +
        '<span data-house="' + esc(view.rivalHouse || "misto") + '">' + glyph(view.rivalHouse) + "L'Ombra veste " + (view.rivalHouse ? "la casata " + esc(houseName(view.rivalHouse)) : "i tuoi stessi colori") + "</span></div>";
    }
    $("chronicle").innerHTML = view.feed.map(function (line) { return "<li>" + esc(line) + "</li>"; }).join("");
    var log = $("chronicle");
    log.scrollTop = log.scrollHeight;

    $("retreatButton").disabled = !view.canRetreat;
    var snap = $("snapButton");
    snap.disabled = !view.canSnap;
    snap.querySelector("span").textContent = view.youSnapped ? "Pegno alzato" : "Alza il pegno ×" + Math.min(8, view.stake * 2);
    var end = $("endButton");
    end.disabled = view.phase !== "plan" && view.phase !== "reveal";
    var staged = view.lanes.some(function (l) { return l.incoming.length; });
    end.classList.toggle("ready", view.phase === "plan" && staged);
    if (view.revealing) end.textContent = "Affretta ›";
    else if (staged) end.textContent = view.turn === 6 ? "Rivela e chiudi" : "Rivela";
    else end.textContent = "Lascia scorrere l'ora";
    // Duello: mentre aspetti l'avversario il tavolo è bloccato.
    var st = hooks.status ? hooks.status(view) : null;
    if (st && st.waiting) {
      end.disabled = true;
      end.classList.remove("ready");
      end.textContent = st.label || "In attesa…";
      snap.disabled = true;
      $("retreatButton").disabled = true;
    }
    if (st && st.whisper) $("whisper").textContent = st.whisper;
  }

  function fillEnd(view) {
    var card = endSheet.querySelector(".end-card");
    card.classList.toggle("lost", view.winner === "rival");
    card.classList.toggle("tie", view.winner === "tie");
    $("endTitle").textContent = view.headline;
    $("endEyebrow").textContent = view.daily ? "La veglia del " + pretty(view.date) : view.reason === "ritiro" ? "Prima della campana" : "La sesta campana";
    var sub;
    if (view.reason === "ritiro") sub = view.retreated === "you" ? "Il pegno resta all'Ombra, e la valle resta al buio." : "Non ha osato attendere la sesta ora.";
    else if (view.winner === "you") sub = "Tieni " + view.youLanes + (view.youLanes === 1 ? " rovina" : " rovine") + " contro " + view.rivalLanes + ". Il Dormiente si rigira nel sonno, ma non si sveglia.";
    else if (view.winner === "rival") sub = "L'Ombra tiene " + view.rivalLanes + (view.rivalLanes === 1 ? " rovina" : " rovine") + " contro " + view.youLanes + ". Sotto la valle, qualcosa apre gli occhi.";
    else sub = "Nessuno prevale. Il Sigillo scricchiola, ma resta."
    $("endSub").textContent = sub;
    $("endLanes").innerHTML = view.lanes.map(function (lane) {
      var mark = lane.lead === "you" ? "◆" : lane.lead === "rival" ? "◇" : "·";
      return '<li class="' + lane.lead + '"><span class="mark">' + mark + "</span><b>" + esc(lane.name) + "</b><span>" + lane.you + " – " + lane.rival + "</span></li>";
    }).join("");
    var delta = view.winner === "you" ? '<span class="plus">+' + view.stake + "</span>" : view.winner === "rival" ? '<span class="minus">−' + view.stake + "</span>" : "0";
    $("endStake").innerHTML = match && match.mode === "pvp" ? "Pegno ×" + view.stake + " · pesa sul tuo punteggio da duellante"
      : "Pegno ×" + view.stake + " · " + delta + " · ne custodisci " + save.gettoni;
    $("copyButton").textContent = "Copia la cronaca";
    $("againButton").textContent = "Veglia ancora";
    $("againButton").disabled = false;
    var extra = $("endExtra");
    if (extra) extra.innerHTML = "";
    var parts = { title: $("endTitle"), sub: $("endSub"), eyebrow: $("endEyebrow"), stake: $("endStake"), again: $("againButton"), extra: extra };
    if (hooks.fillEnd) hooks.fillEnd(view, parts);
    if (window.SigilCollezione) window.SigilCollezione.fillEnd(view, parts);
  }

  /* ───────── flusso dell'ora ───────── */
  function pump() {
    render();
    if (!match || match.phase !== "reveal") return;
    timer = setTimeout(function () {
      E.step(match);
      blip("flip");
      pump();
    }, reduced() ? 80 : 620);
  }
  function skip() {
    if (!match || match.phase !== "reveal") return;
    if (timer) clearTimeout(timer);
    timer = null;
    while (match.phase === "reveal") E.step(match);
    render();
  }
  function commit() {
    if (!match) return;
    if (match.phase === "reveal") return skip();
    if (match.phase !== "plan") return;
    selected = null;
    detailId = null;
    laneInfo = null;
    if (hooks.commit) { blip("play"); hooks.commit(match); render(); return; }
    E.endTurn(match);
    blip("play");
    pump();
  }
  function say(text) {
    var log = $("chronicle");
    var li = document.createElement("li");
    li.textContent = text;
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
    $("whisper").textContent = text;
  }
  function locked() {
    var st = hooks.status && match ? hooks.status(E.view(match)) : null;
    return !!(st && st.waiting);
  }
  function onPlay(uid, lane) {
    if (!match || match.phase !== "plan" || locked()) return;
    var result = E.play(match, uid, lane);
    if (!result.ok) {
      say(result.message);
      blip("no");
      return;
    }
    selected = null;
    detailId = null;
    blip("play");
    render();
  }

  function askRetreat() {
    if (!match || match.phase !== "plan") return;
    var view = E.view(match);
    $("confirmText").textContent = "Se abbandoni la veglia l'Ombra prende " + view.stake + (view.stake === 1 ? " pegno." : " pegni.") + " Se resti, rischi tutto ciò che è sul tavolo fino alla sesta campana.";
    show(confirmBox, true);
  }
  function doRetreat() {
    show(confirmBox, false);
    if (!match || match.phase !== "plan") return;
    E.retreat(match);
    if (hooks.retreat) hooks.retreat(match);
    render();
  }
  function doSnap() {
    if (!match || match.phase !== "plan") return;
    var result = E.snap(match);
    if (!result.ok) { say(result.message); return; }
    if (hooks.snap) hooks.snap(match);
    render();
  }

  /* ───────── condivisione ───────── */
  function copyResult() {
    if (!match) return;
    var text = E.shareText(match);
    var done = function () { $("copyButton").textContent = "Copiata"; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { window.prompt("Copia la cronaca:", text); });
    } else window.prompt("Copia la cronaca:", text);
  }
  function postcard() {
    if (!match) return;
    var view = E.view(match);
    var canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1200;
    var g = canvas.getContext("2d");
    var bg = g.createRadialGradient(450, 0, 50, 450, 300, 900);
    bg.addColorStop(0, "#2a2216");
    bg.addColorStop(1, "#0b0a0e");
    g.fillStyle = bg;
    g.fillRect(0, 0, 900, 1200);
    g.strokeStyle = "#d9ab5b";
    g.lineWidth = 2;
    g.strokeRect(36, 36, 828, 1128);
    g.textAlign = "center";
    g.fillStyle = "#d9ab5b";
    g.font = "600 30px Cinzel, Georgia, serif";
    g.fillText("S I G I L", 450, 130);
    g.fillStyle = "#a99f8c";
    g.font = "italic 26px 'Cormorant Garamond', Georgia, serif";
    g.fillText(view.daily ? "La veglia del " + pretty(view.date) : "Seme " + view.seed, 450, 172);
    var won = view.winner === "you";
    g.save();
    g.translate(450, 330);
    g.strokeStyle = won ? "#f2d08a" : view.winner === "rival" ? "#a593ff" : "#a99f8c";
    g.lineWidth = 4;
    g.beginPath(); g.arc(0, 0, 90, 0, Math.PI * 2); g.stroke();
    g.setLineDash([6, 9]);
    g.beginPath(); g.arc(0, 0, 68, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.fillStyle = g.strokeStyle;
    g.beginPath(); g.moveTo(0, -46); g.lineTo(26, 0); g.lineTo(0, 46); g.lineTo(-26, 0); g.closePath(); g.fill();
    g.restore();
    g.fillStyle = "#efe4cd";
    g.font = "700 56px Cinzel, Georgia, serif";
    g.fillText(view.headline, 450, 540);
    g.textAlign = "left";
    view.lanes.forEach(function (lane, i) {
      var y = 660 + i * 110;
      g.fillStyle = lane.lead === "you" ? "#ebc576" : lane.lead === "rival" ? "#a593ff" : "#a99f8c";
      g.font = "600 34px Cinzel, Georgia, serif";
      g.fillText((lane.lead === "you" ? "◆ " : lane.lead === "rival" ? "◇ " : "· ") + lane.name, 110, y);
      g.textAlign = "right";
      g.fillStyle = "#efe4cd";
      g.fillText(lane.you + " – " + lane.rival, 790, y);
      g.textAlign = "left";
    });
    g.textAlign = "center";
    g.fillStyle = "#d9ab5b";
    g.font = "26px Cinzel, Georgia, serif";
    g.fillText("Pegno ×" + view.stake + "   ·   " + houseName(view.house) + " contro " + houseName(view.rivalHouse), 450, 1050);
    g.fillStyle = "#a99f8c";
    g.font = "italic 26px 'Cormorant Garamond', Georgia, serif";
    g.fillText("Sei ore. Tre rovine. Una sola Ombra.", 450, 1100);
    var link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "sigil-" + view.seed + ".png";
    link.click();
  }

  /* ───────── grimorio ───────── */
  function openCodex() {
    var box = $("codex");
    var list = [{ id: "tutte", name: "Tutte" }].concat(E.HOUSES);
    $("codexFilters").innerHTML = list.map(function (h) {
      return '<button type="button" class="house-chip" data-house="' + (h.id === "tutte" ? "misto" : h.id) + '" data-filter="' + h.id + '" aria-checked="' + (codexFilter === h.id) + '">' +
        (h.id === "tutte" ? glyph("misto") : glyph(h.id)) + "<span>" + esc(h.name) + "</span></button>";
    }).join("");
    var h = HOUSE[codexFilter];
    var blurb = $("codexBlurb");
    blurb.setAttribute("data-house", h ? h.id : "misto");
    blurb.innerHTML = h ? "<em>" + esc(h.motto) + "</em> " + esc(h.text) : ALL.length + " carte, cinque casate: le " + E.CARDS.length + " del set base e le " + (ALL.length - E.CARDS.length) + " del Risveglio. Il tuo mazzo ne raccoglie dodici.";
    var cards = ALL.filter(function (c) { return codexFilter === "tutte" || c.house === codexFilter; })
      .slice().sort(function (a, b) { return a.cost - b.cost || a.name.localeCompare(b.name); });
    $("codexGrid").innerHTML = cards.map(function (card) {
      var mine = !window.SigilCollezione || !window.SigilCollezione.ready() || window.SigilCollezione.owns(card.id);
      return '<div class="codex-item" data-evo-open="' + esc(card.id) + '">' + cardHTML(card, { cls: mine ? "" : "locked" }) + (mine ? (card.text ? "<p>" + esc(card.lore) + "</p>" : "") : '<p class="locked-label">Non ancora tua</p>') + "</div>";
    }).join("");
    box.removeAttribute("hidden");
    bindArt(box);
  }

  /* ───────── dettaglio su telefono ───────── */
  function openPeek(html) {
    peek.innerHTML = '<div class="peek-body">' + html + "</div>";
    peek.dataset.uid = "";
    show(peek, true);
    bindArt(peek);
  }

  // La carta della mano, grande, con le rovine su cui si può deporre.
  function openPlay(uid) {
    var view = E.view(match);
    var card = view.hand.filter(function (c) { return c.uid === uid; })[0];
    if (!card) return;
    var held = match.you.hand.some(function (c) { return c.uid === uid && c.hold; });
    var quotes = E.quote(match, uid);
    var html = '<div class="play-sheet">' + cardHTML(card, { cls: "play-card" + changed(card), power: card.current });
    if (card.text && card.lore) html += '<p class="lore-line">' + esc(card.lore) + "</p>";
    if (view.phase !== "plan" || locked()) {
      html += '<p class="play-ask">Aspetta: le carte si stanno voltando.</p>';
    } else if (held) {
      html += '<p class="play-ask">Questa carta si potrà giocare dall’ora dopo.</p>';
    } else {
      html += '<p class="play-ask">Dove la deponi?</p><div class="play-lanes" style="--n:' + Math.min(3, view.lanes.length) + '">' +
        view.lanes.map(function (lane, i) {
          var q = quotes[i];
          var used = lane.yours.length + lane.incoming.length;
          var why = q.ok ? "costa " + q.paid
            : lane.closed ? "chiusa"
            : used >= lane.max ? "piena"
            : "servono " + q.paid + (q.paid === 1 ? " lume" : " lumi");
          return '<button type="button" class="play-lane' + (q.ok ? "" : " no") + '" data-play-lane="' + i + '"' + (q.ok ? "" : " disabled") + ">" +
            '<span class="pl-name">' + esc(lane.name) + '</span><span class="pl-cost">' + esc(why) + "</span></button>";
        }).join("") + "</div>";
    }
    html += '<button type="button" class="text-button play-cancel" data-play-cancel="1">Rimettila in mano</button></div>';
    peek.innerHTML = html;
    peek.dataset.uid = uid;
    show(peek, true);
    bindArt(peek);
    if (window.SigilEvo) window.SigilEvo.upgrade(peek.querySelector(".play-card"), card, { power: card.current });
  }

  /* ───────── eventi ───────── */
  $("playButton").addEventListener("click", function () { start({}); });
  $("dailyButton").addEventListener("click", function () { start({ daily: true, date: E.todayKey() }); });
  $("seedForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var input = $("seedInput");
    var n = Number(String(input.value).replace(/[^\d]/g, ""));
    if (!isFinite(n) || String(input.value).trim() === "") { input.classList.add("bad"); return; }
    input.classList.remove("bad");
    start({ seed: n >>> 0 });
  });
  if ($("housePicker")) $("housePicker").addEventListener("click", function (event) {
    var b = event.target.closest("[data-pick]");
    if (!b) return;
    save.house = b.dataset.pick;
    saveSave();
    paintMenu();
  });
  $("againButton").addEventListener("click", function () {
    if (hooks.again) { hooks.again(); return; }
    var o = Object.assign({}, lastOpts || {});
    if (!o.daily) delete o.seed;
    start(o);
  });
  $("analyzeButton").addEventListener("click", function () { review(true); });
  reviewBar.addEventListener("click", function (e) {
    if (e.target.closest("#reviewBack")) review(false);
  });
  $("endMenuButton").addEventListener("click", function () {
    if (hooks.back) { var b = hooks.back; clearMatch(); b(); return; }
    clearMatch();
  });
  $("leaveButton").addEventListener("click", function () {
    var pvp = match && match.mode === "pvp" && match.phase !== "over";
    if (match && match.phase !== "over" && !window.confirm(pvp ? "Lasciare il duello? Conta come resa." : "Tornare alla soglia? La veglia in corso si spegnerà senza esito.")) return;
    if (pvp && match.phase === "plan") { E.retreat(match); if (hooks.retreat) hooks.retreat(match); }
    if (hooks.back) { var b = hooks.back; clearMatch(); b(); return; }
    clearMatch();
  });
  $("copyButton").addEventListener("click", copyResult);
  $("cardButton").addEventListener("click", postcard);
  $("endButton").addEventListener("click", commit);
  $("undoButton").addEventListener("click", function () { if (match && !locked()) { E.undo(match); render(); } });
  $("retreatButton").addEventListener("click", askRetreat);
  $("confirmStay").addEventListener("click", function () { show(confirmBox, false); });
  $("confirmLeave").addEventListener("click", doRetreat);
  $("snapButton").addEventListener("click", doSnap);
  $("helpButton").addEventListener("click", function () { show(rules, true); });
  $("rulesFromMenu").addEventListener("click", function () { show(rules, true); });
  $("closeRules").addEventListener("click", function () { show(rules, false); });
  $("codexButton").addEventListener("click", openCodex);
  $("closeCodex").addEventListener("click", function () { $("codex").setAttribute("hidden", ""); });
  $("codexFilters").addEventListener("click", function (event) {
    var b = event.target.closest("[data-filter]");
    if (!b) return;
    codexFilter = b.dataset.filter;
    openCodex();
  });
  $("soundButton").addEventListener("click", function () { if (window.SigilImpostazioni) window.SigilImpostazioni.open(); });
  peek.addEventListener("click", function (event) {
    var lane = event.target.closest("[data-play-lane]");
    if (lane) {
      show(peek, false);
      onPlay(peek.dataset.uid, Number(lane.dataset.playLane));
      return;
    }
    if (event.target.closest("[data-play-cancel]")) {
      selected = null;
      detailId = null;
      show(peek, false);
      render();
      return;
    }
    show(peek, false); // toccare fuori chiude: la carta resta scelta e si può toccare una rovina
  });

  // App installata su un telefono: si gioca in verticale. Android la blocca davvero;
  // su iPhone (che non lo permette) e nel browser lo dice la scritta «Gira il telefono».
  // Il Fold aperto e i tablet restano liberi di girare.
  function lockPortrait() {
    try {
      var o = screen.orientation;
      if (!o || !o.lock || !window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches) return;
      if (Math.min(screen.width, screen.height) < 520) o.lock("portrait").catch(function () {});
      else if (o.unlock) o.unlock();
    } catch (e) { /* non supportato */ }
  }
  lockPortrait();
  window.addEventListener("resize", lockPortrait);

  /* ───────── trascinare una carta sulla rovina (come su Snap) ─────────
   * Dito o mouse: si prende la carta dalla mano, si porta sopra una rovina e si
   * lascia. Le rovine dove può andare si accendono; quella sotto il dito brilla.
   * Un tocco senza trascinare resta un tocco (apre la carta o la sceglie). */
  var drag = null;
  var eatClick = false;
  function laneAt(x, y) {
    var el = document.elementFromPoint(x, y);
    var lane = el && el.closest ? el.closest("#board .lane") : null;
    return lane ? Number(lane.dataset.lane) : null;
  }
  function dragEnd(play) {
    if (!drag) return;
    var d = drag;
    drag = null;
    if (d.layer) d.layer.remove();
    d.el.classList.remove("dragging");
    document.documentElement.classList.remove("drag-on");
    Array.prototype.forEach.call(document.querySelectorAll("#board .lane"), function (l) {
      l.classList.remove("drag-ok", "drag-no", "drop-target");
    });
    if (!d.moving) return;
    eatClick = true;
    setTimeout(function () { eatClick = false; }, 0);
    if (play && d.over != null && d.quotes[d.over] && d.quotes[d.over].ok) {
      selected = null;
      onPlay(d.uid, d.over);
    } else {
      if (play && d.over != null) { blip("no"); say("Lì non può andare."); }
      render();
    }
  }
  $("hand").addEventListener("pointerdown", function (event) {
    var card = event.target.closest(".card[data-act='hand']");
    if (!card || !match || match.phase !== "plan" || locked() || event.button > 0) return;
    if (card.classList.contains("held")) return;
    drag = { uid: card.dataset.uid, el: card, x: event.clientX, y: event.clientY, id: event.pointerId, moving: false, over: null, ghost: null, quotes: E.quote(match, card.dataset.uid) };
    try { card.setPointerCapture(event.pointerId); } catch (e) { /* ignora */ }
  });
  window.addEventListener("pointermove", function (event) {
    if (!drag || event.pointerId !== drag.id) return;
    var dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moving) {
      if (dx * dx + dy * dy < 100) return;
      drag.moving = true;
      show(peek, false);
      var r = drag.el.getBoundingClientRect();
      var ghost = drag.el.cloneNode(true);
      ghost.classList.add("drag-ghost");
      ghost.classList.remove("selected");
      ghost.removeAttribute("data-act");
      ghost.style.width = r.width + "px";
      ghost.style.height = r.height + "px";
      drag.w = r.width;
      drag.h = r.height;
      drag.ghost = ghost;
      // Il fantasma sta in un contenitore con la classe della mano, così ha lo stesso aspetto.
      var layer = document.createElement("div");
      layer.className = "hand drag-layer";
      layer.appendChild(ghost);
      document.body.appendChild(layer);
      drag.layer = layer;
      drag.el.classList.add("dragging");
      document.documentElement.classList.add("drag-on");
      Array.prototype.forEach.call(document.querySelectorAll("#board .lane"), function (l) {
        var q = drag.quotes[Number(l.dataset.lane)];
        l.classList.add(q && q.ok ? "drag-ok" : "drag-no");
      });
    }
    event.preventDefault();
    // Sopra il dito, così la carta si vede mentre la porti.
    var lift = event.pointerType === "touch" ? drag.h * 0.55 : 0;
    drag.ghost.style.transform = "translate(" + (event.clientX - drag.w / 2) + "px," + (event.clientY - drag.h / 2 - lift) + "px) rotate(" + Math.max(-8, Math.min(8, dx / 30)) + "deg) scale(1.08)";
    var over = laneAt(event.clientX, event.clientY - lift * 0.5);
    if (over !== drag.over) {
      drag.over = over;
      Array.prototype.forEach.call(document.querySelectorAll("#board .lane"), function (l) {
        l.classList.toggle("drop-target", Number(l.dataset.lane) === over);
      });
    }
  });
  window.addEventListener("pointerup", function (event) {
    if (drag && event.pointerId === drag.id) dragEnd(true);
  });
  window.addEventListener("pointercancel", function () { dragEnd(false); });
  // Il trascinamento finito non deve diventare anche un tocco.
  app.addEventListener("click", function (event) {
    if (eatClick) { event.stopPropagation(); event.preventDefault(); eatClick = false; }
  }, true);

  app.addEventListener("click", function (event) {
    var act = event.target.closest("[data-act]");
    if (!act || !match) return;
    var kind = act.dataset.act;
    if (kind === "hand") {
      if (snapMode.matches) {
        selected = act.dataset.uid;
        detailId = selected;
        laneInfo = null;
        render();
        openPlay(selected);
        return;
      }
      selected = selected === act.dataset.uid ? null : act.dataset.uid;
      detailId = selected;
      laneInfo = null;
      render();
      return;
    }
    if (kind === "unstage") {
      event.stopPropagation();
      if (!locked()) E.unstage(match, act.dataset.uid);
      render();
      return;
    }
    if (kind === "detail") {
      event.stopPropagation();
      if (selected) {
        var lane0 = act.closest(".lane");
        if (lane0) { onPlay(selected, Number(lane0.dataset.lane)); return; }
      }
      detailId = act.dataset.uid;
      laneInfo = null;
      if (narrow.matches) {
        var shown = findShown(E.view(match), detailId);
        if (shown) {
          openPeek(inspectHTML(shown));
          if (shown.owner === "you" && window.SigilEvo) window.SigilEvo.upgrade(peek.querySelector(".peek-body .card"), shown, { power: shown.revealed && shown.current != null ? shown.current : shown.power });
        }
      }
      render();
      return;
    }
    if (kind === "place" || kind === "lane") {
      var lane = kind === "place" ? Number(act.dataset.lane) : Number(act.dataset.lane);
      if (selected) {
        event.stopPropagation();
        onPlay(selected, lane);
        return;
      }
      event.stopPropagation();
      laneInfo = lane;
      detailId = null;
      if (narrow.matches) openPeek('<div class="place-card">' + placeHTML(E.view(match), lane) + "</div>");
      render();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.target && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")) return;
    if (event.key === "Escape") {
      show(rules, false);
      show(confirmBox, false);
      show(peek, false);
      $("codex").setAttribute("hidden", "");
      if (match) { selected = null; detailId = null; laneInfo = null; render(); }
      return;
    }
    if (!match || !menu.hasAttribute("hidden")) return;
    if (event.key === "Enter") { event.preventDefault(); commit(); return; }
    if (event.key === "Backspace") { if (!locked()) E.undo(match); render(); return; }
    if (event.key === "p" || event.key === "P") { doSnap(); return; }
    var view = E.view(match);
    var digit = Number(event.key);
    if (digit >= 1 && digit <= view.hand.length) {
      selected = view.hand[digit - 1].uid;
      detailId = selected;
      laneInfo = null;
      render();
      return;
    }
    var lane = { q: 0, w: 1, e: 2, r: 3, t: 4, Q: 0, W: 1, E: 2, R: 3, T: 4 }[event.key];
    if (lane != null && selected) onPlay(selected, lane);
  });

  // Le modalità (viaggio.js, duello.js) usano questo ponte.
  window.SigilGame = {
    start: start,
    commit: commit,
    render: render,
    pump: pump,
    clearMatch: clearMatch,
    say: say,
    blip: blip,
    setSound: setSound,
    match: function () { return match; },
    save: function () { return save; },
    persist: saveSave,
    showMenu: function (on) { show(menu, on); if (on) paintMenu(); },
    esc: esc,
    glyph: glyph,
    houseName: houseName,
    cardHTML: cardHTML,
    bindArt: bindArt
  };

  setSound(save.sound !== false);
  paintMenu();
  if (window.SigilLive) {
    window.SigilLive.startMenu();
    // Dopo l'intro, al primo avvio, si giura fedeltà a una casata.
    window.SigilLive.playIntro(function () {
      setTimeout(function () { if (window.SigilCollezione) window.SigilCollezione.needOath(); }, 0);
    });
  }
})();
