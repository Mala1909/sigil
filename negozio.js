"use strict";

/*
 * SIGIL — La Bottega e il Pass della veglia.
 *
 * Bottega: ogni giorno quattro carte che non hai, pagate in pegni (si vincono
 * giocando); un pacco di tre carte a sorpresa e il Pass premium, pagati in
 * ambra. Per ora l'ambra non si compra: 300 al giuramento, altra dal pass.
 * Pass: 30 livelli, 100 punti l'uno (ogni partita ne dà). Ogni livello ha un
 * premio gratuito e uno premium.
 * Tutto passa dal server (cloud.js): qui si mostra e si chiede, mai si decide.
 */
(function () {
  var E = window.Lume;
  var G = window.SigilGame;
  if (!E || !G) return;

  var BY_ID = {};
  (E.ALL_CARDS || E.CARDS).forEach(function (c) { BY_ID[c.id] = c; });
  var TIERS = 30;
  var PER_TIER = 100;

  function Cloud() { return window.SigilCloud; }
  function S() { return G.save(); }
  var $ = function (id) { return document.getElementById(id); };

  var sheet = document.createElement("section");
  sheet.className = "sheet shop-sheet";
  sheet.id = "shop";
  sheet.hidden = true;
  sheet.innerHTML =
    '<header class="journey-head">' +
      '<button type="button" class="icon-button" id="shopBack" aria-label="Torna alla soglia">←</button>' +
      '<div><p class="eyebrow" id="shopEyebrow">La Bottega del Sigillo</p><h2 id="shopTitle">Cosa porta la notte</h2></div>' +
      '<div class="wallet"><span title="Pegni: si vincono giocando">Pegni <b id="walletGold">0</b></span><span class="amber" title="Ambra">◆ <b id="walletAmbra">0</b></span></div>' +
    "</header>" +
    '<nav class="shop-tabs" role="tablist">' +
      '<button type="button" role="tab" data-tab="bottega">Bottega</button>' +
      '<button type="button" role="tab" data-tab="obiettivi">Obiettivi</button>' +
      '<button type="button" role="tab" data-tab="pass">Pass della veglia</button>' +
    "</nav>" +
    '<div class="shop-body" id="shopBody"></div>' +
    '<div class="shop-reveal" id="shopReveal" hidden></div>';
  document.body.appendChild(sheet);

  var tab = "bottega";
  var shopData = null;
  var passData = null;
  var armed = null; // l'acquisto che aspetta la conferma

  function wallet() {
    var s = S();
    $("walletGold").textContent = String(s.gettoni || 0);
    $("walletAmbra").textContent = String(s.ambra || 0);
  }

  function offline(msg) {
    $("shopBody").innerHTML = '<div class="shop-offline"><p>' + G.esc(msg || "La Bottega apre solo quando il registro dei Custodi risponde.") + "</p>" +
      '<button type="button" class="button ghost tiny" data-act="retry">Riprova</button></div>';
  }

  function open(which) {
    if (window.SigilCollezione && window.SigilCollezione.needOath()) return;
    tab = which || tab;
    armed = null;
    G.showMenu(false);
    sheet.hidden = false;
    paint();
  }
  function close() {
    sheet.hidden = true;
    $("shopReveal").hidden = true;
    G.showMenu(true);
  }

  function paint() {
    wallet();
    sheet.querySelectorAll("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === tab)); });
    $("shopEyebrow").textContent = tab === "pass" ? "Pass della veglia · stagione 1" : tab === "obiettivi" ? "Gli incarichi del Sigillo" : "La Bottega del Sigillo";
    $("shopTitle").textContent = tab === "pass" ? "La prima veglia" : tab === "obiettivi" ? "Obiettivi" : "Cosa porta la notte";
    $("shopBody").innerHTML = '<p class="shop-wait">Apro i registri…</p>';
    var c = Cloud();
    if (!c) { offline(); return; }
    c.ready().then(function () {
      if (!c.online()) { offline(tab === "obiettivi" ? "Gli obiettivi si leggono solo quando il registro dei Custodi risponde. Le veglie giocate senza rete li faranno avanzare al ritorno." : null); return; }
      if (tab === "pass") loadPass(); else if (tab === "obiettivi") loadObjectives(); else loadShop();
    });
  }

  /* ───────── Obiettivi ───────── */
  var objData = null;
  function loadObjectives() {
    Cloud().objectives().then(function (d) { objData = d; paintObjectives(); badge(); }).catch(function (e) { offline(e.message); });
  }
  function untilText(iso) {
    var ms = new Date(iso).getTime() - Date.now();
    if (!(ms > 0)) return "a breve";
    var h = Math.floor(ms / 3600000);
    if (h >= 48) return "tra " + Math.floor(h / 24) + " giorni";
    if (h >= 1) return "tra " + h + (h === 1 ? " ora" : " ore");
    return "tra " + Math.max(1, Math.round(ms / 60000)) + " minuti";
  }
  function prizeText(o) {
    var bits = [];
    if (o.gold) bits.push(o.gold + " pegni");
    if (o.ambra) bits.push("◆ " + o.ambra);
    if (o.pass) bits.push(o.pass + " punti del pass");
    return bits.join(" · ");
  }
  function paintObjectives() {
    var d = objData;
    if (!d) return;
    var block = function (period, title, ends) {
      var list = (d.list || []).filter(function (o) { return o.period === period; });
      return '<section class="shop-block"><div class="shop-block-head"><p class="label">' + title + "</p><small>Si rinnovano " + untilText(ends) + ".</small></div>" +
        '<div class="obj-list">' + list.map(function (o) {
          var full = o.progress >= o.target;
          var pct = Math.round((o.progress / o.target) * 100);
          var btn = o.claimed ? '<span class="obj-claimed">✓ Riscattato</span>'
            : full ? '<button type="button" class="button primary tiny" data-objclaim="' + G.esc(o.id) + '">Riscatta</button>'
            : '<span class="obj-count">' + o.progress + " / " + o.target + "</span>";
          return '<div class="obj-item' + (o.claimed ? " claimed" : full ? " ready" : "") + '">' +
            '<div class="obj-text"><b>' + G.esc(o.label) + "</b><small>" + prizeText(o) + "</small>" +
            '<span class="xp-bar wide"><i style="width:' + pct + '%"></i></span></div>' + btn + "</div>";
        }).join("") + "</div></section>";
    };
    $("shopBody").innerHTML = block("day", "Di oggi", d.day_ends) + block("week", "Di questa settimana", d.week_ends) +
      '<p class="shop-note">Ogni Custode ha i suoi obiettivi, scelti dalla notte. Avanzano da soli giocando contro l\'Ombra, nel Viaggio e nei Duelli; anche le veglie giocate senza rete contano, appena il registro le riceve.</p>';
  }
  function claimObjective(id, btn) {
    if (btn) { btn.disabled = true; btn.textContent = "Un momento…"; }
    Cloud().claimObjective(id).then(function (res) {
      objData = res.objectives || objData;
      wallet();
      paintObjectives();
      badge();
      G.blip("win");
    }).catch(function (e) { G.blip("no"); if (btn) { btn.disabled = false; btn.textContent = e.message; } });
  }

  /* ───────── Bottega ───────── */
  function loadShop() {
    Cloud().shop().then(function (d) { shopData = d; paintShop(); }).catch(function (e) { offline(e.message); });
  }
  function priceTag(n, cur) { return cur === "ambra" ? "◆ " + n + " ambra" : n + " pegni"; }
  function buyButton(item, price, cur, have, label) {
    if (have) return '<button type="button" class="button ghost tiny" disabled>Già tuo</button>';
    var s = S();
    var enough = cur === "ambra" ? (s.ambra || 0) >= price : (s.gettoni || 0) >= price;
    if (!enough) return '<button type="button" class="button ghost tiny" disabled>Servono ' + priceTag(price, cur) + "</button>";
    if (armed === item) return '<button type="button" class="button primary tiny" data-buy="' + item + '">Conferma · ' + priceTag(price, cur) + "</button>";
    return '<button type="button" class="button ghost tiny" data-arm="' + item + '">' + (label || "Prendi") + " · " + priceTag(price, cur) + "</button>";
  }
  function paintShop() {
    var d = shopData;
    if (!d) return;
    var s = S();
    var html = '<section class="shop-block"><div class="shop-block-head"><p class="label">Le carte di stanotte</p><small>Cambiano ogni giorno. Solo carte che non hai.</small></div>';
    if (!d.cards || !d.cards.length) html += '<p class="end-note">Hai già ogni carta della valle. Il mercante ti guarda con rispetto.</p>';
    else html += '<div class="shop-cards">' + d.cards.map(function (o) {
      var card = BY_ID[o.id];
      if (!card) return "";
      var have = s.collection && s.collection[o.id];
      return '<div class="shop-item">' + G.cardHTML(card) + '<p class="shop-lore">' + G.esc(card.lore) + "</p>" + buyButton("card:" + o.id, o.price, "gold", have) + "</div>";
    }).join("") + "</div>";
    html += "</section>";
    html += '<section class="shop-block shop-row">' +
      '<div class="shop-offer"><svg class="offer-sigil"><use href="#g-sigillo"/></svg><div><b>Pacco del viandante</b><p>Tre carte che non hai, scelte dalla notte.</p></div>' +
      buyButton("pacco", d.pack.price, "ambra", false, "Apri") + "</div>" +
      '<div class="shop-offer premium"><svg class="offer-sigil"><use href="#g-sigillo"/></svg><div><b>Pass premium della veglia</b><p>Sblocca la seconda fila di premi: più carte, pegni e ambra a ogni livello del pass.</p></div>' +
      buyButton("pass", d.pass.price, "ambra", s.pass && s.pass.premium, "Prendi") + "</div>" +
    "</section>" +
    '<p class="shop-note">I pegni si vincono giocando: la posta di ogni veglia vinta, le stelle del Viaggio, i premi del pass. L\'ambra per ora non si compra: ne ricevi 300 al giuramento e altra dal pass premium.</p>';
    $("shopBody").innerHTML = html;
    G.bindArt($("shopBody"));
  }

  function buy(item) {
    armed = null;
    var btn = sheet.querySelector('[data-buy="' + item + '"]');
    if (btn) { btn.disabled = true; btn.textContent = "Un momento…"; }
    Cloud().buy(item).then(function (res) {
      wallet();
      if (res.cards && res.cards.length) reveal(res.cards, item === "pacco" ? "Il pacco si apre" : "È tua");
      else if (item === "pass") reveal([], "Il Pass premium è tuo", "Torna al Pass della veglia: la seconda fila di premi ora si può riscattare.");
      return Cloud().shop().then(function (d) { shopData = d; paintShop(); });
    }).catch(function (e) {
      G.blip("no");
      if (btn) { btn.disabled = false; btn.textContent = e.message; }
      setTimeout(paintShop, 2200);
    });
  }

  function reveal(ids, title, text) {
    var box = $("shopReveal");
    box.innerHTML = '<div class="reveal-inner"><p class="eyebrow">Dalla Bottega</p><h3>' + G.esc(title) + "</h3>" +
      (ids.length ? '<div class="reward-cards">' + ids.map(function (id) { return BY_ID[id] ? G.cardHTML(BY_ID[id], { cls: "reward-card" }) : ""; }).join("") + "</div>" : "") +
      (text ? '<p class="end-note">' + G.esc(text) + "</p>" : ids.length ? '<p class="end-note">Le trovi in Mazzo e collezione.</p>' : "") +
      '<button type="button" class="button primary" data-act="closeReveal">Bene</button></div>';
    box.hidden = false;
    G.bindArt(box);
    G.blip("win");
  }

  /* ───────── Pass ───────── */
  function loadPass() {
    var c = Cloud();
    var p = passData ? Promise.resolve(passData) : c.passRewards();
    p.then(function (rows) { passData = rows; paintPass(); }).catch(function (e) { offline(e.message); });
  }
  function rewardText(r) {
    if (!r) return "—";
    if (r.kind === "gold") return r.amount + " pegni";
    if (r.kind === "ambra") return "◆ " + r.amount;
    return r.amount > 1 ? r.amount + " carte" : "1 carta";
  }
  function paintPass() {
    var s = S();
    var ps = s.pass || { xp: 0, premium: false, claimed: {} };
    var tier = Math.min(TIERS, Math.floor((ps.xp || 0) / PER_TIER));
    var into = tier >= TIERS ? 100 : Math.round((((ps.xp || 0) % PER_TIER) / PER_TIER) * 100);
    var at = {};
    (passData || []).forEach(function (r) { at[r.track + ":" + r.tier] = r; });
    var claimable = 0;
    var cols = "";
    for (var t = 1; t <= TIERS; t++) {
      var cell = function (track) {
        var r = at[track + ":" + t];
        var key = track + ":" + t;
        var done = ps.claimed && ps.claimed[key];
        var reached = t <= tier;
        var lockedPrem = track === "premium" && !ps.premium;
        var cls = "pass-cell " + track + (r && r.kind === "card" ? " card-prize" : "") + (done ? " done" : reached && !lockedPrem ? " ready" : " locked");
        if (reached && !done && !lockedPrem) claimable++;
        return '<button type="button" class="' + cls + '"' + (reached && !done && !lockedPrem ? ' data-claim="' + t + '" data-track="' + track + '"' : " disabled") + ">" +
          '<span class="pass-prize">' + rewardText(r) + "</span>" + (done ? '<span class="pass-mark">✓</span>' : lockedPrem ? '<span class="pass-mark">◆</span>' : "") + "</button>";
      };
      cols += '<div class="pass-col' + (t === tier + 1 ? " next" : "") + (t <= tier ? " reached" : "") + '"><span class="pass-tier">' + t + "</span>" + cell("free") + cell("premium") + "</div>";
    }
    $("shopBody").innerHTML =
      '<section class="pass-head">' +
        '<div><p class="label">Livello del pass</p><b class="pass-level">' + tier + " <small>/ " + TIERS + "</small></b></div>" +
        '<div class="pass-progress"><span class="xp-bar wide"><i style="width:' + into + '%"></i></span><small>' + (tier >= TIERS ? "Pass completato" : (ps.xp % PER_TIER) + " / " + PER_TIER + " punti per il livello " + (tier + 1)) + "</small>" +
        '<small>Ogni partita dà punti: 40 una vittoria, 20 un pareggio, 15 una sconfitta. I duelli ne danno di più.</small></div>' +
        (claimable ? '<button type="button" class="button primary tiny" data-act="claimAll">Riscatta tutto (' + claimable + ")</button>" : "") +
      "</section>" +
      '<div class="pass-legend"><span>Gratis</span><span class="prem">Premium' + (ps.premium ? " · tuo" : ' · <button type="button" class="text-button" data-act="toShop">sbloccalo in Bottega</button>') + "</span></div>" +
      '<div class="pass-track" id="passTrack">' + cols + "</div>";
    var next = sheet.querySelector(".pass-col.next") || sheet.querySelector(".pass-col.reached:last-child");
    if (next) next.scrollIntoView({ block: "nearest", inline: "center" });
  }
  function claim(t, track) {
    return Cloud().claim(t, track).then(function (res) {
      wallet();
      return res.cards || [];
    });
  }
  function claimAll() {
    var btns = Array.prototype.slice.call(sheet.querySelectorAll("[data-claim]"));
    var got = [];
    var chain = Promise.resolve();
    btns.forEach(function (b) {
      chain = chain.then(function () { return claim(Number(b.dataset.claim), b.dataset.track).then(function (c) { got = got.concat(c); }); });
    });
    chain.then(function () {
      paintPass();
      reveal(got, got.length ? "I premi della veglia" : "Premi riscattati", got.length ? null : "Pegni e ambra sono già nella tua borsa.");
    }).catch(function (e) { G.blip("no"); paintPass(); window.alert(e.message); });
  }

  /* ───────── eventi ───────── */
  sheet.addEventListener("click", function (e) {
    var t;
    if ((t = e.target.closest("#shopBack"))) { close(); return; }
    if ((t = e.target.closest("[data-tab]"))) { tab = t.dataset.tab; armed = null; paint(); return; }
    if ((t = e.target.closest("[data-arm]"))) { armed = t.dataset.arm; paintShop(); return; }
    if ((t = e.target.closest("[data-buy]"))) { buy(t.dataset.buy); return; }
    if ((t = e.target.closest("[data-objclaim]"))) { claimObjective(t.dataset.objclaim, t); return; }
    if ((t = e.target.closest("[data-claim]"))) {
      t.disabled = true;
      claim(Number(t.dataset.claim), t.dataset.track).then(function (cards) {
        paintPass();
        if (cards.length) reveal(cards, "Un premio della veglia");
        else G.blip("flip");
      }).catch(function (err) { G.blip("no"); t.disabled = false; window.alert(err.message); });
      return;
    }
    if ((t = e.target.closest("[data-act]"))) {
      var a = t.dataset.act;
      if (a === "closeReveal") { $("shopReveal").hidden = true; return; }
      if (a === "claimAll") { t.disabled = true; claimAll(); return; }
      if (a === "toShop") { tab = "bottega"; paint(); return; }
      if (a === "retry") { Cloud().retry().then(paint); return; }
    }
    // Un tocco altrove annulla la conferma in sospeso.
    if (armed) { armed = null; paintShop(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !sheet.hidden) { if (!$("shopReveal").hidden) $("shopReveal").hidden = true; else close(); }
  });

  var shopBtn = document.getElementById("shopButton");
  if (shopBtn) shopBtn.addEventListener("click", function () { open("bottega"); });
  var passBtn = document.getElementById("passButton");
  if (passBtn) passBtn.addEventListener("click", function () { open("pass"); });
  var objBtn = document.getElementById("objButton");
  if (objBtn) objBtn.addEventListener("click", function () { open("obiettivi"); });

  // Sulla soglia: quanti premi del pass e degli obiettivi aspettano.
  function badge() {
    var b = document.getElementById("passButton");
    if (b) {
      var ps = S().pass;
      var n = 0;
      if (ps) {
        var tier = Math.min(TIERS, Math.floor((ps.xp || 0) / PER_TIER));
        for (var t = 1; t <= tier; t++) {
          if (!ps.claimed[("free:" + t)]) n++;
          if (ps.premium && !ps.claimed[("premium:" + t)]) n++;
        }
      }
      b.innerHTML = "Pass della veglia" + (n ? ' <small class="new-badge">' + n + "</small>" : "");
    }
    var ob = document.getElementById("objButton");
    if (ob) {
      var ready = objData ? (objData.list || []).filter(function (o) { return !o.claimed && o.progress >= o.target; }).length : 0;
      ob.innerHTML = "Obiettivi" + (ready ? ' <small class="new-badge">' + ready + "</small>" : "");
    }
  }
  // Gli obiettivi si rileggono quando torni alla soglia (al massimo ogni 20 secondi).
  var objFetched = 0;
  function refreshObjectives() {
    var c = Cloud();
    if (!c || !c.online() || Date.now() - objFetched < 20000) return;
    objFetched = Date.now();
    c.objectives().then(function (d) { objData = d; badge(); }).catch(function () {});
  }
  var prev = G.onMenu;
  G.onMenu = function () { if (prev) prev(); refreshObjectives(); badge(); };
  if (Cloud()) Cloud().on(function () { refreshObjectives(); badge(); if (!sheet.hidden) wallet(); });
  badge();

  window.SigilNegozio = { open: open };
})();
