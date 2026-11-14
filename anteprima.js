"use strict";

/*
 * SIGIL — scelta della versione della soglia e modalità anteprima.
 *
 * ?menu=a|b|c   sceglie la versione della schermata principale (resta ricordata).
 * ?anteprima    apre la soglia di un Custode finto, senza intro, senza registro
 *               online e senza salvare nulla: serve a fotografare le schermate
 *               a ogni formato (telefono, Fold, Flip, desktop).
 * Va caricato dopo engine.js e prima di game.js.
 */
(function () {
  var q = new URLSearchParams(location.search);
  var MENUS = ["a", "b", "c"];
  var pick = q.get("menu");
  try {
    if (pick && MENUS.indexOf(pick) >= 0) localStorage.setItem("sigil-menu", pick);
    pick = localStorage.getItem("sigil-menu");
  } catch (e) { /* navigazione privata */ }
  if (!pick || MENUS.indexOf(pick) < 0) pick = "b";
  document.documentElement.setAttribute("data-menu", pick);

  // Selettore provvisorio, finché non si sceglie la versione definitiva.
  var links = document.querySelector(".menu-links");
  if (links) {
    var box = document.createElement("span");
    box.className = "menu-pick";
    box.innerHTML = "Soglia: " + MENUS.map(function (m) {
      return '<button type="button" class="text-button' + (m === pick ? " on" : "") + '" data-menu-pick="' + m + '">' + m.toUpperCase() + "</button>";
    }).join("");
    links.appendChild(box);
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-menu-pick]");
      if (!b) return;
      try { localStorage.setItem("sigil-menu", b.dataset.menuPick); } catch (x) { /* ignora */ }
      document.documentElement.setAttribute("data-menu", b.dataset.menuPick);
      Array.prototype.forEach.call(box.children, function (c) { c.classList.toggle("on", c === b); });
    });
  }

  if (!q.has("anteprima")) return;
  window.SIGIL_ANTEPRIMA = true;
  try { sessionStorage.setItem("sigil-intro", "1"); } catch (e) { /* ignora */ }
  var E = window.Lume;
  var mine = E.CARDS.filter(function (c) { return c.house === "congrega"; }).slice(0, 13)
    .concat(E.CARDS.filter(function (c) { return c.house !== "congrega"; }).slice(0, 7));
  var col = {};
  mine.forEach(function (c) { col[c.id] = 1; });
  var fake = {
    sworn: "congrega", house: "congrega", name: "Custode", collection: col,
    deck: mine.slice(0, 12).map(function (c) { return c.id; }),
    level: 4, xp: 62, gettoni: 48, ambra: 300, wins: 7, losses: 4, ties: 1, streak: 2, bestStreak: 3,
    journey: { unlocked: 5, stars: { 1: 3, 2: 2, 3: 3, 4: 1 } },
    pass: { season: 1, xp: 340, premium: false, claimed: {} }, daily: {}, sound: false
  };
  // Il gioco legge il salvataggio da qui; in anteprima non si scrive niente di vero.
  var real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (this === window.localStorage && k === "lume-v1") return; return real.call(this, k, v); };
  var get = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) { if (this === window.localStorage && k === "lume-v1") return JSON.stringify(fake); return get.call(this, k); };
})();
