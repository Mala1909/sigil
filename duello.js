"use strict";

/*
 * SIGIL — Duello tra Custodi (PvP), con PeerJS.
 *
 * PeerJS usa il suo server pubblico solo per far incontrare i due browser,
 * poi parlano direttamente.
 *
 * Partita rapida: dieci "sedie" in coda (sigil2-q-1 … q-10). Se una sedia è
 * libera la occupi e aspetti; se è occupata ti siedi di fronte a chi aspetta.
 * Stanza: l'host apre sigil2-r-CODICE, l'amico entra con il codice.
 *
 * Ogni ora: ciascuno sceglie in segreto e preme Rivela. Le giocate viaggiano
 * come [{uid, location}]; quando ci sono entrambe, i due computer risolvono
 * la stessa ora allo stesso modo (stesso seme, stesse regole).
 *
 * Messaggi numerati: ognuno tiene la lista di ciò che ha mandato. Se il filo
 * si spezza, l'ospite richiama l'host per 30 secondi; ritrovati, ciascuno
 * dice "ho ricevuto fino al numero N" e l'altro rimanda il resto.
 *
 * Esito: se entrambi sono nel registro online (cloud.js), ognuno dichiara il
 * risultato al server, che lo conta solo se le due versioni coincidono.
 */
(function () {
  var E = window.Lume;
  var G = window.SigilGame;
  if (!E || !G) return;

  var PROTO = 4; // 4: carte diversificate e casate ribilanciate (15 nov) — telefoni con regole diverse non si siedono insieme
  var PREFIX = "sigil" + PROTO + "-";
  var SLOTS = 10;
  var TURN_SECONDS = 75;
  var GRACE_SECONDS = 30;
  var PEER_JS = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";

  var peer = null;      // il mio peer
  var conn = null;      // la connessione con l'avversario
  var role = null;      // "host" | "guest"
  var busy = false;     // sto già giocando
  var game = null;      // stato del duello in corso
  var opp = null;       // chi siede di fronte: { name, uid, house, deck, rating }
  var searching = false;
  var tick = null;
  var redial = null;

  function Cloud() { return window.SigilCloud && window.SigilCloud.online() ? window.SigilCloud : null; }

  /* ───────── interfaccia ───────── */
  var sheet = document.createElement("section");
  sheet.className = "sheet duel-sheet";
  sheet.id = "duel";
  sheet.hidden = true;
  sheet.innerHTML =
    '<div class="duel-inner">' +
      '<header class="journey-head"><button type="button" class="icon-button" id="duelBack" aria-label="Torna alla soglia">←</button>' +
      '<div><p class="eyebrow">Duello tra Custodi</p><h2>Siediti al tavolo</h2></div></header>' +
      '<p class="duel-lore">Ogni Custode crede che l\'Ombra sia la propria. Stanotte, di fronte a te, siede un altro Custode, e tu sei la sua Ombra. Tre rovine, sei ore, nessuna pietà.</p>' +
      '<form class="duel-name" id="duelNameForm" autocomplete="off"><label for="duelName">Il nome con cui siedi al tavolo</label>' +
      '<div class="seed-row"><input id="duelName" maxlength="20" placeholder="Custode"><button class="button ghost tiny" type="submit">Salva</button></div></form>' +
      '<div class="duel-actions" id="duelActions">' +
        '<button type="button" class="button primary" id="duelQuick">Partita rapida</button>' +
        '<button type="button" class="button ghost" id="duelCreate">Apri una stanza per un amico</button>' +
        '<form class="seed-form" id="duelJoinForm" autocomplete="off"><label for="duelCode">Entra nella stanza di un amico</label>' +
        '<div class="seed-row"><input id="duelCode" maxlength="4" placeholder="codice di 4 lettere" autocapitalize="characters"><button class="button ghost tiny" type="submit">Entra</button></div></form>' +
      "</div>" +
      '<div class="duel-wait" id="duelWait" hidden>' +
        '<svg class="duel-sigil"><use href="#g-sigillo"/></svg>' +
        '<p class="duel-status" id="duelStatus">Cerco un altro Custode…</p>' +
        '<p class="duel-code" id="duelCodeShow" hidden></p>' +
        '<button type="button" class="button ghost" id="duelCancel">Annulla</button>' +
      "</div>" +
      '<p class="duel-record" id="duelRecord"></p>' +
      '<section class="duel-board" id="duelBoard"></section>' +
      '<p class="duel-note">La connessione passa per PeerJS (gratuito): i due browser parlano direttamente. Punteggio e classifica sono nel registro dei Custodi.</p>' +
    "</div>";
  document.body.appendChild(sheet);
  var $ = function (id) { return document.getElementById(id); };

  function record() {
    var s = G.save();
    if (!s.pvp) s.pvp = { w: 0, l: 0, t: 0 };
    return s.pvp;
  }
  /* ───────── la classificata: i ranghi del Duello ─────────
   * Valgono solo tra Custodi (il Viaggio ha i suoi premi). Vengono dal punteggio
   * che il registro calcola dopo ogni duello confermato da entrambi (Elo, si parte da 1000):
   * si sale vincendo, si scende perdendo. Ogni rango ha tre divisioni (III → I). */
  var TIERS = [
    { min: -Infinity, max: 900, name: "Cenere" },
    { min: 900, max: 1000, name: "Brace" },
    { min: 1000, max: 1100, name: "Candela" },
    { min: 1100, max: 1200, name: "Lanterna" },
    { min: 1200, max: 1350, name: "Faro" },
    { min: 1350, max: Infinity, name: "Sigillo" }
  ];
  function rank(rating) {
    var p = rating == null ? 1000 : rating;
    var i = 0;
    while (i < TIERS.length - 1 && p >= TIERS[i + 1].min) i++;
    var t = TIERS[i];
    var r = { tier: i, name: t.name, label: t.name, div: 0, toNext: null, pct: 100, nextLabel: null };
    if (isFinite(t.min) && isFinite(t.max)) {
      var step = (t.max - t.min) / 3;
      var k = Math.min(2, Math.floor((p - t.min) / step)); // 0 = III, 1 = II, 2 = I
      r.div = 3 - k;
      r.label = t.name + " " + ["III", "II", "I"][k];
      var nextAt = t.min + step * (k + 1);
      r.toNext = Math.ceil(nextAt - p);
      r.pct = Math.round(((p - (t.min + step * k)) / step) * 100);
      r.nextLabel = k < 2 ? t.name + " " + ["III", "II", "I"][k + 1] : TIERS[i + 1].name + (isFinite(TIERS[i + 1].max) ? " III" : "");
    } else if (!isFinite(t.min)) {
      r.toNext = Math.ceil(t.max - p);
      r.pct = Math.max(0, Math.round(100 - (t.max - p)));
      r.nextLabel = TIERS[1].name + " III";
    }
    return r;
  }
  function rankBadge(rating, small) {
    var r = rank(rating);
    return '<span class="rank-badge rank-' + r.tier + (small ? " small" : "") + '"><svg aria-hidden="true"><use href="#g-sigillo"/></svg>' + G.esc(r.label) + "</span>";
  }
  function paintRecord() {
    var r = record();
    var played = r.w + r.l + r.t;
    var rk = rank(r.rating);
    $("duelRecord").innerHTML =
      '<span class="rank-line">' + rankBadge(r.rating) +
        (r.rating ? '<span class="rank-points">' + r.rating + " punti</span>" : "") + "</span>" +
      '<span class="rank-bar"><i style="width:' + rk.pct + '%"></i></span>' +
      '<span class="rank-next">' + (rk.nextLabel ? "Mancano " + rk.toNext + " punti a " + G.esc(rk.nextLabel) : "Il rango più alto: sei tra i guardiani del Sigillo.") + "</span>" +
      '<span class="rank-games">' + (played ? "I tuoi duelli: " + r.w + " vinti · " + r.l + " persi · " + r.t + " pari" : "Nessun duello ancora: ogni Custode parte da Candela III.") + "</span>";
  }
  function paintBoard() {
    var box = $("duelBoard");
    var c = Cloud();
    if (!c) { box.innerHTML = '<p class="end-note">La classifica appare quando il registro dei Custodi risponde.</p>'; return; }
    box.innerHTML = '<p class="label">I Custodi più temuti</p><p class="end-note">Apro il registro…</p>';
    c.leaderboard().then(function (rows) {
      if (!rows || !rows.length) { box.innerHTML = '<p class="label">I Custodi più temuti</p><p class="end-note">Nessun duello annotato finora. Il primo nome sarà il tuo.</p>'; return; }
      box.innerHTML = '<p class="label">La classificata dei Custodi</p><table><thead><tr><th></th><th>Custode</th><th>Rango</th><th>V</th><th>P</th><th style="text-align:right">Punti</th></tr></thead><tbody>' +
        rows.map(function (r, i) {
          return '<tr class="' + (r.me ? "me" : "") + '"><td class="n">' + (i + 1) + '</td><td><span class="h" data-house="' + G.esc(r.house) + '">' + G.esc(r.name) + "</span></td><td>" + rankBadge(r.rating, true) + "</td><td>" + r.w + "</td><td>" + r.l + '</td><td class="r">' + r.rating + "</td></tr>";
        }).join("") + "</tbody></table>";
    }).catch(function (e) { box.innerHTML = '<p class="end-note">Classifica non disponibile: ' + G.esc(e.message) + "</p>"; });
  }
  function waiting(text, code) {
    $("duelActions").hidden = true;
    $("duelWait").hidden = false;
    $("duelStatus").textContent = text;
    var c = $("duelCodeShow");
    if (code) { c.hidden = false; c.innerHTML = "Codice della stanza<b>" + code + "</b>Dallo al tuo amico."; }
    else c.hidden = true;
  }
  function idle(text) {
    $("duelActions").hidden = false;
    $("duelWait").hidden = true;
    $("duelStatus").textContent = "";
    if (text) {
      $("duelRecord").textContent = text;
      setTimeout(paintRecord, 4000);
    }
  }
  function open() {
    if (window.SigilCollezione && window.SigilCollezione.needOath()) return;
    G.showMenu(false);
    sheet.hidden = false;
    $("duelName").value = G.save().name || "";
    idle();
    paintRecord();
    paintBoard();
  }
  function closeSheet() { sheet.hidden = true; }

  /* ───────── chi sono ───────── */
  function myHouse() {
    var s = G.save();
    var h = s.sworn || s.house;
    return h && h !== "misto" ? h : null;
  }
  function myDeck() {
    var C = window.SigilCollezione;
    return C ? C.deckForPlay() : null;
  }
  function myName() { return (G.save().name || "Custode").slice(0, 20); }
  function myUid() { var c = Cloud(); return c ? c.uid() : null; }
  function meInfo() {
    return { name: myName(), uid: myUid(), house: myHouse(), deck: myDeck(), rating: record().rating || null };
  }
  function oppName() { return (opp && opp.name) || "l'altro Custode"; }
  function cleanName(n) { return String(n || "Custode").replace(/[<>]/g, "").slice(0, 20) || "Custode"; }

  /* ───────── PeerJS ───────── */
  var loading = null;
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = PEER_JS;
      s.onload = function () { resolve(); };
      s.onerror = function () { loading = null; reject(new Error("PeerJS non raggiungibile")); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function cleanup() {
    searching = false;
    busy = false;
    role = null;
    if (tick) { clearInterval(tick); tick = null; }
    if (redial) { clearTimeout(redial); redial = null; }
    try { if (conn) conn.close(); } catch (e) { /* già chiusa */ }
    try { if (peer) peer.destroy(); } catch (e) { /* già distrutto */ }
    conn = null;
    peer = null;
    game = null;
    opp = null;
  }

  function makePeer(id) {
    return new Promise(function (resolve) {
      var p = id ? new window.Peer(id, { debug: 0 }) : new window.Peer({ debug: 0 });
      var done = false;
      p.on("open", function () { if (done) return; done = true; resolve({ peer: p }); });
      p.on("error", function (err) {
        if (done) return;
        done = true;
        try { p.destroy(); } catch (e) { /* ignora */ }
        resolve({ error: err && err.type ? err.type : "errore" });
      });
      setTimeout(function () { if (!done) { done = true; try { p.destroy(); } catch (e) {} resolve({ error: "timeout" }); } }, 9000);
    });
  }

  // Host: aspetta che qualcuno si sieda (o che l'avversario torni dopo un filo spezzato).
  function hostOn(p, statusText, code) {
    peer = p;
    role = "host";
    waiting(statusText, code);
    p.on("connection", function (c) {
      c.on("open", function () {
        var first = function (msg) {
          c.removeListener("data", first);
          if (msg && msg.t === "resume" && game && msg.token === game.token) {
            reattach(c, msg);
            raw({ t: "resume", token: game.token, have: game.inSeq });
            return;
          }
          if (msg && msg.t === "hello" && !busy && !conn) { attach(c); onData(msg); return; }
          try { c.send({ t: "busy" }); } catch (e) {}
          setTimeout(function () { try { c.close(); } catch (e) {} }, 300);
        };
        c.on("data", first);
      });
    });
    // Se perdo il server di PeerJS, mi ricollego: l'avversario potrebbe richiamarmi.
    p.on("disconnected", function () { try { p.reconnect(); } catch (e) {} });
  }

  // Ospite: prova a sedersi davanti a chi aspetta in quella sedia.
  function tryJoin(p, targetId) {
    return new Promise(function (resolve) {
      var c = p.connect(targetId, { reliable: true, serialization: "json" });
      var done = false;
      function finish(ok) { if (done) return; done = true; resolve(ok); }
      var hello = null;
      c.on("open", function () {
        // Ripeto il saluto finché l'host risponde: il primo potrebbe arrivare prima che ascolti.
        var info = meInfo();
        var say = function () { try { c.send({ t: "hello", v: PROTO, name: info.name, uid: info.uid, house: info.house, deck: info.deck, rating: info.rating }); } catch (e) {} };
        say();
        hello = setInterval(say, 900);
        c.on("data", function first(msg) {
          if (done) return;
          if (msg && msg.t === "busy") { clearInterval(hello); try { c.close(); } catch (e) {} finish(false); return; }
          if (msg && msg.t === "start") {
            clearInterval(hello);
            role = "guest";
            opp = readInfo(msg.host);
            attach(c);
            begin(msg.seed, msg.token, targetId);
            finish(true);
          }
        });
      });
      c.on("close", function () { clearInterval(hello); });
      c.on("error", function () { finish(false); });
      setTimeout(function () { if (!done) { clearInterval(hello); try { c.close(); } catch (e) {} finish(false); } }, 7000);
    });
  }

  function readInfo(m) {
    m = m || {};
    return { name: cleanName(m.name), uid: typeof m.uid === "string" ? m.uid : null, house: m.house || null, deck: m.deck || null, rating: m.rating || null };
  }

  async function quick() {
    try { await loadPeer(); } catch (e) { idle("Non riesco a raggiungere PeerJS: controlla la connessione."); return; }
    searching = true;
    waiting("Cerco un altro Custode…");
    var guestPeer = null;
    for (var slot = 1; slot <= SLOTS && searching; slot++) {
      var id = PREFIX + "q-" + slot;
      var claim = await makePeer(id);
      if (!searching) { if (claim.peer) claim.peer.destroy(); break; }
      if (claim.peer) {
        if (guestPeer) guestPeer.destroy();
        hostOn(claim.peer, "Sei seduto al tavolo. Aspetto che arrivi un altro Custode…");
        return;
      }
      if (claim.error !== "unavailable-id") { idle("La rete non risponde (" + claim.error + "). Riprova tra poco."); searching = false; return; }
      // Qualcuno aspetta in questa sedia: provo a sedermi davanti.
      if (!guestPeer) {
        var g = await makePeer(null);
        if (!g.peer) { idle("La rete non risponde. Riprova tra poco."); searching = false; return; }
        guestPeer = g.peer;
        peer = guestPeer;
      }
      waiting("Trovato un tavolo, mi siedo…");
      var ok = await tryJoin(guestPeer, id);
      if (ok) return;
      waiting("Quel tavolo era occupato, ne cerco un altro…");
    }
    if (searching) { idle("Tutti i tavoli sono pieni. Riprova tra un momento."); cleanup(); }
  }

  function code4() {
    var A = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    var s = "";
    for (var i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  }

  async function createRoom() {
    try { await loadPeer(); } catch (e) { idle("Non riesco a raggiungere PeerJS: controlla la connessione."); return; }
    searching = true;
    for (var i = 0; i < 4 && searching; i++) {
      var code = code4();
      waiting("Apro la stanza…");
      var r = await makePeer(PREFIX + "r-" + code);
      if (r.peer) { hostOn(r.peer, "Stanza aperta. Aspetto il tuo amico…", code); return; }
      if (r.error !== "unavailable-id") break;
    }
    idle("Non riesco ad aprire la stanza. Riprova tra poco.");
    cleanup();
  }

  async function joinRoom(code) {
    code = String(code || "").toUpperCase().replace(/[^A-Z]/g, "");
    if (code.length !== 4) { idle("Il codice ha 4 lettere."); return; }
    try { await loadPeer(); } catch (e) { idle("Non riesco a raggiungere PeerJS: controlla la connessione."); return; }
    searching = true;
    waiting("Busso alla stanza " + code + "…");
    var g = await makePeer(null);
    if (!g.peer) { idle("La rete non risponde. Riprova tra poco."); cleanup(); return; }
    peer = g.peer;
    var ok = await tryJoin(peer, PREFIX + "r-" + code);
    if (!ok) { idle("Nessuno risponde nella stanza " + code + ", oppure è già piena."); cleanup(); }
  }

  /* ───────── il filo ───────── */
  function attach(c) {
    conn = c;
    c.on("data", onData);
    c.on("close", function () { onClose(c); });
    c.on("error", function () { onClose(c); });
  }

  // Ritrovato l'avversario: nuovo filo, rimando ciò che non ha ricevuto.
  function reattach(c, msg) {
    var old = conn;
    conn = c;
    if (old && old !== c) { try { old.close(); } catch (e) {} }
    c.on("data", onData);
    c.on("close", function () { onClose(c); });
    c.on("error", function () { onClose(c); });
    if (redial) { clearTimeout(redial); redial = null; }
    if (game.lostAt) {
      game.deadline += Date.now() - game.lostAt; // il tempo perso non conta
      game.lostAt = 0;
      G.say("Il filo con " + oppName() + " è di nuovo teso.");
    }
    game.out.forEach(function (m) { if (m.s > (msg.have || 0)) raw(m); });
  }

  function raw(msg) {
    try { if (conn && conn.open) conn.send(msg); } catch (e) { /* la chiusura la gestisce onClose */ }
  }
  // Messaggi del duello: numerati e conservati, per rimandarli dopo un filo spezzato.
  function send(msg) {
    if (!game) return raw(msg);
    msg.s = ++game.outSeq;
    game.out.push(msg);
    raw(msg);
  }

  function onClose(c) {
    if (c !== conn || !game || game.gone) return;
    var m = G.match();
    if (!m || m.phase === "over" || game.over) {
      game.gone = true;
      G.render();
      return;
    }
    if (game.lostAt) return;
    game.lostAt = Date.now();
    G.say("Il filo con " + oppName() + " si è spezzato. Lo aspetto per " + GRACE_SECONDS + " secondi…");
    if (role === "guest") callBack();
  }

  // L'ospite richiama l'host finché non risponde (o finché scade l'attesa).
  function callBack() {
    if (!game || !game.lostAt || game.gone) return;
    redial = setTimeout(function () {
      redial = null;
      if (!game || !game.lostAt || game.gone || !peer) return;
      try { if (peer.disconnected) peer.reconnect(); } catch (e) {}
      var c;
      try { c = peer.connect(game.hostId, { reliable: true, serialization: "json" }); } catch (e) { callBack(); return; }
      var answered = false;
      c.on("open", function () {
        c.send({ t: "resume", token: game.token, have: game.inSeq });
        c.on("data", function first(msg) {
          if (answered || !game) return;
          if (msg && msg.t === "resume" && msg.token === game.token) {
            answered = true;
            c.removeListener("data", first);
            reattach(c, msg);
          }
        });
      });
      setTimeout(function () { if (!answered) { try { c.close(); } catch (e) {} callBack(); } }, 2800);
    }, 1500);
  }

  /* ───────── il duello ───────── */
  function begin(seed, token, hostId) {
    searching = false;
    busy = true;
    closeSheet();
    game = {
      seed: seed, token: token, hostId: hostId || (peer && peer.id),
      mine: {}, theirs: {}, pendingSnap: 0, pendingRetreat: false,
      gone: false, over: false, lostAt: 0, deadline: 0, lastTurn: 0,
      out: [], outSeq: 0, inSeq: 0,
      wantRematch: false, theyWant: false
    };
    var me = meInfo();
    var hostUid = role === "host" ? me.uid : opp.uid;
    var guestUid = role === "host" ? opp.uid : me.uid;
    game.key = hostUid && guestUid ? seed + ":" + token + ":" + hostUid + ":" + guestUid : null;
    G.start({
      seat: role, seed: seed,
      house: me.house || undefined, rivalHouse: opp.house || undefined,
      deck: E.deckList(me.deck) || undefined, rivalDeck: E.deckList(opp.deck) || undefined,
      arena: seed
    }, hooks());
    G.say(oppName() + " siede di fronte a te. Per lui, l'Ombra sei tu.");
    startClock();
    if (!tick) tick = setInterval(loop, 250);
  }

  function token8() { return Math.random().toString(36).slice(2, 10); }

  function onData(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.t === "hello" && role === "host" && !busy) {
      if (msg.v !== PROTO) { raw({ t: "busy" }); return; }
      opp = readInfo(msg);
      var seed = (Math.random() * 0x100000000) >>> 0;
      var token = token8();
      raw({ t: "start", seed: seed, token: token, host: meInfo() });
      begin(seed, token);
      return;
    }
    if (!game) return;
    if (msg.t === "start" && role === "guest" && game.over) {
      // Rivincita: l'host ha mescolato di nuovo.
      opp = readInfo(msg.host);
      begin(msg.seed, msg.token, game.hostId);
      return;
    }
    if (msg.t === "rematch") {
      game.theyWant = true;
      G.render();
      maybeRematch();
      return;
    }
    if (msg.t === "bye") { game.gone = true; game.lostAt = 0; gone(); return; }
    if (msg.t === "resume") return;
    // Da qui: messaggi numerati del duello.
    if (msg.s) {
      if (msg.s <= game.inSeq) return; // già ricevuto prima del filo spezzato
      game.inSeq = msg.s;
    }
    if (msg.t === "plays") { game.theirs[msg.turn] = msg.plays || []; resolveIfReady(); return; }
    if (msg.t === "snap") { game.pendingSnap++; return; }
    if (msg.t === "retreat") { game.pendingRetreat = true; return; }
    if (msg.t === "sum") { game.sumMsg = msg; return; }
  }

  function gone() {
    var m = G.match();
    if (m && m.phase !== "over") {
      game.pendingRetreat = true;
      G.say(oppName() + " ha lasciato il tavolo.");
    } else {
      G.render();
    }
  }

  function startClock() { game.deadline = Date.now() + TURN_SECONDS * 1000; }

  function resolveIfReady() {
    var m = G.match();
    if (!m || !game || m.phase !== "plan") return;
    var t = m.turn;
    if (!game.mine[t] || !game.theirs[t]) return;
    var res = E.submitRival(m, game.theirs[t]);
    if (!res.ok) {
      G.say("I due tavoli non coincidono più (" + res.message + "). Il duello si ferma qui.");
      E.retreat(m, "rival");
      G.render();
      return;
    }
    E.endTurn(m);
    G.pump();
  }

  function loop() {
    var m = G.match();
    if (!m || !game || m.mode !== "pvp") return;
    // Filo spezzato da troppo: l'altro ha abbandonato.
    if (game.lostAt && Date.now() - game.lostAt > GRACE_SECONDS * 1000) {
      game.lostAt = 0;
      game.gone = true;
      if (redial) { clearTimeout(redial); redial = null; }
      gone();
    }
    // Snap e resa arrivati dalla rete: si applicano solo durante la scelta.
    if (m.phase === "plan") {
      if (game.pendingRetreat) {
        game.pendingRetreat = false;
        E.retreat(m, "rival");
        G.render();
        return;
      }
      while (game.pendingSnap > 0) {
        game.pendingSnap--;
        E.snap(m, "rival");
        G.render();
      }
      if (game.sumMsg && game.sumMsg.turn === m.turn) { check(game.sumMsg); game.sumMsg = null; }
      if (m.turn !== game.lastTurn) {
        // Nuova ora: controllo che i due tavoli siano uguali, poi parte il tempo.
        if (game.lastTurn) send({ t: "sum", turn: m.turn, sums: sums(m) });
        game.lastTurn = m.turn;
        startClock();
      }
      if (game.lostAt) return; // durante l'attesa il tempo si ferma
      var left = Math.max(0, Math.ceil((game.deadline - Date.now()) / 1000));
      var w = document.getElementById("whisper");
      if (w && !game.mine[m.turn]) w.textContent = "Ti restano " + left + " secondi per quest'ora.";
      if (left <= 0 && !game.mine[m.turn]) {
        G.say("Il tempo è scaduto: la clessidra decide per te.");
        G.commit();
      }
    }
  }

  function sums(m) {
    return m.locations.map(function (_, i) { return [E.sidePower(m, "you", i), E.sidePower(m, "rival", i)]; });
  }
  function check(msg) {
    var m = G.match();
    if (!m || m.turn !== msg.turn) return;
    var mine = sums(m);
    var same = mine.every(function (pair, i) { return msg.sums[i] && pair[0] === msg.sums[i][1] && pair[1] === msg.sums[i][0]; });
    if (!same) G.say("Attenzione: i due tavoli mostrano forze diverse. Potrebbe essere un problema di versione.");
  }

  /* ───────── fine, registro e rivincita ───────── */
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function report(view) {
    var C = window.SigilCollezione;
    var c = Cloud();
    if (!C || !c || !game.key || !opp.uid) return;
    var result = view.winner === "you" ? "win" : view.winner === "rival" ? "loss" : "tie";
    var gain = result === "win" ? 45 : result === "tie" ? 22 : 15; // come sigil_pvp_report
    var key = game.key;
    var before = record().rating || 1000;
    var tries = 0;
    function ask() {
      return c.pvpReport(key, opp.uid, result, view.stake).then(function (res) {
        if (res.status === "in attesa" && ++tries < 6) return wait(2500).then(ask);
        return res;
      });
    }
    C.fromServer(ask().then(function (res) {
      if (res.status === "conteso") return { note: "I due resoconti non coincidono: il registro non annota questo duello." };
      if (res.status === "in attesa") return { note: "Il registro annoterà il duello quando anche " + oppName() + " lo confermerà." };
      var ink = res.ink || 0;
      return c.levelUp().then(function (lv) {
        var after = record().rating || before;
        var d = after - before;
        var rb = rank(before), ra = rank(after);
        var moved = ra.label !== rb.label ? (after > before ? " Sali a " + ra.label + "!" : " Scendi a " + ra.label + ".") : "";
        return { xp: gain, ink: ink + (lv.ink || 0), levels: lv.levels, cards: lv.cards, note: "Rango " + ra.label + " · " + after + " punti (" + (d >= 0 ? "+" : "") + d + ")." + moved };
      });
    }));
  }

  function maybeRematch() {
    if (!game || !game.over || !game.wantRematch || !game.theyWant || role !== "host") return;
    var seed = (Math.random() * 0x100000000) >>> 0;
    var token = token8();
    raw({ t: "start", seed: seed, token: token, host: meInfo() });
    begin(seed, token);
  }

  function canRematch() { return game && !game.gone && conn && conn.open; }

  function hooks() {
    return {
      rivalName: function () { return oppName(); },
      commit: function (m) {
        if (!game || m.phase !== "plan" || game.mine[m.turn]) return;
        game.mine[m.turn] = true;
        send({ t: "plays", turn: m.turn, plays: E.myPlays(m) });
        resolveIfReady();
      },
      status: function (view) {
        if (!game || view.phase !== "plan") return null;
        if (game.mine[view.turn]) return { waiting: true, label: "Attendo " + oppName() + "…", whisper: "Hai scelto. " + oppName() + " sta ancora decidendo." };
        return null;
      },
      snap: function (m) { send({ t: "snap", turn: m.turn }); },
      retreat: function () { send({ t: "retreat" }); },
      settle: function (view) {
        game.over = true;
        if (!Cloud()) {
          var r = record();
          if (view.winner === "you") r.w++;
          else if (view.winner === "rival") r.l++;
          else r.t++;
          G.persist();
        }
        report(view);
      },
      fillEnd: function (view, el) {
        el.eyebrow.textContent = "Duello contro " + oppName();
        if (view.reason === "ritiro" && view.retreated === "rival") el.sub.textContent = oppName() + " ha lasciato il tavolo prima della campana.";
        var note = "";
        if (canRematch()) {
          if (game.wantRematch) { el.again.textContent = "Aspetto " + oppName() + "…"; el.again.disabled = true; }
          else el.again.textContent = game.theyWant ? "Accetta la rivincita" : "Chiedi la rivincita";
          if (game.theyWant && !game.wantRematch) note = oppName() + " vuole la rivincita.";
        } else {
          el.again.textContent = "Cerca un altro duello";
          el.again.disabled = false;
          if (game && game.gone && game.over) note = oppName() + " si è alzato dal tavolo.";
        }
        if (note) el.extra.insertAdjacentHTML("afterbegin", '<p class="rematch-note">' + G.esc(note) + "</p>");
      },
      again: function () {
        if (canRematch()) {
          game.wantRematch = true;
          raw({ t: "rematch" });
          G.render();
          maybeRematch();
          return;
        }
        G.clearMatch();
        open();
        quick();
      },
      back: function () { open(); },
      leave: function () {
        // Chi si alza a metà duello dichiara comunque l'esito (la resa), così il registro lo conta.
        var m = G.match();
        var c = Cloud();
        if (game && !game.over && m && m.phase === "over" && c && game.key && opp && opp.uid) {
          var v = E.view(m);
          var result = v.winner === "you" ? "win" : v.winner === "rival" ? "loss" : "tie";
          c.pvpReport(game.key, opp.uid, result, v.stake).then(function () { return c.levelUp(); }).catch(function () {});
        }
        raw({ t: "bye" });
        var b = document.getElementById("againButton");
        if (b) b.disabled = false;
        cleanup();
      }
    };
  }

  /* ───────── eventi ───────── */
  $("duelBack").addEventListener("click", function () { cleanup(); closeSheet(); G.showMenu(true); });
  $("duelQuick").addEventListener("click", quick);
  $("duelCreate").addEventListener("click", createRoom);
  $("duelJoinForm").addEventListener("submit", function (e) { e.preventDefault(); joinRoom($("duelCode").value); });
  $("duelNameForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var n = $("duelName").value.trim();
    if (n.length < 2) { $("duelRecord").textContent = "Il nome deve avere almeno 2 lettere."; return; }
    G.save().name = n;
    G.persist();
    var c = Cloud();
    if (c) c.setName(n).then(function () { $("duelRecord").textContent = "Siederai al tavolo come " + n + "."; setTimeout(paintRecord, 2500); paintBoard(); })
      .catch(function (err) { $("duelRecord").textContent = err.message; });
    else $("duelRecord").textContent = "Siederai al tavolo come " + n + ".";
  });
  $("duelCancel").addEventListener("click", function () { cleanup(); idle(); });
  var btn = document.getElementById("duelButton");
  if (btn) btn.addEventListener("click", open);
  window.addEventListener("beforeunload", function () { raw({ t: "bye" }); });
  if (window.SigilCloud) window.SigilCloud.on(function () { if (!sheet.hidden && !busy && !searching) paintRecord(); });

  window.SigilDuello = {
    rank: rank,
    open: open,
    // Per le prove: spezza il filo senza salutare, come una rete che cade.
    _drop: function () { try { if (conn) conn.close(); } catch (e) {} }
  };
})();
