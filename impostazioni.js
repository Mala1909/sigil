"use strict";

/*
 * SIGIL — impostazioni e crediti.
 *
 * Il pulsante ⚙ è sempre raggiungibile: in partita sta nella barra in alto,
 * altrove galleggia in basso a sinistra sopra ogni schermata. Dentro:
 * volume della musica, volume degli effetti, silenzio totale e i crediti
 * (gli stessi di CREDITS.md, come chiedono le licenze dei brani).
 */
(function () {
  var G = window.SigilGame;
  if (!G) return;
  var app = document.getElementById("app");

  var CREDITS = {
    musica: [
      { what: "Medieval: Exploration", who: "RandomMind", lic: "CC0", url: "https://opengameart.org/content/medieval-exploration" },
      { what: "Medieval: The Old Tower Inn", who: "RandomMind", lic: "CC0", url: "https://opengameart.org/content/medieval-the-old-tower-inn" },
      { what: "Medieval: The Bard's Tale", who: "RandomMind", lic: "CC0", url: "https://opengameart.org/content/medieval-the-bards-tale" },
      { what: "Medieval: Victory Theme", who: "RandomMind", lic: "CC0", url: "https://opengameart.org/content/medieval-victory-theme" },
      { what: "Medieval: Defeat Theme", who: "RandomMind", lic: "CC0", url: "https://opengameart.org/content/medieval-defeat-theme" },
      { what: "Unforgiving Lands", who: "HorrorPen", lic: "CC BY 3.0", licUrl: "https://creativecommons.org/licenses/by/3.0/", url: "https://opengameart.org/content/unforgiving-lands" },
      { what: "Echoes of the Past", who: "isaiah658", lic: "CC0", url: "https://opengameart.org/content/echoes-of-the-past" },
      { what: "Incantation", who: "Scott Buckley", lic: "CC BY 4.0", licUrl: "https://creativecommons.org/licenses/by/4.0/", url: "https://www.scottbuckley.com.au/library/incantation/" },
      { what: "Dark Descent (Extended Cut)", who: "Matthew Pablo", lic: "CC BY 3.0", licUrl: "https://creativecommons.org/licenses/by/3.0/", url: "https://opengameart.org/content/dark-descent-extended-cut" }
    ],
    caratteri: [
      { what: "Cinzel", who: "Natanael Gama", lic: "SIL Open Font License 1.1", url: "https://fonts.google.com/specimen/Cinzel" },
      { what: "Cormorant Garamond", who: "Christian Thalmann", lic: "SIL Open Font License 1.1", url: "https://fonts.google.com/specimen/Cormorant+Garamond" }
    ],
    librerie: [
      { what: "supabase-js", who: "Supabase", lic: "MIT", url: "https://github.com/supabase/supabase-js" },
      { what: "PeerJS", who: "PeerJS", lic: "MIT", url: "https://github.com/peers/peerjs" }
    ]
  };

  function esc(s) { return G.esc(String(s)); }
  function save() { return G.save(); }

  /* ───────── il pulsante che galleggia ───────── */
  var fab = document.createElement("button");
  fab.type = "button";
  fab.className = "settings-fab";
  fab.id = "settingsFab";
  fab.setAttribute("aria-label", "Impostazioni");
  fab.title = "Impostazioni";
  fab.textContent = "⚙";
  document.body.appendChild(fab);
  fab.addEventListener("click", function () { open(); });

  var gameBtn = document.getElementById("soundButton");
  if (gameBtn) {
    gameBtn.textContent = "⚙";
    gameBtn.setAttribute("aria-label", "Impostazioni");
    gameBtn.removeAttribute("aria-pressed");
    gameBtn.title = "Impostazioni";
  }

  /* ───────── la finestra ───────── */
  var box = document.createElement("div");
  box.className = "modal settings-box";
  box.id = "settingsBox";
  box.hidden = true;
  box.innerHTML = '<div class="modal-card settings-card" role="dialog" aria-modal="true" aria-labelledby="settingsTitle"></div>';
  document.body.appendChild(box);
  var card = box.firstChild;
  var view = "main";

  function pct(v, d) { return Math.round((v == null ? d : v) * 100); }

  function paintMain() {
    var s = save();
    var now = window.SigilMusica && window.SigilMusica.playing();
    card.innerHTML =
      '<p class="eyebrow">SIGIL</p><h2 id="settingsTitle">Impostazioni</h2>' +
      '<div class="set-row"><label for="setMusic">Musica</label><input type="range" id="setMusic" min="0" max="100" step="5" value="' + pct(s.musicVol, 0.6) + '"><output id="setMusicOut">' + pct(s.musicVol, 0.6) + "</output></div>" +
      '<div class="set-row"><label for="setSfx">Effetti</label><input type="range" id="setSfx" min="0" max="100" step="5" value="' + pct(s.sfxVol, 1) + '"><output id="setSfxOut">' + pct(s.sfxVol, 1) + "</output></div>" +
      '<label class="set-switch"><input type="checkbox" id="setMute"' + (s.muted ? " checked" : "") + "><span>Silenzio totale</span></label>" +
      '<label class="set-switch"><input type="checkbox" id="setClock"' + (s.noClock ? "" : " checked") + "><span>Tempo per ogni ora contro l'Ombra (40 secondi; nel Duello c'è sempre)</span></label>" +
      '<p class="set-now">' + (s.muted ? "Tutto in silenzio." : now ? "In sottofondo: <b>" + esc(now.title) + "</b> · " + esc(now.author) : "La musica parte al primo tocco.") + "</p>" +
      '<div class="modal-actions"><button type="button" class="button ghost" data-act="credits">Crediti</button>' +
      '<button type="button" class="button primary" data-act="close">Chiudi</button></div>';
  }

  function list(items) {
    return "<ul class=\"credits-list\">" + items.map(function (c) {
      var lic = c.licUrl ? '<a href="' + c.licUrl + '" target="_blank" rel="noopener">' + esc(c.lic) + "</a>" : esc(c.lic);
      return '<li><a href="' + c.url + '" target="_blank" rel="noopener"><b>' + esc(c.what) + "</b></a><span>" + esc(c.who) + " · " + lic + "</span></li>";
    }).join("") + "</ul>";
  }

  function paintCredits() {
    card.innerHTML =
      '<p class="eyebrow">SIGIL</p><h2 id="settingsTitle">Crediti</h2>' +
      '<div class="credits">' +
        "<h3>Il gioco</h3><p>SIGIL, duello di carte originale. Ideato e realizzato da Mala1909. Regole, carte, mondo e testi sono originali.</p>" +
        "<h3>Musica</h3>" + list(CREDITS.musica) +
        '<p class="credits-note">I brani CC0 sono di pubblico dominio. Per i brani CC BY il nome dell\'autore è dovuto: grazie a HorrorPen, Scott Buckley e Matthew Pablo. Il volume dei brani è stato uniformato.</p>' +
        "<h3>Illustrazioni e video</h3><p>Dipinti e video creati per SIGIL, con l'aiuto di Google Gemini e Pollinations.</p>" +
        "<h3>Caratteri</h3>" + list(CREDITS.caratteri) +
        "<h3>Librerie</h3>" + list(CREDITS.librerie) +
      "</div>" +
      '<div class="modal-actions"><button type="button" class="button ghost" data-act="back">Indietro</button>' +
      '<button type="button" class="button primary" data-act="close">Chiudi</button></div>';
    card.scrollTop = 0;
  }

  function paint() { if (view === "credits") paintCredits(); else paintMain(); }

  function open(which) {
    view = which || "main";
    paint();
    box.hidden = false;
    sync();
  }
  function close() { box.hidden = true; sync(); }

  box.addEventListener("click", function (e) {
    if (e.target === box) return close();
    var t = e.target.closest("[data-act]");
    if (!t) return;
    var act = t.dataset.act;
    if (act === "close") close();
    else if (act === "credits") { view = "credits"; paint(); }
    else if (act === "back") { view = "main"; paint(); }
  });
  box.addEventListener("input", function (e) {
    var s = save();
    if (e.target.id === "setMusic") {
      s.musicVol = Number(e.target.value) / 100;
      card.querySelector("#setMusicOut").textContent = e.target.value;
      if (s.muted && s.musicVol > 0) { s.muted = false; card.querySelector("#setMute").checked = false; }
    } else if (e.target.id === "setSfx") {
      s.sfxVol = Number(e.target.value) / 100;
      card.querySelector("#setSfxOut").textContent = e.target.value;
    } else return;
    apply();
  });
  box.addEventListener("change", function (e) {
    if (e.target.id === "setSfx") G.blip("play");
    if (e.target.id === "setClock") { save().noClock = !e.target.checked; G.persist(); return; }
    if (e.target.id !== "setMute") return;
    save().muted = e.target.checked;
    apply();
    paint();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !box.hidden) { e.stopPropagation(); close(); }
  }, true);

  function apply() {
    var s = save();
    if (G.setSound) G.setSound(!s.muted && (s.sfxVol == null || s.sfxVol > 0));
    else G.persist();
    if (window.SigilMusica) window.SigilMusica.setVolume();
  }

  // Il pulsante che galleggia sparisce in partita (c'è quello nella barra) e durante l'intro.
  function sync() {
    var intro = document.body.classList.contains("intro-on");
    fab.hidden = intro || app.classList.contains("playing") || !box.hidden;
  }
  new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  if (window.SigilMusica) window.SigilMusica.on(function () { if (!box.hidden && view === "main") paintMain(); });
  sync();

  // Anche dalla soglia, dove di solito stanno: «Crediti» accanto al grimorio.
  var links = document.querySelector(".menu-links");
  if (links) {
    var cr = document.createElement("button");
    cr.type = "button";
    cr.className = "text-button";
    cr.textContent = "Crediti";
    links.appendChild(cr);
    cr.addEventListener("click", function () { open("credits"); });
  }

  window.SigilImpostazioni = { open: open, close: close, CREDITS: CREDITS };
})();
