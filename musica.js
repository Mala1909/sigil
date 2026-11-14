"use strict";

/*
 * SIGIL — la musica.
 *
 * Ogni momento ha il suo brano (scelte del 14 nov, vedi MUSICHE.md e CREDITS.md):
 *   soglia e schermate ............ Exploration
 *   Duello, partite libere, Veglia,
 *   Viaggio capitolo I ............ The Old Tower Inn / The Bard's Tale, a turno
 *   Viaggio capitolo II e V ....... Echoes of the Past
 *   Viaggio capitoli III e IV ..... Unforgiving Lands
 *   nemici finali (6, 12, 18, 24) . Incantation
 *   il Dormiente (tappa 30) ....... Dark Descent (Extended Cut)
 *   fine veglia ................... Victory / Defeat, una volta sola
 *
 * I brani girano in loop con una dissolvenza tra la fine e l'inizio, come i video,
 * così non si sente la ripartenza. Il volume passa da Web Audio (anche su iPhone,
 * dove il volume degli elementi audio non si può cambiare). La musica parte al
 * primo tocco o tasto, come vogliono i browser, e tace quando l'app non è in vista.
 */
(function () {
  var G = window.SigilGame;
  if (!G) return;

  var DIR = "audio/";
  var TRACKS = {
    exploration: { file: "exploration.mp3", title: "Medieval: Exploration", author: "RandomMind", fade: 4 },
    inn: { file: "old_tower_inn.mp3", title: "Medieval: The Old Tower Inn", author: "RandomMind", fade: 1.2 },
    bard: { file: "bards_tale.mp3", title: "Medieval: The Bard's Tale", author: "RandomMind", fade: 1.2 },
    lands: { file: "unforgiving_lands.mp3", title: "Unforgiving Lands", author: "HorrorPen", fade: 4 },
    echoes: { file: "echoes_of_the_past.mp3", title: "Echoes of the Past", author: "isaiah658", fade: 2 },
    incantation: { file: "incantation.mp3", title: "Incantation", author: "Scott Buckley", fade: 5 },
    descent: { file: "dark_descent.mp3", title: "Dark Descent (Extended Cut)", author: "Matthew Pablo", fade: 4 },
    victory: { file: "victory.mp3", title: "Medieval: Victory Theme", author: "RandomMind", once: true },
    defeat: { file: "defeat.mp3", title: "Medieval: Defeat Theme", author: "RandomMind", once: true }
  };

  var ctx = null;
  var master = null;
  var unlocked = false;
  var wanted = null;    // il brano che il momento richiede
  var current = null;   // { key, voices: [voce attiva, voce di riserva], ... }
  var calmTurn = 0;
  var tick = null;

  function save() { return G.save(); }
  function volume() {
    var s = save();
    if (s.muted) return 0;
    return s.musicVol == null ? 0.6 : Math.max(0, Math.min(1, s.musicVol));
  }

  function ensure() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume();
      master.connect(ctx.destination);
      return true;
    } catch (e) { ctx = null; return false; }
  }

  // Una «voce»: un elemento audio collegato al proprio guadagno.
  function voice(key) {
    var t = TRACKS[key];
    var el = new Audio();
    el.preload = "auto";
    el.src = DIR + t.file;
    var node = ctx.createMediaElementSource(el);
    var gain = ctx.createGain();
    gain.gain.value = 0;
    node.connect(gain);
    gain.connect(master);
    return { el: el, gain: gain };
  }

  function ramp(v, to, secs) {
    var now = ctx.currentTime;
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(v.gain.gain.value, now);
    v.gain.gain.linearRampToValueAtTime(to, now + Math.max(0.05, secs));
  }

  function stopVoice(v, secs) {
    if (!v) return;
    ramp(v, 0, secs);
    setTimeout(function () { try { v.el.pause(); v.el.removeAttribute("src"); v.el.load(); } catch (e) { /* ignora */ } }, secs * 1000 + 120);
  }

  function stopCurrent(secs) {
    if (!current) return;
    current.voices.forEach(function (v) { stopVoice(v, secs); });
    current = null;
  }

  function startTrack(key, fadeIn) {
    var t = TRACKS[key];
    var first = voice(key);
    current = { key: key, voices: [first], once: !!t.once };
    var p = first.el.play();
    if (p && p.catch) p.catch(function () { /* riprovo al prossimo tocco */ unlocked = false; });
    ramp(first, 1, fadeIn);
    emit();
  }

  // Il loop: poco prima della fine parte una seconda copia dall'inizio e le due sfumano.
  function loopCheck() {
    if (!current || current.once || !ctx) return;
    var t = TRACKS[current.key];
    var a = current.voices[0];
    var d = a.el.duration;
    if (!d || !isFinite(d) || current.voices.length > 1) return;
    if (a.el.currentTime >= d - t.fade - 0.15) {
      var b = voice(current.key);
      current.voices.push(b);
      var p = b.el.play();
      if (p && p.catch) p.catch(function () {});
      ramp(b, 1, t.fade);
      ramp(a, 0, t.fade);
      var cur = current;
      setTimeout(function () {
        if (current !== cur) return;
        try { a.el.pause(); a.el.removeAttribute("src"); a.el.load(); } catch (e) { /* ignora */ }
        cur.voices = [b];
      }, t.fade * 1000 + 200);
    }
  }

  function play(key) {
    wanted = key;
    if (!unlocked || !ensure()) return;
    if (current && current.key === key) return;
    var out = current && current.once ? 1.2 : 2;
    stopCurrent(out);
    if (!key) { emit(); return; }
    startTrack(key, TRACKS[key].once ? 0.3 : 2.5);
    if (!tick) tick = setInterval(loopCheck, 250);
  }

  /* ───────── quale brano per quale momento ───────── */
  function forMatch(d) {
    var o = d.opts || {};
    var n = Number(o.journeyLevel) || 0;
    if (d.mode === "viaggio" && n) {
      if (n >= 30) return "descent";
      if (n % 6 === 0) return "incantation";
      var chapter = Math.ceil(n / 6);
      if (chapter === 2 || chapter === 5) return "echoes";
      if (chapter === 3 || chapter === 4) return "lands";
    }
    calmTurn = (calmTurn + 1) % 2;
    return calmTurn ? "inn" : "bard";
  }

  window.addEventListener("sigil:match", function (e) {
    var d = e.detail || {};
    if (d.phase === "start") play(forMatch(d));
    else if (d.phase === "over") play(d.winner === "you" ? "victory" : d.winner === "rival" ? "defeat" : null);
    else if (d.phase === "leave") play("exploration");
  });

  // I browser lasciano partire l'audio solo dopo un gesto: il primo tocco accende la musica.
  function unlock() {
    if (unlocked) return;
    if (!ensure()) return;
    unlocked = true;
    if (ctx.state === "suspended") ctx.resume();
    if (!wanted) wanted = G.match() ? forMatch({ mode: G.match().mode, opts: {} }) : "exploration";
    var w = wanted;
    wanted = null;
    play(w);
  }
  ["pointerdown", "keydown", "touchend"].forEach(function (ev) { window.addEventListener(ev, unlock, { capture: true, passive: true }); });

  // App in secondo piano: silenzio. Torna in vista: riprende.
  document.addEventListener("visibilitychange", function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (unlocked) ctx.resume();
  });

  function setVolume() {
    if (!master || !ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(volume(), ctx.currentTime, 0.05);
  }

  var listeners = [];
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) { /* ignora */ } }); }

  window.SigilMusica = {
    TRACKS: TRACKS,
    setVolume: setVolume,
    playing: function () { return current ? TRACKS[current.key] : null; },
    on: function (fn) { listeners.push(fn); }
  };
})();
