"use strict";

/*
 * SIGIL — modalità anteprima.
 *
 * ?anteprima    apre la soglia di un Custode finto, senza intro, senza registro
 *               online e senza salvare nulla: serve a fotografare le schermate
 *               a ogni formato (telefono, Fold, Flip, desktop).
 * Va caricato dopo engine.js e prima di game.js.
 */
(function () {
  var q = new URLSearchParams(location.search);
  // Dal 16 nov c'è una sola soglia, la sala del Custode (soglia.js): niente più versioni B e C.
  document.documentElement.setAttribute("data-menu", "sala");
  try { localStorage.removeItem("sigil-menu"); } catch (e) { /* navigazione privata */ }

  if (!q.has("anteprima")) return;
  window.SIGIL_ANTEPRIMA = true;
  // ?anteprima&intro lascia vedere anche l'intro
  try { if (!q.has("intro")) sessionStorage.setItem("sigil-intro", "1"); } catch (e) { /* ignora */ }
  var E = window.Lume;
  var mine = E.CARDS.filter(function (c) { return c.house === "congrega"; }).slice(0, 13)
    .concat(E.CARDS.filter(function (c) { return c.house !== "congrega"; }).slice(0, 7));
  var col = {};
  mine.forEach(function (c) { col[c.id] = 1; });
  var fake = {
    sworn: "congrega", house: "congrega", name: "Custode", collection: col,
    deck: mine.slice(0, 12).map(function (c) { return c.id; }),
    level: 4, xp: 62, gettoni: 48, ambra: 300, inchiostro: 85, evo: (function () { var e = {}; mine.slice(0, 12).forEach(function (c, i) { e[c.id] = i < 2 ? 5 : 2; }); return e; })(), wins: 7, losses: 4, ties: 1, streak: 2, bestStreak: 3,
    journey: { unlocked: 5, stars: { 1: 3, 2: 2, 3: 3, 4: 1 } },
    pass: { season: 1, xp: 340, premium: false, claimed: {} }, pvp: { w: 5, l: 3, t: 1, rating: 1043 }, daily: {}, sound: false
  };
  // Il gioco legge il salvataggio da qui; in anteprima non si scrive niente di vero.
  var real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (this === window.localStorage && k === "lume-v1") return; return real.call(this, k, v); };
  var get = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) { if (this === window.localStorage && k === "lume-v1") return JSON.stringify(fake); return get.call(this, k); };
})();
