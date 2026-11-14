"use strict";

/* Illustrazioni originali di LUME. Stile manifesto notturno, non un fumetto di supereroi. */
(function (root) {
  var INK = "#1b140f";
  var SKIN = "#e4c2a2";
  var CREAM = "#f4e7d0";
  var LAMP = "#f0b429";
  var BLOOD = "#8d3a32";
  var GREEN = "#2c6b4e";
  var NIGHT = "#14383c";
  var STONE = "#d4c2a4";
  var COBBLE = "#b7a488";
  var TEAL = "#1e5854";
  var WOOL = "#243832";

  function svg(w, h, body) {
    return '<svg viewBox="0 0 ' + w + " " + h + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + body + "</svg>";
  }

  function stage() {
    return '<rect width="200" height="230" fill="' + NIGHT + '"/>' +
      '<circle cx="164" cy="28" r="13" fill="' + CREAM + '"/>' +
      '<circle cx="164" cy="28" r="22" fill="' + CREAM + '" opacity=".18"/>' +
      '<ellipse cx="28" cy="6" rx="64" ry="42" fill="' + LAMP + '" opacity=".22"/>' +
      '<rect y="168" width="200" height="62" fill="' + STONE + '"/>' +
      '<ellipse cx="36" cy="186" rx="24" ry="9" fill="' + COBBLE + '"/>' +
      '<ellipse cx="96" cy="194" rx="28" ry="9" fill="' + COBBLE + '"/>' +
      '<ellipse cx="158" cy="184" rx="22" ry="8" fill="' + COBBLE + '"/>';
  }

  function eye(x, y) {
    return '<circle cx="' + x + '" cy="' + y + '" r="1.7" fill="' + INK + '"/>';
  }

  function head(x, y, r) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + SKIN + '"/>' +
      eye(x - r * 0.32, y - r * 0.05) + eye(x + r * 0.28, y - r * 0.05);
  }

  function lampPost(x, y, h) {
    return '<rect x="' + (x - 3) + '" y="' + y + '" width="6" height="' + h + '" fill="' + INK + '"/>' +
      '<rect x="' + (x - 12) + '" y="' + (y - 8) + '" width="24" height="12" rx="3" fill="' + INK + '"/>' +
      '<rect x="' + (x - 8) + '" y="' + (y - 5) + '" width="16" height="7" rx="2" fill="' + LAMP + '"/>' +
      '<ellipse cx="' + x + '" cy="' + (y - 2) + '" rx="22" ry="16" fill="' + LAMP + '" opacity=".28"/>';
  }

  var cards = {
    corriere: function () {
      return stage() +
        '<path d="M48 150 l28 -46 18 8 -8 22 22 28 -16 8 -16 -22 -18 10z" fill="' + BLOOD + '"/>' +
        '<circle cx="78" cy="92" r="14" fill="' + SKIN + '"/>' +
        eye(73, 90) + eye(82, 89) +
        '<path d="M70 86 q8 -16 18 -2" fill="' + INK + '"/>' +
        '<rect x="96" y="118" width="22" height="16" rx="3" fill="' + LAMP + '" transform="rotate(18 107 126)"/>' +
        '<path d="M40 78 h34 M34 96 h28 M46 114 h22" stroke="' + CREAM + '" stroke-width="2" opacity=".7"/>';
    },
    gatto: function () {
      return stage() +
        '<rect x="118" y="78" width="54" height="90" fill="' + INK + '"/>' +
        '<rect x="132" y="96" width="22" height="28" fill="' + LAMP + '" opacity=".85"/>' +
        '<path d="M28 162 q20 -70 52 -58 q18 8 16 36 q28 -20 46 8 q-8 28 -30 24 q-6 18 -24 16 q-40 6 -60 -26z" fill="' + INK + '"/>' +
        '<path d="M46 96 l10 -16 10 14z" fill="' + INK + '"/>' +
        '<path d="M78 90 l12 -18 8 16z" fill="' + INK + '"/>' +
        '<circle cx="58" cy="112" r="3.2" fill="' + LAMP + '"/>' +
        '<circle cx="80" cy="110" r="3.2" fill="' + LAMP + '"/>' +
        '<path d="M146 150 q24 -8 28 16" fill="none" stroke="' + INK + '" stroke-width="6"/>';
    },
    lampione: function () {
      return '<rect width="200" height="230" fill="' + NIGHT + '"/>' +
        '<ellipse cx="100" cy="78" rx="70" ry="54" fill="' + LAMP + '" opacity=".28"/>' +
        '<rect x="94" y="88" width="12" height="120" fill="' + INK + '"/>' +
        '<rect x="64" y="52" width="72" height="36" rx="6" fill="' + INK + '"/>' +
        '<rect x="72" y="58" width="56" height="22" rx="4" fill="' + LAMP + '"/>' +
        '<circle cx="46" cy="64" r="3" fill="' + CREAM + '"/>' +
        '<circle cx="154" cy="48" r="2.4" fill="' + CREAM + '"/>' +
        '<circle cx="138" cy="78" r="2" fill="' + CREAM + '"/>' +
        '<circle cx="58" cy="92" r="2.2" fill="' + CREAM + '"/>' +
        '<rect y="196" width="200" height="34" fill="' + STONE + '"/>';
    },
    moneta: function () {
      return stage() +
        '<path d="M30 150 q40 -28 70 -8 q20 12 46 -6" fill="none" stroke="' + TEAL + '" stroke-width="8"/>' +
        '<circle cx="108" cy="78" r="36" fill="' + LAMP + '"/>' +
        '<circle cx="108" cy="78" r="26" fill="none" stroke="' + INK + '" stroke-width="3"/>' +
        '<circle cx="108" cy="78" r="8" fill="' + INK + '"/>' +
        '<path d="M70 168 q16 10 8 24 q20 -6 28 8 q-24 4 -36 -6z" fill="' + SKIN + '"/>';
    },
    briciola: function () {
      return stage() +
        '<path d="M78 168 l18 -52 22 52z" fill="' + BLOOD + '"/>' +
        head(96, 108, 12) +
        '<circle cx="40" cy="70" r="5" fill="' + INK + '"/>' +
        '<circle cx="150" cy="84" r="4" fill="' + INK + '"/>' +
        '<circle cx="132" cy="52" r="3.5" fill="' + INK + '"/>' +
        '<circle cx="70" cy="188" r="1.6" fill="' + CREAM + '"/>' +
        '<circle cx="88" cy="194" r="1.4" fill="' + CREAM + '"/>' +
        '<circle cx="112" cy="190" r="1.5" fill="' + CREAM + '"/>';
    },
    vigile: function () {
      return stage() +
        '<rect x="118" y="70" width="8" height="110" fill="' + INK + '"/>' +
        '<rect x="112" y="78" width="20" height="8" fill="' + CREAM + '"/>' +
        '<rect x="112" y="94" width="20" height="8" fill="' + CREAM + '"/>' +
        '<rect x="70" y="108" width="36" height="62" rx="8" fill="' + TEAL + '"/>' +
        head(88, 90, 15) +
        '<rect x="74" y="72" width="28" height="8" rx="2" fill="' + INK + '"/>' +
        '<circle cx="112" cy="124" r="5" fill="' + LAMP + '"/>';
    },
    nonna: function () {
      return stage() +
        '<rect x="18" y="118" width="164" height="10" fill="' + INK + '"/>' +
        '<rect x="28" y="128" width="8" height="28" fill="' + INK + '"/>' +
        '<rect x="164" y="128" width="8" height="28" fill="' + INK + '"/>' +
        '<circle cx="58" cy="112" r="9" fill="' + BLOOD + '"/>' +
        '<circle cx="100" cy="104" r="11" fill="' + BLOOD + '"/>' +
        '<circle cx="142" cy="112" r="9" fill="' + BLOOD + '"/>' +
        '<circle cx="58" cy="112" r="4" fill="' + GREEN + '"/>' +
        '<circle cx="100" cy="104" r="5" fill="' + GREEN + '"/>' +
        '<circle cx="142" cy="112" r="4" fill="' + GREEN + '"/>' +
        '<path d="M78 116 q16 -28 36 0 l-6 28 h-24z" fill="' + WOOL + '"/>' +
        head(96, 78, 14) +
        '<path d="M82 70 q14 -18 28 0" fill="' + CREAM + '"/>';
    },
    spia: function () {
      return stage() +
        '<rect x="46" y="132" width="36" height="8" fill="' + INK + '"/>' +
        '<rect x="58" y="140" width="8" height="28" fill="' + INK + '"/>' +
        '<rect x="108" y="96" width="62" height="44" rx="2" fill="' + CREAM + '"/>' +
        '<path d="M116 108 h46 M116 118 h40 M116 128 h34" stroke="' + INK + '" stroke-width="2" opacity=".45"/>' +
        head(92, 110, 16) +
        '<circle cx="124" cy="112" r="7" fill="' + CREAM + '"/>' +
        '<circle cx="124" cy="112" r="2" fill="' + INK + '"/>';
    },
    chiavi: function () {
      return stage() +
        '<rect x="120" y="36" width="46" height="132" fill="' + INK + '"/>' +
        '<rect x="132" y="58" width="22" height="36" fill="' + LAMP + '" opacity=".35"/>' +
        '<path d="M48 150 q10 -20 24 -8 q6 8 4 16z" fill="' + SKIN + '"/>' +
        '<circle cx="78" cy="70" r="10" fill="none" stroke="' + LAMP + '" stroke-width="4"/>' +
        '<rect x="86" y="66" width="28" height="6" fill="' + LAMP + '"/>' +
        '<circle cx="70" cy="102" r="8" fill="none" stroke="' + CREAM + '" stroke-width="4"/>' +
        '<rect x="76" y="98" width="34" height="5" fill="' + CREAM + '"/>' +
        '<circle cx="86" cy="132" r="9" fill="none" stroke="' + LAMP + '" stroke-width="4"/>' +
        '<rect x="93" y="128" width="30" height="5" fill="' + LAMP + '"/>';
    },
    folata: function () {
      return stage() +
        '<rect x="36" y="96" width="22" height="30" rx="2" fill="' + CREAM + '" transform="rotate(-28 47 111)"/>' +
        '<rect x="70" y="64" width="20" height="26" rx="2" fill="' + CREAM + '" transform="rotate(16 80 77)"/>' +
        '<rect x="108" y="78" width="24" height="28" rx="2" fill="' + LAMP + '" transform="rotate(-12 120 92)"/>' +
        '<path d="M40 150 q40 -50 90 -20 q-20 16 -8 34 q-30 -8 -46 8z" fill="' + TEAL + '"/>' +
        '<path d="M118 120 q40 10 28 36" fill="none" stroke="' + BLOOD + '" stroke-width="6"/>' +
        head(86, 108, 12);
    },
    barista: function () {
      return stage() +
        '<rect x="108" y="70" width="58" height="78" rx="6" fill="' + INK + '"/>' +
        '<circle cx="126" cy="96" r="10" fill="' + CREAM + '"/>' +
        '<circle cx="150" cy="96" r="10" fill="' + CREAM + '"/>' +
        '<rect x="146" y="64" width="6" height="22" fill="' + LAMP + '"/>' +
        '<path d="M124 78 q8 -16 4 -24 M146 74 q6 -14 2 -22" fill="none" stroke="' + CREAM + '" stroke-width="2"/>' +
        '<rect x="40" y="108" width="40" height="58" rx="10" fill="' + WOOL + '"/>' +
        head(60, 92, 15) +
        '<rect x="46" y="168" width="18" height="10" rx="2" fill="' + CREAM + '"/>';
    },
    poeta: function () {
      return stage() +
        '<rect x="24" y="132" width="150" height="18" fill="' + INK + '"/>' +
        '<rect x="70" y="112" width="34" height="28" rx="8" fill="' + TEAL + '"/>' +
        head(86, 96, 13) +
        '<path d="M112 118 h28 v20 h-28z" fill="' + CREAM + '"/>' +
        '<path d="M126 118 v20" stroke="' + INK + '" stroke-width="1"/>' +
        '<circle cx="150" cy="40" r="16" fill="' + CREAM + '" opacity=".9"/>';
    },
    suonatore: function () {
      return stage() +
        '<rect x="58" y="108" width="34" height="58" rx="8" fill="' + BLOOD + '"/>' +
        head(74, 90, 14) +
        '<path d="M96 124 l8 -8 8 8 8 -8 8 8 8 -8 8 8 v16 l-8 8 -8 -8 -8 8 -8 -8 -8 8 -8 -8z" fill="' + LAMP + '"/>' +
        '<circle cx="150" cy="70" r="4" fill="' + CREAM + '"/>' +
        '<circle cx="164" cy="88" r="3" fill="' + CREAM + '"/>' +
        '<circle cx="138" cy="58" r="2.5" fill="' + CREAM + '"/>';
    },
    gerani: function () {
      return stage() +
        '<rect x="24" y="150" width="152" height="16" rx="3" fill="' + INK + '"/>' +
        '<rect x="46" y="166" width="16" height="22" fill="' + INK + '"/>' +
        '<rect x="138" y="166" width="16" height="22" fill="' + INK + '"/>' +
        bloom(48, 96) + bloom(86, 78) + bloom(124, 92) + bloom(156, 70) + bloom(70, 124) + bloom(112, 118) + bloom(150, 120);
    },
    muretto: function () {
      return '<rect width="200" height="230" fill="' + NIGHT + '"/>' +
        '<circle cx="164" cy="24" r="11" fill="' + CREAM + '"/>' +
        stones() +
        '<circle cx="40" cy="150" r="5" fill="' + GREEN + '"/>' +
        '<circle cx="150" cy="188" r="4" fill="' + GREEN + '"/>' +
        '<circle cx="96" cy="210" r="3.5" fill="' + GREEN + '"/>';
    },
    espresso: function () {
      return stage() +
        '<rect x="42" y="132" width="40" height="22" rx="4" fill="' + CREAM + '"/>' +
        '<rect x="118" y="132" width="40" height="22" rx="4" fill="' + CREAM + '"/>' +
        '<path d="M52 132 q8 -28 16 0" fill="' + LAMP + '" opacity=".8"/>' +
        '<path d="M128 132 q8 -28 16 0" fill="' + LAMP + '" opacity=".8"/>' +
        '<path d="M62 108 q38 -40 76 4 q-20 -8 -38 8 q-16 -20 -38 -12z" fill="' + CREAM + '" opacity=".85"/>' +
        '<rect x="78" y="154" width="44" height="8" fill="' + INK + '"/>';
    },
    idraulico: function () {
      return stage() +
        '<path d="M120 150 h40 v14 h-16 v28 h-12 v-28 h-12z" fill="' + TEAL + '"/>' +
        '<path d="M108 70 h16 v46 h28 v14 h-44z" fill="' + LAMP + '"/>' +
        '<circle cx="116" cy="64" r="12" fill="' + LAMP + '"/>' +
        '<rect x="40" y="108" width="36" height="58" rx="8" fill="' + BLOOD + '"/>' +
        head(58, 92, 14) +
        '<path d="M36 150 q-8 8 0 16" fill="none" stroke="' + TEAL + '" stroke-width="4"/>' +
        '<circle cx="30" cy="168" r="3" fill="' + TEAL + '"/>' +
        '<circle cx="42" cy="176" r="2.4" fill="' + TEAL + '"/>';
    },
    pizzaiolo: function () {
      return stage() +
        '<path d="M24 86 a56 28 0 1 0 112 0 a40 16 0 1 1 -112 0" fill="' + CREAM + '"/>' +
        '<circle cx="78" cy="86" r="34" fill="' + LAMP + '" opacity=".55"/>' +
        '<rect x="128" y="96" width="52" height="70" rx="26" fill="' + INK + '"/>' +
        '<path d="M136 120 q22 16 32 0" fill="' + LAMP + '"/>' +
        '<rect x="24" y="112" width="28" height="46" rx="8" fill="' + WOOL + '"/>' +
        head(38, 98, 13);
    },
    capotreno: function () {
      return stage() +
        '<circle cx="150" cy="90" r="34" fill="' + INK + '"/>' +
        '<circle cx="150" cy="90" r="22" fill="' + LAMP + '" opacity=".75"/>' +
        '<rect x="52" y="104" width="34" height="60" rx="8" fill="' + TEAL + '"/>' +
        head(68, 88, 14) +
        '<path d="M52 78 h32 l-4 10 h-24z" fill="' + INK + '"/>' +
        '<rect x="96" y="78" width="4" height="46" fill="' + INK + '"/>' +
        '<rect x="100" y="78" width="22" height="16" fill="' + BLOOD + '"/>';
    },
    orologio: function () {
      return '<rect width="200" height="230" fill="' + NIGHT + '"/>' +
        '<rect x="0" y="150" width="200" height="80" fill="' + INK + '"/>' +
        '<circle cx="100" cy="108" r="62" fill="' + CREAM + '"/>' +
        '<circle cx="100" cy="108" r="52" fill="' + NIGHT + '"/>' +
        ticks() +
        '<rect x="97" y="70" width="6" height="40" fill="' + LAMP + '"/>' +
        '<rect x="97" y="105" width="34" height="6" fill="' + LAMP + '"/>' +
        '<circle cx="100" cy="108" r="5" fill="' + LAMP + '"/>' +
        '<circle cx="156" cy="36" r="14" fill="' + CREAM + '" opacity=".8"/>';
    },
    sindaca: function () {
      return stage() +
        '<rect x="18" y="150" width="28" height="40" fill="' + INK + '"/>' +
        '<rect x="154" y="146" width="30" height="46" fill="' + INK + '"/>' +
        '<rect x="78" y="96" width="44" height="74" rx="10" fill="' + WOOL + '"/>' +
        '<path d="M78 112 l44 28 v10 l-44 -24z" fill="' + BLOOD + '"/>' +
        head(100, 78, 16) +
        '<path d="M84 66 q16 -14 32 0 v8 h-32z" fill="' + INK + '"/>';
    },
    orchestra: function () {
      return stage() +
        '<circle cx="48" cy="150" r="16" fill="' + INK + '"/>' +
        '<rect x="70" y="118" width="8" height="40" fill="' + CREAM + '" transform="rotate(-20 74 138)"/>' +
        '<rect x="86" y="100" width="30" height="64" rx="8" fill="' + BLOOD + '"/>' +
        head(100, 84, 13) +
        '<rect x="128" y="108" width="28" height="56" rx="8" fill="' + TEAL + '"/>' +
        head(142, 92, 12) +
        '<path d="M118 70 l8 16 M128 64 l6 18" stroke="' + LAMP + '" stroke-width="3"/>';
    },
    inviato: function () {
      return stage() +
        '<path d="M96 168 l-8 -62 34 -6 18 68z" fill="' + WOOL + '"/>' +
        '<path d="M70 120 q-28 20 -16 42 q24 -8 28 -4z" fill="' + TEAL + '"/>' +
        head(112, 92, 14) +
        '<rect x="122" y="108" width="16" height="22" fill="' + CREAM + '" transform="rotate(12 130 119)"/>' +
        '<path d="M24 80 h30 M20 98 h24" stroke="' + CREAM + '" stroke-width="2" opacity=".7"/>';
    },
    camion: function () {
      return stage() +
        '<rect x="18" y="108" width="150" height="52" rx="6" fill="' + BLOOD + '"/>' +
        '<rect x="118" y="84" width="64" height="76" rx="6" fill="' + INK + '"/>' +
        '<rect x="128" y="94" width="28" height="22" fill="' + LAMP + '" opacity=".8"/>' +
        '<circle cx="52" cy="166" r="12" fill="' + INK + '"/>' +
        '<circle cx="148" cy="166" r="12" fill="' + INK + '"/>' +
        '<circle cx="36" cy="128" r="8" fill="' + LAMP + '"/>' +
        '<circle cx="36" cy="148" r="8" fill="' + LAMP + '"/>' +
        '<circle cx="168" cy="150" r="6" fill="' + SKIN + '"/>';
    },
    temporale: function () {
      return '<rect width="200" height="230" fill="#0e2428"/>' +
        '<path d="M16 70 q30 -36 62 -8 q20 -28 48 -6 q28 -20 52 8 v36 h-162z" fill="' + INK + '"/>' +
        '<path d="M108 96 l-16 36 h14 l-8 28 28 -40 h-14z" fill="' + LAMP + '"/>' +
        rain() +
        '<path d="M40 168 q16 -20 32 0 q-6 8 -16 6 q-8 6 -16 -6z" fill="' + BLOOD + '"/>' +
        '<path d="M124 172 q16 -18 30 0 q-8 8 -16 4 q-6 6 -14 -4z" fill="' + TEAL + '"/>' +
        '<rect y="196" width="200" height="34" fill="' + STONE + '"/>';
    }
  };

  function bloom(x, y) {
    return '<circle cx="' + x + '" cy="' + y + '" r="14" fill="' + BLOOD + '"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="5" fill="' + GREEN + '"/>';
  }

  function stones() {
    var out = "";
    var y, x;
    for (y = 70; y < 220; y += 28) {
      for (x = (y / 28) % 2 ? 8 : -6; x < 200; x += 36) {
        out += '<rect x="' + x + '" y="' + y + '" width="34" height="24" rx="2" fill="' + (x % 3 ? "#cbb89a" : "#b7a488") + '" stroke="' + INK + '" stroke-width="2"/>';
      }
    }
    return out;
  }

  function ticks() {
    var out = "";
    var i, a, x1, y1, x2, y2;
    for (i = 0; i < 12; i++) {
      a = (Math.PI * 2 * i) / 12 - Math.PI / 2;
      x1 = 100 + Math.cos(a) * 40;
      y1 = 108 + Math.sin(a) * 40;
      x2 = 100 + Math.cos(a) * 48;
      y2 = 108 + Math.sin(a) * 48;
      out += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + LAMP + '" stroke-width="3"/>';
    }
    return out;
  }

  function rain() {
    var out = "";
    var i;
    for (i = 0; i < 14; i++) {
      out += '<line x1="' + (12 + i * 13) + '" y1="' + (120 + (i % 3) * 8) + '" x2="' + (4 + i * 13) + '" y2="' + (146 + (i % 3) * 8) + '" stroke="' + CREAM + '" stroke-width="1.5" opacity=".7"/>';
    }
    return out;
  }

  var places = {
    fontana: '<rect width="360" height="150" fill="#14383c"/><ellipse cx="180" cy="108" rx="90" ry="22" fill="#1e5854"/><ellipse cx="180" cy="104" rx="70" ry="14" fill="#7fb8b2"/><rect x="168" y="48" width="24" height="58" fill="#d4c2a4"/><path d="M120 78 q60 -40 120 0" fill="none" stroke="#f4e7d0" stroke-width="4"/><circle cx="150" cy="96" r="3" fill="#f0b429"/><circle cx="210" cy="98" r="2.5" fill="#f0b429"/>',
    bar: '<rect width="360" height="150" fill="#1b140f"/><rect x="20" y="78" width="220" height="16" fill="#8d3a32"/><rect x="36" y="40" width="28" height="40" fill="#f0b429" opacity=".8"/><rect x="78" y="48" width="18" height="32" fill="#f4e7d0"/><rect x="250" y="36" width="80" height="48" fill="#14383c"/><rect x="262" y="48" width="56" height="24" fill="#f0b429" opacity=".35"/><circle cx="300" cy="108" r="10" fill="#f4e7d0"/>',
    panchina: '<rect width="360" height="150" fill="#14383c"/><rect x="70" y="78" width="220" height="12" fill="#8d3a32"/><rect x="86" y="90" width="10" height="28" fill="#1b140f"/><rect x="264" y="90" width="10" height="28" fill="#1b140f"/><path d="M40 70 q20 -30 10 20 M300 60 q24 -28 8 24" fill="#2c6b4e"/>',
    forno: '<rect width="360" height="150" fill="#2a2118"/><path d="M110 120 q70 -80 140 0 v20 h-140z" fill="#1b140f"/><path d="M136 112 q44 -46 88 0" fill="#f0b429"/><ellipse cx="180" cy="108" rx="28" ry="10" fill="#e4c2a2"/><rect x="40" y="96" width="40" height="24" rx="4" fill="#d4c2a4"/>',
    mercato: '<rect width="360" height="150" fill="#12343a"/><path d="M30 70 h90 l10 16 h-110z" fill="#8d3a32"/><path d="M150 64 h100 l12 18 h-124z" fill="#f0b429"/><rect x="48" y="96" width="28" height="22" fill="#d4c2a4"/><rect x="84" y="102" width="24" height="18" fill="#2c6b4e"/><rect x="176" y="98" width="30" height="20" fill="#e4c2a2"/>',
    vicolo: '<rect width="360" height="150" fill="#0e2428"/><path d="M0 0 h90 l40 150 h-130z" fill="#1b140f"/><path d="M360 0 h-80 l-50 150 h130z" fill="#1b140f"/><rect x="150" y="36" width="22" height="16" fill="#f4e7d0" opacity=".7"/><rect x="188" y="70" width="26" height="14" fill="#f4e7d0" opacity=".45"/>',
    terrazza: '<rect width="360" height="150" fill="#14383c"/><rect y="96" width="360" height="54" fill="#d4c2a4"/><rect x="20" y="78" width="320" height="6" fill="#1b140f"/><rect x="40" y="84" width="4" height="20" fill="#1b140f"/><rect x="316" y="84" width="4" height="20" fill="#1b140f"/><path d="M180 78 q40 20 70 0" fill="none" stroke="#8d3a32" stroke-width="3"/><circle cx="70" cy="36" r="14" fill="#f4e7d0"/>',
    piazza: '<rect width="360" height="150" fill="#14383c"/><rect y="100" width="360" height="50" fill="#cbb89a"/><ellipse cx="80" cy="124" rx="26" ry="8" fill="#b7a488"/><ellipse cx="180" cy="132" rx="30" ry="8" fill="#b7a488"/><ellipse cx="270" cy="122" rx="24" ry="8" fill="#b7a488"/><rect x="40" y="46" width="6" height="54" fill="#1b140f"/><rect x="28" y="36" width="30" height="12" rx="2" fill="#1b140f"/><rect x="34" y="39" width="18" height="6" fill="#f0b429"/><rect x="300" y="40" width="6" height="60" fill="#1b140f"/><rect x="288" y="30" width="30" height="12" rx="2" fill="#1b140f"/><rect x="294" y="33" width="18" height="6" fill="#f0b429"/>',
    orto: '<rect width="360" height="150" fill="#1d3a28"/><rect x="40" y="70" width="80" height="48" fill="#2c6b4e"/><rect x="140" y="78" width="80" height="44" fill="#245c40"/><rect x="240" y="66" width="80" height="52" fill="#2c6b4e"/><circle cx="60" cy="86" r="6" fill="#8d3a32"/><circle cx="96" cy="96" r="5" fill="#f0b429"/><circle cx="170" cy="96" r="6" fill="#8d3a32"/><circle cx="268" cy="84" r="6" fill="#f0b429"/>',
    balcone: '<rect width="360" height="150" fill="#14383c"/><rect x="70" y="88" width="220" height="12" fill="#1b140f"/><rect x="86" y="100" width="8" height="28" fill="#1b140f"/><rect x="266" y="100" width="8" height="28" fill="#1b140f"/><circle cx="120" cy="70" r="16" fill="#8d3a32"/><circle cx="180" cy="62" r="18" fill="#f0b429"/><circle cx="236" cy="72" r="14" fill="#8d3a32"/><circle cx="120" cy="70" r="5" fill="#2c6b4e"/><circle cx="180" cy="62" r="6" fill="#2c6b4e"/>',
    cantiere: '<rect width="360" height="150" fill="#2a241c"/><rect x="40" y="96" width="70" height="16" fill="#f0b429"/><rect x="150" y="96" width="70" height="16" fill="#1b140f"/><rect x="250" y="96" width="70" height="16" fill="#f0b429"/><rect x="200" y="30" width="8" height="90" fill="#8d3a32"/><rect x="170" y="40" width="70" height="6" fill="#8d3a32"/>',
    osteria: '<rect width="360" height="150" fill="#2a1814"/><ellipse cx="170" cy="100" rx="90" ry="22" fill="#8d3a32"/><circle cx="120" cy="86" r="12" fill="#f4e7d0"/><circle cx="168" cy="80" r="12" fill="#f4e7d0"/><circle cx="214" cy="86" r="12" fill="#f4e7d0"/><rect x="250" y="48" width="16" height="40" rx="6" fill="#1e5854"/><rect x="40" y="40" width="50" height="36" fill="#f0b429" opacity=".35"/>',
    semaforo: '<rect width="360" height="150" fill="#12343a"/><rect x="168" y="20" width="24" height="110" fill="#1b140f"/><rect x="158" y="18" width="44" height="78" rx="8" fill="#1b140f"/><circle cx="180" cy="36" r="8" fill="#3a2422"/><circle cx="180" cy="56" r="8" fill="#f0b429"/><circle cx="180" cy="76" r="8" fill="#2c6b4e" opacity=".45"/><rect y="118" width="360" height="32" fill="#cbb89a"/>'
  };

  function picture(id) {
    var draw = cards[id] || cards.corriere;
    return svg(200, 230, draw());
  }

  function place(id) {
    return svg(360, 150, places[id] || places.piazza);
  }

  function back() {
    return svg(200, 280,
      '<rect width="200" height="280" fill="#1b140f"/>' +
      '<rect x="10" y="10" width="180" height="260" fill="none" stroke="#f0b429" stroke-width="3"/>' +
      '<rect x="94" y="78" width="12" height="120" fill="#f4e7d0"/>' +
      '<rect x="70" y="58" width="60" height="24" rx="4" fill="#f4e7d0"/>' +
      '<rect x="78" y="64" width="44" height="12" fill="#f0b429"/>' +
      '<ellipse cx="100" cy="70" rx="40" ry="28" fill="#f0b429" opacity=".25"/>' +
      '<rect x="36" y="196" width="28" height="8" fill="#8d3a32"/>' +
      '<rect x="86" y="196" width="28" height="8" fill="#f0b429"/>' +
      '<rect x="136" y="196" width="28" height="8" fill="#2c6b4e"/>'
    );
  }

  function title() {
    return svg(640, 280,
      '<rect width="640" height="280" fill="#10282c"/>' +
      '<rect y="190" width="640" height="90" fill="#cbb89a"/>' +
      '<ellipse cx="120" cy="230" rx="40" ry="12" fill="#b7a488"/>' +
      '<ellipse cx="320" cy="246" rx="50" ry="12" fill="#b7a488"/>' +
      '<ellipse cx="500" cy="228" rx="36" ry="11" fill="#b7a488"/>' +
      '<rect x="70" y="150" width="120" height="16" fill="#8d3a32"/>' +
      '<rect x="250" y="156" width="140" height="16" fill="#1b140f"/>' +
      '<rect x="450" y="148" width="120" height="16" fill="#2c6b4e"/>' +
      '<rect x="300" y="40" width="14" height="120" fill="#1b140f"/>' +
      '<rect x="250" y="28" width="114" height="36" rx="6" fill="#1b140f"/>' +
      '<rect x="262" y="36" width="90" height="18" fill="#f0b429"/>' +
      '<ellipse cx="307" cy="46" rx="80" ry="40" fill="#f0b429" opacity=".28"/>' +
      '<circle cx="90" cy="48" r="16" fill="#f4e7d0"/>' +
      '<path d="M520 150 q18 -40 36 -8 q10 6 8 20 q-16 4 -28 0z" fill="#1b140f"/>' +
      '<circle cx="536" cy="118" r="4" fill="#f0b429"/>' +
      '<circle cx="150" cy="120" r="10" fill="#8d3a32"/>' +
      '<circle cx="150" cy="120" r="4" fill="#2c6b4e"/>'
    );
  }

  function plaza() {
    return svg(1200, 700,
      '<rect width="1200" height="700" fill="#102428"/>' +
      '<rect y="250" width="1200" height="450" fill="#1a3c38"/>' +
      '<path d="M0 250 h180 v-90 h40 v90 h120 v-120 h50 v120 h200 v-70 h36 v70 h160 v-110 h44 v110 h180 v-80 h40 v80 h150z" fill="#15221e"/>' +
      '<rect x="70" y="120" width="18" height="22" fill="#f0b429" opacity=".75"/>' +
      '<rect x="210" y="96" width="14" height="18" fill="#f4e7d0" opacity=".4"/>' +
      '<rect x="430" y="140" width="16" height="20" fill="#f0b429" opacity=".55"/>' +
      '<rect x="760" y="110" width="14" height="16" fill="#f4e7d0" opacity=".35"/>' +
      '<rect x="980" y="128" width="18" height="20" fill="#f0b429" opacity=".6"/>' +
      '<rect y="430" width="1200" height="270" fill="#cbb89a"/>' +
      '<g fill="#b7a488">' +
      '<ellipse cx="80" cy="470" rx="36" ry="12"/><ellipse cx="180" cy="510" rx="40" ry="13"/>' +
      '<ellipse cx="300" cy="480" rx="34" ry="12"/><ellipse cx="430" cy="530" rx="42" ry="13"/>' +
      '<ellipse cx="560" cy="490" rx="36" ry="12"/><ellipse cx="700" cy="520" rx="40" ry="13"/>' +
      '<ellipse cx="840" cy="475" rx="34" ry="12"/><ellipse cx="980" cy="515" rx="38" ry="12"/>' +
      '<ellipse cx="1100" cy="485" rx="32" ry="11"/>' +
      "</g>" +
      '<rect x="160" y="250" width="10" height="180" fill="#1b140f"/>' +
      '<rect x="120" y="236" width="90" height="22" rx="3" fill="#1b140f"/>' +
      '<rect x="136" y="241" width="58" height="10" fill="#f0b429"/>' +
      '<ellipse cx="165" cy="248" rx="50" ry="28" fill="#f0b429" opacity=".25"/>' +
      '<rect x="980" y="270" width="10" height="160" fill="#1b140f"/>' +
      '<rect x="944" y="256" width="82" height="20" rx="3" fill="#1b140f"/>' +
      '<rect x="958" y="261" width="54" height="9" fill="#f0b429"/>'
    );
  }

  root.LumeArt = {
    picture: picture,
    place: place,
    back: back,
    title: title,
    plaza: plaza
  };
})(window);
