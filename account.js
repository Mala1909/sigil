"use strict";

/*
 * SIGIL — Il profilo del Custode: collegarlo a un'email o rientrarci.
 *
 * Senza email il profilo vive solo in questo browser (accesso anonimo).
 * Con l'email lo ritrovi ovunque: sul sito, nell'app, su un altro computer.
 * Niente password: il registro manda un codice per email e lo scrivi qui.
 */
(function () {
  var cloud = window.SigilCloud;
  var G = window.SigilGame;
  if (!cloud || !G) return;

  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var mode = "link"; // link: collega questo profilo · login: entra in un profilo che ha già l'email
  var step = "email"; // email · code · done
  var email = "";
  var busy = false;

  var box = document.createElement("div");
  box.className = "modal";
  box.id = "accountBox";
  box.hidden = true;
  box.innerHTML = '<div class="modal-card account-card" role="dialog" aria-modal="true" aria-labelledby="accountTitle"></div>';
  document.getElementById("app").appendChild(box);
  var card = box.firstChild;

  function esc(s) { return G.esc ? G.esc(s) : String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function paint(who, error) {
    var html = '<svg class="end-sigil account-sigil"><use href="#g-sigillo"/></svg>';
    if (step === "done" || (who && !who.anonymous && step === "email" && mode === "link")) {
      html += '<h2 id="accountTitle">Profilo al sicuro</h2>' +
        "<p>Il tuo profilo è legato a <b>" + esc(who && who.email || email) + "</b>. Lo ritrovi su qualsiasi dispositivo: basta entrare con questa email.</p>" +
        '<div class="modal-actions"><button type="button" class="button ghost" data-act="switch">Entra con un\'altra email</button>' +
        '<button type="button" class="button primary" data-act="close">Chiudi</button></div>';
    } else if (step === "email") {
      if (mode === "link") {
        html += '<h2 id="accountTitle">Salva i progressi</h2>' +
          "<p>Oggi il tuo profilo vive solo in questo browser: se cancelli i dati o cambi dispositivo, lo perdi. Collegalo alla tua email e lo ritrovi ovunque, anche nell'app.</p>";
      } else {
        html += '<h2 id="accountTitle">Entra con la tua email</h2>' +
          "<p>Per riprendere un profilo che hai già collegato a un'email. Il profilo di questo browser, se non ha un'email, resta qui senza essere usato.</p>";
      }
      html += '<form class="account-form" data-form="email" autocomplete="on">' +
        '<input type="email" name="email" autocomplete="email" placeholder="la tua email" value="' + esc(email) + '" required aria-label="Email">' +
        (error ? '<p class="account-error">' + esc(error) + "</p>" : "") +
        '<button type="submit" class="button primary"' + (busy ? " disabled" : "") + ">" + (busy ? "Mando il codice…" : "Mandami il codice") + "</button></form>" +
        '<p class="account-alt">' + (mode === "link"
          ? '<button type="button" class="text-button" data-act="login">Hai già un profilo con email? Entra</button>'
          : '<button type="button" class="text-button" data-act="link">Collega invece questo profilo</button>') +
        '<button type="button" class="text-button" data-act="close">Più tardi</button></p>';
    } else {
      html += '<h2 id="accountTitle">Controlla l\'email</h2>' +
        "<p>Ho scritto a <b>" + esc(email) + "</b> (guarda anche nello spam).</p>" +
        (mode === "link"
          ? "<p class=\"account-how\">Se l'email ha un <b>link</b>, aprilo (va bene anche dal telefono) e poi tocca «Ho aperto il link». Se ha un <b>codice</b>, scrivilo qui sotto.</p>" +
            '<button type="button" class="button primary account-linked" data-act="linked"' + (busy ? " disabled" : "") + ">Ho aperto il link</button>"
          : "<p class=\"account-how\">Se l'email ha un <b>link</b>, aprilo su questo computer: il gioco si riapre già dentro il tuo profilo. Se ha un <b>codice</b>, scrivilo qui sotto.</p>") +
        '<form class="account-form" data-form="code" autocomplete="off">' +
        '<input name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="il codice" maxlength="10" required aria-label="Codice ricevuto per email">' +
        (error ? '<p class="account-error">' + esc(error) + "</p>" : "") +
        '<button type="submit" class="button primary"' + (busy ? " disabled" : "") + ">" + (busy ? "Controllo…" : "Conferma") + "</button></form>" +
        '<p class="account-alt"><button type="button" class="text-button" data-act="back">Cambia email o rimanda</button>' +
        '<button type="button" class="text-button" data-act="close">Annulla</button></p>';
    }
    card.innerHTML = html;
    var input = card.querySelector("input");
    if (input && !busy) setTimeout(function () { input.focus(); }, 30);
  }

  function refresh(error) { return cloud.account().then(function (who) { paint(who, error); return who; }, function () { paint(null, error); }); }

  function open(m) {
    mode = m || "link";
    step = "email";
    busy = false;
    box.hidden = false;
    paint(null);
    refresh();
  }
  function close() { box.hidden = true; button(); }

  box.addEventListener("click", function (e) {
    if (e.target === box) return close();
    var t = e.target.closest("[data-act]");
    if (!t || busy) return;
    var act = t.dataset.act;
    if (act === "close") close();
    else if (act === "login" || act === "switch") { mode = "login"; step = "email"; paint(null); }
    else if (act === "link") { mode = "link"; step = "email"; refresh(); }
    else if (act === "back") { step = "email"; paint(null); }
    else if (act === "linked") {
      busy = true; paint(null);
      cloud.checkLinked().then(function (who) {
        busy = false;
        if (who && !who.anonymous) { step = "done"; paint(who); button(); }
        else paint(null, "Il registro non vede ancora la conferma: apri il link nell'email e riprova.");
      }, function (err) { busy = false; paint(null, err.message); });
    }
  });

  box.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    var form = e.target;
    if (form.dataset.form === "email") {
      var v = form.email.value.trim().toLowerCase();
      if (!EMAIL.test(v)) return paint(null, "L'indirizzo email non sembra valido.");
      email = v;
      busy = true; paint(null);
      (mode === "link" ? cloud.linkEmail(email) : cloud.sendLogin(email)).then(function () {
        busy = false; step = "code"; paint(null);
      }, function (err) { busy = false; paint(null, err.message); });
    } else {
      var code = form.code.value.replace(/\D/g, "");
      if (code.length < 6) return paint(null, "Il codice ha almeno 6 cifre.");
      busy = true; paint(null);
      if (mode === "link") {
        cloud.confirmLink(email, code).then(function (who) {
          busy = false; step = "done"; paint(who); button();
        }, function (err) { busy = false; paint(null, err.message); });
      } else {
        cloud.confirmLogin(email, code).then(function () {
          // Profilo nuovo per questo browser: ricarico tutto dal registro.
          card.innerHTML = '<svg class="end-sigil account-sigil"><use href="#g-sigillo"/></svg><h2>Bentornato, Custode</h2><p>Riprendo il tuo profilo…</p>';
          try { sessionStorage.setItem("sigil-intro", "1"); } catch (x) {}
          setTimeout(function () { location.reload(); }, 700);
        }, function (err) { busy = false; paint(null, err.message); });
      }
    }
  });

  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !box.hidden) { e.stopPropagation(); close(); } }, true);

  // Il pulsante sulla soglia: dice se il profilo è al sicuro.
  var links = document.querySelector(".menu-links");
  var btn = document.createElement("button");
  btn.type = "button";
  btn.id = "accountButton";
  btn.className = "text-button account-button";
  btn.textContent = "Salva i progressi";
  if (links) links.insertBefore(btn, links.firstChild);
  btn.addEventListener("click", function () { open("link"); });

  function button() {
    if (!cloud.online()) { btn.hidden = true; return; }
    cloud.account().then(function (who) {
      btn.hidden = !who;
      if (!who) return;
      if (who.anonymous) { btn.textContent = "Salva i progressi con l'email"; btn.classList.add("warn"); btn.title = "Il profilo vive solo in questo browser"; }
      else { btn.textContent = "✓ " + who.email; btn.classList.remove("warn"); btn.title = "Profilo collegato all'email"; }
    }, function () {});
  }
  cloud.on(button);
  button();

  window.SigilAccount = { open: open };
})();
