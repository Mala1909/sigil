"use strict";

/*
 * SIGIL — Il registro dei Custodi: salvataggio online con Supabase.
 *
 * Ogni giocatore entra in modo anonimo (nessuna email, nessuna password):
 * Supabase gli dà un'identità che resta in questo browser. Collezione, mazzo,
 * livello, pegni, ambra, Viaggio, pass e classifica vivono sul server; il
 * salvataggio locale ne è solo una copia, così il gioco funziona anche offline.
 *
 * Il gioco può solo leggere i propri dati. Ogni cambiamento passa per le
 * funzioni sigil_* del server, che controllano tutto (vedi supabase/schema.sql).
 * La chiave qui sotto è quella "pubblicabile": è fatta per stare nel browser.
 */
(function () {
  var G = window.SigilGame;
  if (!G || window.SIGIL_ANTEPRIMA) return; // in anteprima niente registro (vedi anteprima.js)

  var URL ="https://bvjpmvdwdnqgverhxckj.supabase.co";
  var KEY = "sb_publishable_eWFok_txjIBccYLVLvC0vA_GhlmsSvi";
  var LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";

  var sb = null;
  var uid = null;
  var me = null;
  var state = "connecting"; // connecting | online | offline
  var listeners = [];

  function emit() {
    listeners.forEach(function (fn) { try { fn(state, me); } catch (e) { console.error(e); } });
  }

  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = LIB;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("libreria non raggiungibile")); };
      document.head.appendChild(s);
    });
  }

  function call(fn, args) {
    return sb.rpc(fn, args || {}).then(function (r) {
      if (r.error) throw new Error(r.error.message || "errore del server");
      return r.data;
    });
  }

  // Il profilo del server diventa il salvataggio locale.
  function apply(p) {
    if (!p) return;
    me = p;
    var s = G.save();
    var col = {};
    (p.collection || []).forEach(function (id) { col[id] = 1; });
    // Le carte arrivate dal server e che qui non c'erano sono "nuove".
    if (s.collection && s.sworn === p.house) {
      s.fresh = s.fresh || {};
      Object.keys(col).forEach(function (id) { if (!s.collection[id]) s.fresh[id] = 1; });
    }
    s.collection = col;
    s.sworn = p.house;
    s.house = p.house;
    s.name = p.name;
    if (p.deck && p.deck.length) s.deck = p.deck.slice();
    // Più mazzi (15 nov): i posti comprati e i mazzi salvati sul server.
    s.deckSlots = p.deck_slots || 4;
    if (Array.isArray(p.decks) && p.decks.length) {
      s.decks = p.decks.slice(0, s.deckSlots).map(function (d) { return { name: d.name || "", cards: (d.cards || []).slice() }; });
      s.activeDeck = Math.max(0, Math.min(p.deck_active || 0, s.decks.length - 1));
      s.deck = s.decks[s.activeDeck].cards.slice();
    } else if (s.decks && s.decks.length) {
      // Il server non ha ancora i mazzi (profilo di prima del 15 nov): glieli mando.
      setTimeout(function () { setDecks(s.decks, s.activeDeck || 0); }, 0);
    }
    s.xp = p.xp;
    s.level = p.level;
    s.gettoni = p.gold;
    s.ambra = p.ambra;
    s.journey = { unlocked: (p.journey && p.journey.unlocked) || 1, stars: (p.journey && p.journey.stars) || {}, finished: !!(p.journey && p.journey.finished), tries: (s.journey && s.journey.tries) || {} };
    s.pass = { season: p.pass_season, xp: p.pass_xp, days: p.pass_days || 0, day: p.pass_day || null, premium: p.pass_premium, claimed: p.pass_claimed || {} };
    s.pvp = { w: p.pvp_w, l: p.pvp_l, t: p.pvp_t, rating: p.rating };
    G.persist();
    emit();
  }

  function fresh() {
    return sb.auth.signInAnonymously().then(function (r) {
      if (r.error) throw r.error;
      return r.data.session;
    });
  }

  function connect() {
    state = "connecting";
    emit();
    return loadLib().then(function () {
      sb = window.supabase.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "sigil-auth" } });
      return sb.auth.getSession();
    }).then(function (got) {
      var session = got && got.data && got.data.session;
      if (!session) return fresh();
      // L'identità salvata esiste ancora sul server? Se no, ne prendo una nuova.
      return sb.auth.getUser().then(function (u) {
        if (u.error || !u.data || !u.data.user) return sb.auth.signOut({ scope: "local" }).then(fresh, fresh);
        return session;
      });
    }).then(function (session) {
      uid = session.user.id;
      return call("sigil_me");
    }).then(function (p) {
      var s = G.save();
      // Hai già giurato su questo dispositivo ma il server non ti conosce: ti registro ora.
      if (!p && s.sworn) return call("sigil_init", { p_house: s.sworn, p_name: s.name || "Custode" });
      return p;
    }).then(function (p) {
      // Le veglie giocate senza rete partono prima di tutto: così il profilo che arriva le contiene già.
      return p ? flush().then(function (res) { return (res && res.me) || p; }, function () { return p; }) : p;
    }).then(function (p) {
      state = "online";
      if (p) apply(p); else emit();
    }).catch(function (err) {
      console.warn("SIGIL: registro non raggiungibile, si gioca in locale.", err);
      state = "offline";
      emit();
    });
  }

  /* ───────── veglie giocate senza rete ─────────
   * Come i giochi che si possono usare offline: la partita finita senza rete
   * resta in una coda locale (con il suo id e la sua ora) e parte appena il
   * registro risponde. I premi li decide sempre il server, con gli stessi
   * controlli delle partite online; qui non si regala niente in anticipo. */
  var lastSync = null;
  function outbox() { var s = G.save(); if (!Array.isArray(s.outbox)) s.outbox = []; return s.outbox; }
  function newId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function queue(o) {
    var box = outbox();
    box.push({ id: newId(), at: new Date().toISOString(), mode: o.mode, result: o.result, stake: o.stake || 1,
      seconds: o.seconds || 0, level: o.level || null, stars: o.stars || 0 });
    if (box.length > 60) box.splice(0, box.length - 60); // il server ne accetta al massimo 60 per volta, degli ultimi 7 giorni
    G.persist();
    emit();
    return box.length;
  }
  var flushing = null;
  function flush() {
    var box = outbox();
    if (!box.length || !sb) return Promise.resolve(null);
    if (flushing) return flushing;
    var sent = box.slice();
    flushing = call("sigil_report_batch", { p_entries: sent }).then(function (res) {
      var done = {};
      (res.ids || []).forEach(function (id) { done[id] = 1; });
      var s = G.save();
      s.outbox = outbox().filter(function (e) { return !done[e.id]; });
      G.persist();
      lastSync = { at: Date.now(), accepted: res.accepted || 0, ignored: res.ignored || 0, xp: res.xp || 0,
        levels: res.levels || 0, cards: res.cards || [], objectives: res.objectives || [] };
      flushing = null;
      return res;
    }, function (err) { flushing = null; throw err; });
    return flushing;
  }

  var ready = connect();
  // Quando la rete torna, la coda parte da sola.
  window.addEventListener("online", function () {
    if (state === "online") { if (outbox().length) flush().then(function (res) { if (res && res.me) apply(res.me); }, function () {}); }
    else if (state === "offline") { ready = connect(); }
  });

  function need() {
    return ready.then(function () {
      if (state !== "online") throw new Error("Il registro dei Custodi non risponde: controlla la connessione.");
    });
  }
  // Chiama una funzione e, se torna il profilo, lo applica.
  function act(fn, args) {
    return need().then(function () { return call(fn, args); }).then(function (res) {
      if (res && res.me) apply(res.me);
      else if (res && res.id && res.house) apply(res);
      return res;
    });
  }

  // Chi sei per il registro: anonimo (solo questo browser) o con email (da qualsiasi dispositivo).
  var who = null;
  function account() {
    if (!sb) return Promise.resolve(null);
    return sb.auth.getUser().then(function (r) {
      var u = r && r.data && r.data.user;
      who = u ? { email: u.email || null, pending: u.new_email || null, anonymous: !u.email } : null;
      return who;
    });
  }
  // Dove riporta il link dell'email: la pagina del gioco da cui è partita la richiesta.
  function home() { return location.origin + location.pathname.replace(/[^/]*$/, ""); }
  function authOk(r) {
    if (r && r.error) {
      var m = r.error.message || "errore";
      if (/already been registered|already registered|email_exists/i.test(m)) m = "Questa email ha già un profilo: usa «Entra con la tua email».";
      else if (/rate limit|too many|security purposes/i.test(m)) m = "Troppi codici in poco tempo: aspetta qualche minuto e riprova.";
      else if (/expired|invalid|otp/i.test(m)) m = "Codice sbagliato o scaduto.";
      else if (/signups not allowed|user not found/i.test(m)) m = "Nessun profilo con questa email.";
      else if (/invalid.*email|valid email/i.test(m)) m = "L'indirizzo email non sembra valido.";
      throw new Error(m);
    }
    return r && r.data;
  }

  var deckTimer = null;
  // Tutti i mazzi insieme, con quello scelto: il server controlla carte e posti.
  var decksTimer = null;
  function setDecks(decks, active) {
    if (state !== "online" || !Array.isArray(decks) || !decks.length) return;
    clearTimeout(decksTimer);
    var copy = decks.map(function (d) { return { name: d.name || "", cards: (d.cards || []).slice(0, 12) }; });
    decksTimer = setTimeout(function () {
      call("sigil_set_decks", { p_decks: copy, p_active: active || 0 }).catch(function (e) { console.warn("SIGIL: mazzi non salvati", e); });
    }, 900);
  }

  function setDeck(deck) {
    if (state !== "online" || !deck || deck.length !== 12) return;
    clearTimeout(deckTimer);
    var copy = deck.slice();
    deckTimer = setTimeout(function () {
      call("sigil_set_deck", { p_deck: copy }).catch(function (e) { console.warn("SIGIL: mazzo non salvato", e); });
    }, 900);
  }

  window.SigilCloud = {
    online: function () { return state === "online"; },
    state: function () { return state; },
    ready: function () { return ready; },
    uid: function () { return uid; },
    me: function () { return me; },
    on: function (fn) { listeners.push(fn); },
    retry: function () { ready = connect(); return ready; },
    init: function (house, name) { return act("sigil_init", { p_house: house, p_name: name || "Custode" }); },
    setName: function (name) { return act("sigil_set_name", { p_name: name }); },
    setDeck: setDeck,
    setDecks: setDecks,
    report: function (o) {
      return act("sigil_report", { p_mode: o.mode, p_result: o.result, p_stake: o.stake, p_seconds: o.seconds, p_level: o.level || null, p_stars: o.stars || 0 });
    },
    shop: function () { return need().then(function () { return call("sigil_shop"); }); },
    buy: function (item) { return act("sigil_buy", { p_item: item }); },
    claim: function (tier, track) { return act("sigil_claim", { p_tier: tier, p_track: track }); },
    levelUp: function () { return act("sigil_level_up"); },
    pvpReport: function (key, opponent, result, stake) {
      return act("sigil_pvp_report", { p_key: key, p_opponent: opponent, p_result: result, p_stake: stake || 1 });
    },
    leaderboard: function () { return need().then(function () { return call("sigil_leaderboard"); }); },
    // Coda delle veglie senza rete
    queue: queue,
    pending: function () { return outbox().length; },
    lastSync: function () { return lastSync; },
    clearSync: function () { lastSync = null; },
    flush: function () { return need().then(flush).then(function (res) { if (res && res.me) apply(res.me); return res; }); },
    // Obiettivi del giorno e della settimana
    objectives: function () { return need().then(function () { return call("sigil_objectives"); }); },
    claimObjective: function (id) { return act("sigil_claim_objective", { p_obj: id }); },
    refresh: function () { return act("sigil_me"); },
    // Email: collega il profilo anonimo a un indirizzo, o rientra da un altro dispositivo.
    // Niente password: arriva un codice per email e lo si scrive nel gioco.
    account: account,
    linkEmail: function (email) {
      return need().then(function () { return sb.auth.updateUser({ email: email }, { emailRedirectTo: home() }); }).then(authOk);
    },
    confirmLink: function (email, code) {
      return need().then(function () { return sb.auth.verifyOtp({ email: email, token: code, type: "email_change" }); })
        .then(authOk).then(function () { return sb.auth.refreshSession(); }).then(function () { emit(); return account(); });
    },
    // Se l'email aveva un link invece del codice: aperto il link (anche da un altro dispositivo), qui basta rileggere l'utente.
    checkLinked: function () {
      return need().then(function () { return sb.auth.refreshSession(); }).then(function () { emit(); return account(); });
    },
    sendLogin: function (email) {
      return need().then(function () { return sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: home() } }); }).then(authOk);
    },
    confirmLogin: function (email, code) {
      return need().then(function () { return sb.auth.verifyOtp({ email: email, token: code, type: "email" }); }).then(authOk);
    },
    passRewards: function () {
      return need().then(function () { return sb.from("pass_rewards").select("tier,track,kind,amount").eq("season", (me && me.pass_season) || 1).order("tier"); })
        .then(function (r) { if (r.error) throw new Error(r.error.message); return r.data; });
    }
  };
})();
