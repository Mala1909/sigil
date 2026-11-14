"use strict";

/* Dipinti originali di SIGILLO. Nessun mostro, cornice o nome copiato da altri giochi. */
(function (root) {
  var cache = {};

  function rnd(seed) {
    return function () {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function hash(id) {
    var h = 2166136261;
    var s = String(id || "x");
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0 || 1;
  }

  function sky(g, w, h, kind) {
    var grad = g.createLinearGradient(0, 0, 0, h);
    if (kind === "dawn") {
      grad.addColorStop(0, "#2a1a3a");
      grad.addColorStop(0.45, "#c45a32");
      grad.addColorStop(1, "#f0b429");
    } else if (kind === "blood") {
      grad.addColorStop(0, "#1a0a10");
      grad.addColorStop(0.6, "#6e1c28");
      grad.addColorStop(1, "#2a120e");
    } else if (kind === "storm") {
      grad.addColorStop(0, "#12161c");
      grad.addColorStop(0.5, "#2a3340");
      grad.addColorStop(1, "#3d3428");
    } else if (kind === "fire") {
      grad.addColorStop(0, "#1a0c08");
      grad.addColorStop(0.55, "#8a2e12");
      grad.addColorStop(1, "#e07a22");
    } else {
      grad.addColorStop(0, "#070b16");
      grad.addColorStop(0.62, "#1b2a44");
      grad.addColorStop(1, "#243044");
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }

  function stars(g, w, h, rand, n) {
    var i;
    for (i = 0; i < n; i++) {
      g.globalAlpha = 0.25 + rand() * 0.75;
      g.fillStyle = rand() > 0.85 ? "#f0b429" : "#f4e7d0";
      g.fillRect(rand() * w, rand() * h * 0.62, rand() > 0.8 ? 2 : 1, 1);
    }
    g.globalAlpha = 1;
  }

  function moon(g, x, y, r) {
    var grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, "#fff6dd");
    grad.addColorStop(1, "#d7c4a0");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.fill();
    g.fillStyle = "rgba(255,244,210,.18)";
    g.beginPath();
    g.arc(x, y, r * 1.6, 0, 7);
    g.fill();
  }

  function ridge(g, w, h, color, y, amp) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(0, y);
    var x;
    for (x = 0; x <= w; x += w / 8) {
      g.lineTo(x, y - Math.sin(x / w * 6) * amp - (x % 3) * 4);
    }
    g.lineTo(w, h);
    g.fill();
  }

  function castle(g, x, y, s) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = "#1a1614";
    g.fillRect(-28, -40, 56, 48);
    g.fillRect(-36, -58, 16, 28);
    g.fillRect(20, -64, 16, 34);
    g.fillRect(-8, -72, 14, 22);
    g.fillStyle = "#f0b429";
    g.fillRect(-30, -28, 5, 7);
    g.fillRect(8, -22, 5, 7);
    g.fillRect(26, -40, 4, 6);
    g.restore();
  }

  function ground(g, w, h, color) {
    g.fillStyle = color || "#2a241c";
    g.beginPath();
    g.moveTo(0, h * 0.78);
    g.quadraticCurveTo(w * 0.4, h * 0.7, w, h * 0.8);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
  }

  function knight(g, x, y, s, o) {
    o = o || {};
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = "rgba(0,0,0,.35)";
    g.beginPath();
    g.ellipse(0, 6, 34, 7, 0, 0, 7);
    g.fill();
    g.fillStyle = o.cape || "#7a1e2a";
    g.beginPath();
    g.moveTo(-6, -96);
    g.quadraticCurveTo(-52, -30, -24, 4);
    g.lineTo(-4, 2);
    g.quadraticCurveTo(-28, -34, -2, -94);
    g.fill();
    g.fillStyle = "#241c16";
    g.fillRect(-14, -30, 10, 32);
    g.fillRect(4, -30, 10, 32);
    g.fillStyle = "#120e0c";
    g.fillRect(-16, -4, 14, 8);
    g.fillRect(2, -4, 14, 8);
    var armor = g.createLinearGradient(-18, -92, 18, -24);
    armor.addColorStop(0, "#6e7884");
    armor.addColorStop(0.45, "#e7eef6");
    armor.addColorStop(1, "#4e5864");
    g.fillStyle = armor;
    g.beginPath();
    g.moveTo(-16, -80);
    g.lineTo(16, -80);
    g.lineTo(13, -28);
    g.lineTo(-13, -28);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,255,255,.28)";
    g.beginPath();
    g.ellipse(-2, -58, 5, 14, 0.2, 0, 7);
    g.fill();
    g.fillStyle = "#6b3a1e";
    g.fillRect(-14, -36, 28, 6);
    g.fillStyle = "#e0b15a";
    g.beginPath();
    g.arc(0, -33, 4, 0, 7);
    g.fill();
    g.fillStyle = "#d5dee8";
    g.beginPath();
    g.ellipse(-16, -76, 11, 7, -0.5, 0, 7);
    g.ellipse(16, -76, 11, 7, 0.5, 0, 7);
    g.fill();
    g.fillStyle = "#dfe7f0";
    g.beginPath();
    g.arc(0, -98, 15, Math.PI, 0);
    g.fill();
    g.fillRect(-14, -98, 28, 16);
    g.fillStyle = "#14110f";
    g.fillRect(-11, -96, 22, 4);
    g.fillStyle = o.plume || "#c43737";
    g.beginPath();
    g.moveTo(-2, -110);
    g.quadraticCurveTo(16, -138, 6, -108);
    g.quadraticCurveTo(2, -128, -6, -112);
    g.fill();
    if (o.sword !== false) {
      g.save();
      g.translate(18, -70);
      g.rotate(o.swordAngle == null ? -0.7 : o.swordAngle);
      var blade = g.createLinearGradient(0, -70, 6, 10);
      blade.addColorStop(0, "#ffffff");
      blade.addColorStop(1, "#9aa6b4");
      g.fillStyle = blade;
      g.fillRect(0, -68, 5, 72);
      g.fillStyle = "#e0b15a";
      g.fillRect(-7, 2, 18, 5);
      g.fillStyle = "#5a341c";
      g.fillRect(0, 6, 5, 16);
      g.restore();
    }
    if (o.shield !== false) {
      g.fillStyle = o.shield || "#7a1e2a";
      g.beginPath();
      g.moveTo(-34, -74);
      g.lineTo(-14, -74);
      g.lineTo(-14, -46);
      g.quadraticCurveTo(-24, -34, -34, -46);
      g.closePath();
      g.fill();
      g.strokeStyle = "#e0b15a";
      g.lineWidth = 1.6;
      g.stroke();
      g.fillStyle = "#e0b15a";
      g.beginPath();
      g.arc(-24, -58, 4, 0, 7);
      g.fill();
    }
    g.restore();
  }

  function dragon(g, x, y, s, o) {
    o = o || {};
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    var body = o.body || "#6d2b24";
    var membrane = g.createLinearGradient(-10, -90, 90, 20);
    membrane.addColorStop(0, "#c4553a");
    membrane.addColorStop(0.55, "#6e241c");
    membrane.addColorStop(1, "#2a1012");
    g.fillStyle = "rgba(40,16,18,.8)";
    g.beginPath();
    g.moveTo(8, -8);
    g.quadraticCurveTo(-70, -100, -8, -20);
    g.quadraticCurveTo(-40, -60, 6, 6);
    g.fill();
    g.fillStyle = membrane;
    g.beginPath();
    g.moveTo(14, -6);
    g.quadraticCurveTo(96, -108, 36, -8);
    g.quadraticCurveTo(78, -62, 22, 16);
    g.quadraticCurveTo(48, -28, 14, -6);
    g.fill();
    g.strokeStyle = "#1a100e";
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(16, -4);
    g.quadraticCurveTo(70, -78, 90, -92);
    g.moveTo(16, -4);
    g.quadraticCurveTo(52, -42, 66, -28);
    g.stroke();
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(-46, 18);
    g.quadraticCurveTo(-8, -16, 24, -18);
    g.quadraticCurveTo(40, -34, 52, -6);
    g.quadraticCurveTo(22, 10, 8, 26);
    g.quadraticCurveTo(-16, 14, -46, 30);
    g.closePath();
    g.fill();
    g.fillStyle = o.belly || "#e2b06a";
    g.beginPath();
    g.ellipse(-2, 8, 20, 9, -0.25, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,.4)";
    g.lineWidth = 1;
    var i;
    for (i = 0; i < 7; i++) {
      g.beginPath();
      g.arc(-24 + i * 9, 8, 5, 0.1, Math.PI - 0.1);
      g.stroke();
    }
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(28, -10);
    g.quadraticCurveTo(62, -42, 86, -16);
    g.lineTo(74, -2);
    g.quadraticCurveTo(52, -18, 26, 0);
    g.fill();
    g.beginPath();
    g.moveTo(64, -8);
    g.lineTo(96, 0);
    g.lineTo(66, 6);
    g.fill();
    g.fillStyle = "#e6c27a";
    g.beginPath();
    g.moveTo(60, -30);
    g.lineTo(70, -52);
    g.lineTo(74, -26);
    g.fill();
    g.beginPath();
    g.moveTo(50, -24);
    g.lineTo(54, -40);
    g.lineTo(60, -22);
    g.fill();
    g.fillStyle = "#ffe08a";
    g.beginPath();
    g.ellipse(72, -14, 4.2, 2.6, 0.2, 0, 7);
    g.fill();
    g.fillStyle = "#1a100c";
    g.beginPath();
    g.arc(73.2, -14, 1.3, 0, 7);
    g.fill();
    if (o.fire !== false) {
      var fire = g.createLinearGradient(86, -8, 150, 8);
      fire.addColorStop(0, "#fff4c8");
      fire.addColorStop(0.35, "#f0b429");
      fire.addColorStop(1, "rgba(180,40,16,0)");
      g.fillStyle = fire;
      g.beginPath();
      g.moveTo(88, -8);
      g.quadraticCurveTo(124, -28, 148, 0);
      g.quadraticCurveTo(120, 14, 86, 4);
      g.fill();
    }
    g.strokeStyle = body;
    g.lineWidth = 9;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-40, 16);
    g.quadraticCurveTo(-78, 8, -64, -22);
    g.stroke();
    g.fillStyle = "#e6c27a";
    g.beginPath();
    g.moveTo(-70, -20);
    g.lineTo(-58, -28);
    g.lineTo(-60, -14);
    g.fill();
    g.restore();
  }

  function cat(g, x, y, s) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = "#120e10";
    g.beginPath();
    g.ellipse(0, 0, 34, 22, -0.2, 0, 7);
    g.fill();
    g.beginPath();
    g.moveTo(-16, -12);
    g.lineTo(-24, -32);
    g.lineTo(-6, -16);
    g.moveTo(8, -16);
    g.lineTo(14, -34);
    g.lineTo(18, -12);
    g.fill();
    g.fillStyle = "#f0b429";
    g.beginPath();
    g.ellipse(-8, -2, 3, 2, 0, 0, 7);
    g.ellipse(8, -3, 3, 2, 0, 0, 7);
    g.fill();
    g.strokeStyle = "#120e10";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(28, 4);
    g.quadraticCurveTo(48, -10, 40, 16);
    g.stroke();
    g.restore();
  }

  function flame(g, x, y, s, hot) {
    var grad = g.createLinearGradient(x, y - 30 * s, x, y);
    grad.addColorStop(0, hot ? "#fff6d0" : "#f0b429");
    grad.addColorStop(0.5, "#e25822");
    grad.addColorStop(1, "rgba(120,20,10,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x - 16 * s, y - 18 * s, x - 4 * s, y - 36 * s);
    g.quadraticCurveTo(x + 6 * s, y - 16 * s, x + 14 * s, y - 28 * s);
    g.quadraticCurveTo(x + 8 * s, y - 8 * s, x, y);
    g.fill();
  }

  function banner(g, x, y, s, color) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.strokeStyle = "#e6d2a8";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, -40);
    g.lineTo(0, 28);
    g.stroke();
    g.fillStyle = color || "#7a1e2a";
    g.beginPath();
    g.moveTo(0, -36);
    g.lineTo(22, -28);
    g.lineTo(0, -8);
    g.fill();
    g.restore();
  }

  var scenes = {
    corriere: function (g, w, h) {
      sky(g, w, h, "dawn");
      ridge(g, w, h, "#3a241c", h * 0.72, 18);
      ground(g, w, h, "#6a4a32");
      castle(g, w * 0.78, h * 0.62, h / 180);
      knight(g, w * 0.38, h * 0.78, h / 220, { cape: "#8d3a32", plume: "#f0b429", swordAngle: -1.1 });
    },
    gatto: function (g, w, h) {
      sky(g, w, h, "night");
      stars(g, w, h, rnd(3), 30);
      moon(g, w * 0.78, h * 0.22, h * 0.1);
      g.fillStyle = "#141018";
      g.fillRect(w * 0.55, h * 0.28, w * 0.28, h * 0.5);
      g.fillStyle = "#f0b429";
      g.globalAlpha = 0.35;
      g.fillRect(w * 0.62, h * 0.38, w * 0.12, h * 0.16);
      g.globalAlpha = 1;
      ground(g, w, h, "#1c1816");
      cat(g, w * 0.38, h * 0.7, h / 150);
    },
    lampione: function (g, w, h) {
      sky(g, w, h, "night");
      g.fillStyle = "rgba(80,180,90,.18)";
      g.beginPath();
      g.arc(w * 0.5, h * 0.42, h * 0.28, 0, 7);
      g.fill();
      g.fillStyle = "#1a1612";
      g.fillRect(w * 0.47, h * 0.4, w * 0.06, h * 0.4);
      flame(g, w * 0.5, h * 0.42, h / 90, false);
      g.fillStyle = "#67c46a";
      g.globalAlpha = 0.8;
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.36, w * 0.08, h * 0.06, 0, 0, 7);
      g.fill();
      g.globalAlpha = 1;
      ground(g, w, h, "#242018");
      g.fillStyle = "#3a342c";
      g.fillRect(w * 0.12, h * 0.62, w * 0.1, h * 0.16);
      g.fillRect(w * 0.74, h * 0.58, w * 0.12, h * 0.2);
    },
    moneta: function (g, w, h) {
      sky(g, w, h, "night");
      moon(g, w * 0.2, h * 0.2, h * 0.08);
      g.fillStyle = "#101418";
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.78, w * 0.28, h * 0.1, 0, 0, 7);
      g.fill();
      var coin = g.createRadialGradient(w * 0.46, h * 0.4, 4, w * 0.5, h * 0.42, w * 0.16);
      coin.addColorStop(0, "#fff1c4");
      coin.addColorStop(0.6, "#e0a83a");
      coin.addColorStop(1, "#8a5a16");
      g.fillStyle = coin;
      g.beginPath();
      g.arc(w * 0.5, h * 0.42, w * 0.14, 0, 7);
      g.fill();
      g.strokeStyle = "#5a3a10";
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = "#c9a27a";
      g.beginPath();
      g.moveTo(w * 0.38, h * 0.7);
      g.quadraticCurveTo(w * 0.46, h * 0.6, w * 0.44, h * 0.78);
      g.fill();
    },
    briciola: function (g, w, h) {
      sky(g, w, h, "dawn");
      ridge(g, w, h, "#3a2a34", h * 0.7, 12);
      ground(g, w, h, "#5a4030");
      knight(g, w * 0.72, h * 0.8, h / 340, { sword: false, shield: "#2a3a4a", cape: "#2a3a4a" });
      knight(g, w * 0.42, h * 0.82, h / 260, { plume: "#f0b429" });
      banner(g, w * 0.28, h * 0.62, h / 180, "#f0b429");
    },
    vigile: function (g, w, h) {
      sky(g, w, h, "storm");
      g.fillStyle = "#1a1614";
      g.fillRect(0, h * 0.2, w * 0.22, h * 0.8);
      g.fillRect(w * 0.78, h * 0.16, w * 0.22, h * 0.84);
      g.fillStyle = "#8d3a32";
      g.fillRect(w * 0.18, h * 0.42, w * 0.64, h * 0.06);
      ground(g, w, h, "#3a342c");
      knight(g, w * 0.5, h * 0.8, h / 230, { cape: "#243044", plume: "#c9a46a", shield: "#243044", swordAngle: 0.2 });
      flame(g, w * 0.24, h * 0.58, h / 160, true);
    },
    nonna: function (g, w, h) {
      sky(g, w, h, "blood");
      moon(g, w * 0.8, h * 0.18, h * 0.09);
      ground(g, w, h, "#3a241c");
      g.fillStyle = "#4a3028";
      g.beginPath();
      g.moveTo(w * 0.28, h * 0.86);
      g.quadraticCurveTo(w * 0.5, h * 0.4, w * 0.72, h * 0.86);
      g.fill();
      knight(g, w * 0.5, h * 0.78, h / 250, { sword: false, shield: false, cape: "#2a1814", plume: "#f4e7d0" });
      var i;
      for (i = 0; i < 5; i++) flame(g, w * (0.34 + i * 0.08), h * 0.48, h / 280, true);
    },
    spia: function (g, w, h) {
      sky(g, w, h, "blood");
      moon(g, w * 0.72, h * 0.24, h * 0.12);
      g.fillStyle = "rgba(180,30,40,.25)";
      g.beginPath();
      g.arc(w * 0.72, h * 0.24, h * 0.2, 0, 7);
      g.fill();
      ground(g, w, h, "#1a1012");
      g.fillStyle = "#120e10";
      g.beginPath();
      g.moveTo(w * 0.32, h * 0.78);
      g.lineTo(w * 0.46, h * 0.28);
      g.lineTo(w * 0.58, h * 0.78);
      g.fill();
      g.strokeStyle = "#e8eef4";
      g.lineWidth = Math.max(2, w * 0.012);
      g.beginPath();
      g.moveTo(w * 0.62, h * 0.42);
      g.lineTo(w * 0.84, h * 0.62);
      g.stroke();
    },
    chiavi: function (g, w, h) {
      sky(g, w, h, "night");
      stars(g, w, h, rnd(9), 20);
      g.fillStyle = "#16120f";
      g.fillRect(w * 0.62, h * 0.18, w * 0.3, h * 0.7);
      g.fillStyle = "#f0b429";
      g.globalAlpha = 0.25;
      g.fillRect(w * 0.7, h * 0.32, w * 0.12, h * 0.18);
      g.globalAlpha = 1;
      ground(g, w, h, "#2a241c");
      g.strokeStyle = "#e0b15a";
      g.lineWidth = Math.max(3, w * 0.02);
      var i;
      for (i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(w * (0.22 + i * 0.08), h * (0.34 + i * 0.08), h * 0.045, 0.4, 5.4);
        g.stroke();
        g.beginPath();
        g.moveTo(w * (0.26 + i * 0.08), h * (0.36 + i * 0.08));
        g.lineTo(w * (0.4 + i * 0.04), h * (0.4 + i * 0.06));
        g.stroke();
      }
    },
    folata: function (g, w, h) {
      sky(g, w, h, "storm");
      ground(g, w, h, "#3a4038");
      knight(g, w * 0.4, h * 0.8, h / 250, { cape: "#1e3a4a", swordAngle: -1.4, plume: "#d7e4ea" });
      g.strokeStyle = "#f4e7d0";
      g.lineWidth = 2;
      var i;
      for (i = 0; i < 7; i++) {
        g.beginPath();
        g.ellipse(w * (0.45 + i * 0.05), h * (0.3 + (i % 3) * 0.08), w * 0.08, h * 0.02, -0.6, 0, 7);
        g.stroke();
      }
    },
    barista: function (g, w, h) {
      sky(g, w, h, "dawn");
      ridge(g, w, h, "#2a1e28", h * 0.66, 22);
      castle(g, w * 0.78, h * 0.58, h / 140);
      ground(g, w, h, "#6e5340");
      knight(g, w * 0.42, h * 0.8, h / 190, { plume: "#f0b429", shield: "#7a1e2a", cape: "#7a1e2a" });
    },
    poeta: function (g, w, h) {
      sky(g, w, h, "night");
      stars(g, w, h, rnd(12), 36);
      moon(g, w * 0.22, h * 0.22, h * 0.11);
      g.fillStyle = "#2a241c";
      g.fillRect(w * 0.18, h * 0.62, w * 0.5, h * 0.08);
      ground(g, w, h, "#1c1814");
      knight(g, w * 0.4, h * 0.7, h / 280, { sword: false, shield: false, cape: "#243044", plume: "#f4e7d0" });
      g.fillStyle = "#14110f";
      var i;
      for (i = 0; i < 5; i++) {
        g.beginPath();
        g.ellipse(w * (0.62 + i * 0.06), h * (0.28 + (i % 2) * 0.06), 8, 3, -0.4, 0, 7);
        g.fill();
      }
    },
    suonatore: function (g, w, h) {
      sky(g, w, h, "fire");
      ground(g, w, h, "#3a2418");
      knight(g, w * 0.36, h * 0.8, h / 240, { sword: false, shield: false, cape: "#5a241c", plume: "#f0b429" });
      g.fillStyle = "#e6d2a8";
      g.beginPath();
      g.ellipse(w * 0.62, h * 0.62, w * 0.1, h * 0.06, 0, 0, 7);
      g.fill();
      flame(g, w * 0.72, h * 0.6, h / 140, true);
    },
    gerani: function (g, w, h) {
      sky(g, w, h, "blood");
      ground(g, w, h, "#2a1814");
      g.fillStyle = "#5a201c";
      var i;
      for (i = 0; i < 9; i++) {
        g.beginPath();
        g.moveTo(w * (0.08 + i * 0.1), h);
        g.quadraticCurveTo(w * (0.12 + i * 0.1), h * 0.35, w * (0.16 + i * 0.1), h);
        g.fill();
      }
      g.fillStyle = "#c9ced6";
      g.beginPath();
      g.arc(w * 0.48, h * 0.58, h * 0.08, Math.PI, 0);
      g.fill();
      g.fillRect(w * 0.4, h * 0.56, w * 0.16, h * 0.08);
    },
    muretto: function (g, w, h) {
      sky(g, w, h, "storm");
      var cols = ["#3a342c", "#4a4036", "#2e2924"];
      var y, x, row;
      for (row = 0, y = h * 0.28; y < h; y += h * 0.12, row++) {
        for (x = (row % 2 ? -w * 0.06 : 0); x < w; x += w * 0.22) {
          g.fillStyle = cols[(row + x) % 3];
          g.fillRect(x, y, w * 0.2, h * 0.1);
          g.strokeStyle = "#1a140f";
          g.strokeRect(x, y, w * 0.2, h * 0.1);
        }
      }
      g.fillStyle = "#8d3a32";
      g.beginPath();
      g.moveTo(w * 0.7, h * 0.34);
      g.lineTo(w * 0.86, h * 0.34);
      g.lineTo(w * 0.78, h * 0.5);
      g.fill();
    },
    espresso: function (g, w, h) {
      sky(g, w, h, "night");
      stars(g, w, h, rnd(15), 16);
      ground(g, w, h, "#1c1814");
      g.fillStyle = "#c9a46a";
      g.fillRect(w * 0.22, h * 0.58, w * 0.16, h * 0.2);
      g.fillRect(w * 0.58, h * 0.58, w * 0.16, h * 0.2);
      g.fillStyle = "#7dcea0";
      g.globalAlpha = 0.7;
      g.beginPath();
      g.ellipse(w * 0.3, h * 0.4, w * 0.1, h * 0.12, 0, 0, 7);
      g.fill();
      g.fillStyle = "#f0b429";
      g.beginPath();
      g.ellipse(w * 0.66, h * 0.36, w * 0.12, h * 0.14, 0, 0, 7);
      g.fill();
      g.globalAlpha = 1;
      dragon(g, w * 0.48, h * 0.42, h / 420, { fire: false, body: "#8a6a32" });
    },
    idraulico: function (g, w, h) {
      sky(g, w, h, "storm");
      ridge(g, w, h, "#2a2824", h * 0.7, 10);
      ground(g, w, h, "#4a4036");
      knight(g, w * 0.5, h * 0.82, h / 150, { cape: "#3a342c", plume: "#9aa6b4", shield: "#3a4450" });
      knight(g, w * 0.22, h * 0.86, h / 360, { sword: false });
      knight(g, w * 0.78, h * 0.86, h / 360, { sword: false, shield: "#243044" });
    },
    pizzaiolo: function (g, w, h) {
      sky(g, w, h, "fire");
      g.fillStyle = "#2a1812";
      g.fillRect(0, h * 0.15, w, h * 0.7);
      g.fillStyle = "#f0b429";
      g.globalAlpha = 0.15;
      g.fillRect(0, h * 0.45, w, h * 0.3);
      g.globalAlpha = 1;
      flame(g, w * 0.5, h * 0.7, h / 80, true);
      knight(g, w * 0.28, h * 0.78, h / 280, { sword: false, shield: false, cape: "#7a1e2a" });
      knight(g, w * 0.72, h * 0.78, h / 280, { sword: false, shield: false, cape: "#243044", plume: "#f0b429" });
    },
    capotreno: function (g, w, h) {
      sky(g, w, h, "dawn");
      dragon(g, w * 0.62, h * 0.28, h / 260, { fire: false });
      ridge(g, w, h, "#3a241c", h * 0.7, 16);
      ground(g, w, h, "#5a4030");
      knight(g, w * 0.32, h * 0.8, h / 210, { plume: "#f4e7d0", shield: "#1e3a4a", swordAngle: -0.2 });
    },
    orologio: function (g, w, h) {
      sky(g, w, h, "blood");
      g.fillStyle = "#140e10";
      g.beginPath();
      g.arc(w * 0.62, h * 0.32, h * 0.16, 0, 7);
      g.fill();
      moon(g, w * 0.48, h * 0.34, h * 0.2);
      g.strokeStyle = "#e0b15a";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(w * 0.48, h * 0.46, h * 0.28, 0, 7);
      g.stroke();
      g.beginPath();
      g.arc(w * 0.48, h * 0.46, h * 0.2, 0, 7);
      g.stroke();
      ground(g, w, h, "#2a1814");
    },
    sindaca: function (g, w, h) {
      sky(g, w, h, "dawn");
      castle(g, w * 0.18, h * 0.62, h / 160);
      castle(g, w * 0.82, h * 0.6, h / 170);
      ground(g, w, h, "#6a4a32");
      knight(g, w * 0.5, h * 0.8, h / 185, { cape: "#6e1830", plume: "#f4e7d0", shield: "#6e1830", swordAngle: 0.05 });
      banner(g, w * 0.22, h * 0.5, h / 160, "#7a1e2a");
      banner(g, w * 0.8, h * 0.48, h / 160, "#1e3a4a");
    },
    orchestra: function (g, w, h) {
      sky(g, w, h, "dawn");
      g.fillStyle = "rgba(240,180,41,.18)";
      g.beginPath();
      g.moveTo(w * 0.5, 0);
      g.lineTo(w * 0.2, h);
      g.lineTo(w * 0.8, h);
      g.fill();
      ground(g, w, h, "#4a3428");
      knight(g, w * 0.28, h * 0.82, h / 250, { swordAngle: -1.3, plume: "#f0b429" });
      knight(g, w * 0.5, h * 0.8, h / 220, { swordAngle: -1.5, shield: "#1e3a4a", cape: "#1e3a4a" });
      knight(g, w * 0.72, h * 0.82, h / 250, { swordAngle: -1.2, plume: "#f4e7d0", shield: "#7a1e2a" });
    },
    inviato: function (g, w, h) {
      sky(g, w, h, "storm");
      ridge(g, w, h, "#242830", h * 0.68, 20);
      ground(g, w, h, "#3a4038");
      knight(g, w * 0.58, h * 0.8, h / 210, { cape: "#243044", plume: "#e6d2a8", sword: false, shield: false });
      g.strokeStyle = "#e0b15a";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(w * 0.7, h * 0.42, h * 0.05, 0.2, 2.6);
      g.stroke();
    },
    camion: function (g, w, h) {
      sky(g, w, h, "fire");
      stars(g, w, h, rnd(24), 12);
      ridge(g, w, h, "#2a120e", h * 0.72, 14);
      castle(g, w * 0.16, h * 0.66, h / 220);
      ground(g, w, h, "#4a2418");
      dragon(g, w * 0.42, h * 0.58, h / 150, { fire: true });
    },
    temporale: function (g, w, h) {
      sky(g, w, h, "fire");
      dragon(g, w * 0.2, h * 0.3, h / 240, { fire: true });
      ground(g, w, h, "#3a2018");
      knight(g, w * 0.32, h * 0.82, h / 260, { shield: "#243044" });
      knight(g, w * 0.55, h * 0.84, h / 280, { cape: "#3a241c", plume: "#9aa6b4" });
      knight(g, w * 0.74, h * 0.82, h / 270, { shield: "#7a1e2a" });
      flame(g, w * 0.5, h * 0.7, h / 100, true);
    }
  };

  var places = {
    fontana: function (g, w, h) {
      sky(g, w, h, "night");
      moon(g, w * 0.8, h * 0.28, h * 0.16);
      g.fillStyle = "#1e3a44";
      g.beginPath();
      g.ellipse(w * 0.45, h * 0.72, w * 0.28, h * 0.16, 0, 0, 7);
      g.fill();
      g.fillStyle = "#8fb8c4";
      g.beginPath();
      g.ellipse(w * 0.45, h * 0.68, w * 0.2, h * 0.08, 0, 0, 7);
      g.fill();
      g.fillStyle = "#d7c4a8";
      g.fillRect(w * 0.42, h * 0.28, w * 0.06, h * 0.4);
    },
    bar: function (g, w, h) {
      g.fillStyle = "#140e0c";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#5a241c";
      g.fillRect(0, h * 0.62, w * 0.7, h * 0.1);
      flame(g, w * 0.2, h * 0.6, h / 80, true);
      g.fillStyle = "#1a2838";
      g.fillRect(w * 0.72, h * 0.18, w * 0.22, h * 0.36);
      g.fillStyle = "rgba(240,180,41,.3)";
      g.fillRect(w * 0.76, h * 0.24, w * 0.14, h * 0.16);
    },
    panchina: function (g, w, h) {
      sky(g, w, h, "night");
      g.fillStyle = "#1a3a2a";
      g.fillRect(0, h * 0.4, w * 0.18, h);
      g.fillRect(w * 0.82, h * 0.3, w * 0.18, h);
      g.fillStyle = "#6b3a1e";
      g.fillRect(w * 0.22, h * 0.62, w * 0.56, h * 0.08);
      ground(g, w, h, "#2a241c");
    },
    forno: function (g, w, h) {
      g.fillStyle = "#2a1812";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#1a100e";
      g.beginPath();
      g.moveTo(w * 0.2, h * 0.85);
      g.quadraticCurveTo(w * 0.5, h * 0.05, w * 0.8, h * 0.85);
      g.fill();
      flame(g, w * 0.5, h * 0.72, h / 50, true);
    },
    mercato: function (g, w, h) {
      sky(g, w, h, "dawn");
      ground(g, w, h, "#5a4030");
      g.fillStyle = "#f4e7d0";
      var i;
      for (i = 0; i < 8; i++) {
        g.beginPath();
        g.ellipse(w * (0.12 + i * 0.1), h * (0.7 + (i % 2) * 0.04), w * 0.03, h * 0.05, 0, 0, 7);
        g.fill();
      }
      g.fillStyle = "#7a1e2a";
      g.fillRect(w * 0.1, h * 0.4, w * 0.2, h * 0.08);
    },
    vicolo: function (g, w, h) {
      g.fillStyle = "#0e1214";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#1a1614";
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(w * 0.38, 0);
      g.lineTo(w * 0.22, h);
      g.lineTo(0, h);
      g.fill();
      g.beginPath();
      g.moveTo(w, 0);
      g.lineTo(w * 0.62, 0);
      g.lineTo(w * 0.78, h);
      g.lineTo(w, h);
      g.fill();
      moon(g, w * 0.5, h * 0.2, h * 0.08);
    },
    terrazza: function (g, w, h) {
      sky(g, w, h, "dawn");
      ridge(g, w, h, "#2a1e28", h * 0.55, 20);
      g.fillStyle = "#cbb89a";
      g.fillRect(0, h * 0.62, w, h);
      g.fillStyle = "#1a140f";
      g.fillRect(0, h * 0.58, w, h * 0.04);
    },
    piazza: function (g, w, h) {
      sky(g, w, h, "fire");
      ridge(g, w, h, "#3a1814", h * 0.62, 16);
      ground(g, w, h, "#6a4030");
      dragon(g, w * 0.55, h * 0.42, h / 180, { fire: true });
    },
    orto: function (g, w, h) {
      sky(g, w, h, "night");
      moon(g, w * 0.2, h * 0.22, h * 0.1);
      ground(g, w, h, "#1c1814");
      g.fillStyle = "#d7c4a8";
      var i;
      for (i = 0; i < 6; i++) {
        g.fillRect(w * (0.12 + i * 0.13), h * 0.48, w * 0.08, h * 0.28);
        g.fillStyle = "#2a241c";
        g.fillRect(w * (0.14 + i * 0.13), h * 0.42, w * 0.04, h * 0.08);
        g.fillStyle = "#d7c4a8";
      }
    },
    balcone: function (g, w, h) {
      sky(g, w, h, "dawn");
      g.fillStyle = "#5a201c";
      var i;
      for (i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(w * (0.18 + i * 0.16), h * 0.42, h * 0.12, 0, 7);
        g.fill();
      }
      g.fillStyle = "#1a140f";
      g.fillRect(w * 0.08, h * 0.55, w * 0.84, h * 0.06);
      ground(g, w, h, "#3a241c");
    },
    cantiere: function (g, w, h) {
      sky(g, w, h, "storm");
      ground(g, w, h, "#4a4036");
      g.fillStyle = "#e0b15a";
      g.fillRect(w * 0.1, h * 0.6, w * 0.18, h * 0.08);
      g.fillStyle = "#1a140f";
      g.fillRect(w * 0.4, h * 0.58, w * 0.18, h * 0.08);
      g.strokeStyle = "#8d3a32";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(w * 0.7, h * 0.2);
      g.lineTo(w * 0.7, h * 0.75);
      g.moveTo(w * 0.58, h * 0.32);
      g.lineTo(w * 0.82, h * 0.32);
      g.stroke();
    },
    osteria: function (g, w, h) {
      g.fillStyle = "#2a1410";
      g.fillRect(0, 0, w, h);
      flame(g, w * 0.5, h * 0.7, h / 60, true);
      g.fillStyle = "#6b3a1e";
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.72, w * 0.28, h * 0.1, 0, 0, 7);
      g.fill();
      g.fillStyle = "#f4e7d0";
      g.beginPath();
      g.arc(w * 0.36, h * 0.6, h * 0.06, 0, 7);
      g.arc(w * 0.5, h * 0.56, h * 0.06, 0, 7);
      g.arc(w * 0.64, h * 0.6, h * 0.06, 0, 7);
      g.fill();
    },
    semaforo: function (g, w, h) {
      sky(g, w, h, "blood");
      ground(g, w, h, "#3a241c");
      g.fillStyle = "#1a140f";
      g.fillRect(w * 0.46, h * 0.12, w * 0.08, h * 0.7);
      g.fillRect(w * 0.4, h * 0.12, w * 0.2, h * 0.42);
      g.fillStyle = "#3a1818";
      g.beginPath();
      g.arc(w * 0.5, h * 0.22, h * 0.05, 0, 7);
      g.fill();
      g.fillStyle = "#f0b429";
      g.beginPath();
      g.arc(w * 0.5, h * 0.32, h * 0.05, 0, 7);
      g.fill();
      g.fillStyle = "#2c6b4e";
      g.globalAlpha = 0.4;
      g.beginPath();
      g.arc(w * 0.5, h * 0.42, h * 0.05, 0, 7);
      g.fill();
      g.globalAlpha = 1;
    }
  };

  var RECIPE = {
    folletto: ["dawn", "imp"], ratto: ["night", "rat"], passero: ["dawn", "bird"],
    candela: ["night", "candle"], spina: ["blood", "thorn"], bruma: ["storm", "mist"],
    lupo: ["night", "wolf"], strega: ["blood", "witch"], ladro: ["night", "thief"],
    veggente: ["night", "seer"], spettro: ["night", "ghost"], corvo: ["storm", "raven"],
    driade: ["dawn", "dryad"], orso: ["storm", "bear"], alchimista: ["fire", "mage"],
    golem: ["storm", "golem"], serpe: ["dawn", "snake"], pirata: ["dawn", "pirate"],
    albero: ["dawn", "tree"], giullare: ["fire", "jester"], specchio: ["night", "mirror"],
    sete: ["blood", "thirst"], sguardo: ["blood", "gaze"], fenice: ["fire", "phoenix"],
    troll: ["storm", "troll"], cacciatrice: ["dawn", "bow"], campana: ["blood", "bell"],
    piovra: ["night", "octo"], fabbro: ["fire", "smith"], nave: ["storm", "ship"],
    idra: ["dawn", "hydra"], sacerdotessa: ["dawn", "priest"], sepolto: ["night", "lich"],
    grifone: ["dawn", "griffin"], leviatano: ["night", "sea"], basilisco: ["dawn", "lizard"],
    titano: ["storm", "titan"], piaga: ["blood", "plague"], kraken: ["night", "tentacle"],
    caduta: ["blood", "fallen"]
  };

  function blob(g, x, y, rx, ry, color, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(0, 0, rx, ry, 0, 0, 7);
    g.fill();
    g.restore();
  }

  function varied(g, w, h, id) {
    var recipe = RECIPE[id] || ["night", "imp"];
    var who = recipe[1];
    sky(g, w, h, recipe[0]);
    if (recipe[0] === "night" || recipe[0] === "blood") stars(g, w, h, rnd(hash(id)), 18);
    if (who === "sea" || who === "octo" || who === "tentacle" || who === "ship") {
      g.fillStyle = "#14324a";
      g.fillRect(0, h * 0.62, w, h);
    } else ground(g, w, h, recipe[0] === "fire" ? "#4a2418" : "#2a241c");
    var fx = figures[who] || figures.imp;
    fx(g, w, h);
  }

  var figures = {
    imp: function (g, w, h) {
      blob(g, w * 0.5, h * 0.62, w * 0.1, h * 0.16, "#6b8f4a");
      blob(g, w * 0.5, h * 0.4, w * 0.07, h * 0.08, "#d7b48a");
      g.fillStyle = "#3a2418";
      g.beginPath();
      g.moveTo(w * 0.44, h * 0.36);
      g.lineTo(w * 0.42, h * 0.24);
      g.lineTo(w * 0.5, h * 0.34);
      g.moveTo(w * 0.56, h * 0.36);
      g.lineTo(w * 0.6, h * 0.22);
      g.lineTo(w * 0.5, h * 0.34);
      g.fill();
    },
    rat: function (g, w, h) {
      blob(g, w * 0.48, h * 0.66, w * 0.16, h * 0.1, "#5a4638");
      blob(g, w * 0.66, h * 0.6, w * 0.07, h * 0.06, "#6b5344");
      g.fillStyle = "#f0b429";
      g.beginPath();
      g.arc(w * 0.7, h * 0.58, 3, 0, 7);
      g.fill();
      g.strokeStyle = "#3a2a22";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(w * 0.32, h * 0.66);
      g.quadraticCurveTo(w * 0.16, h * 0.4, w * 0.28, h * 0.5);
      g.stroke();
    },
    bird: function (g, w, h) {
      g.fillStyle = "#c9b49a";
      g.beginPath();
      g.moveTo(w * 0.3, h * 0.5);
      g.quadraticCurveTo(w * 0.5, h * 0.22, w * 0.72, h * 0.48);
      g.quadraticCurveTo(w * 0.5, h * 0.4, w * 0.3, h * 0.5);
      g.fill();
      blob(g, w * 0.68, h * 0.46, w * 0.04, h * 0.035, "#e6d2b0");
    },
    candle: function (g, w, h) {
      g.fillStyle = "#f4e7d0";
      g.fillRect(w * 0.44, h * 0.42, w * 0.12, h * 0.32);
      flame(g, w * 0.5, h * 0.44, h / 120, true);
    },
    thorn: function (g, w, h) {
      g.strokeStyle = "#6b8f4a";
      g.lineWidth = 4;
      var i;
      for (i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(w * (0.2 + i * 0.1), h);
        g.quadraticCurveTo(w * (0.28 + i * 0.1), h * 0.4, w * (0.18 + i * 0.1), h * 0.2);
        g.stroke();
      }
    },
    mist: function (g, w, h) {
      g.fillStyle = "rgba(220,230,236,.35)";
      blob(g, w * 0.4, h * 0.5, w * 0.22, h * 0.12, "rgba(220,230,236,.35)");
      blob(g, w * 0.62, h * 0.46, w * 0.16, h * 0.1, "rgba(240,244,248,.28)");
    },
    wolf: function (g, w, h) {
      blob(g, w * 0.48, h * 0.66, w * 0.18, h * 0.1, "#2e343c");
      g.fillStyle = "#2e343c";
      g.beginPath();
      g.moveTo(w * 0.58, h * 0.6);
      g.lineTo(w * 0.78, h * 0.56);
      g.lineTo(w * 0.62, h * 0.68);
      g.fill();
      g.fillStyle = "#f4e7d0";
      g.beginPath();
      g.arc(w * 0.7, h * 0.58, 2.4, 0, 7);
      g.fill();
      moon(g, w * 0.2, h * 0.22, h * 0.08);
    },
    witch: function (g, w, h) {
      g.fillStyle = "#241820";
      g.beginPath();
      g.moveTo(w * 0.36, h * 0.78);
      g.lineTo(w * 0.5, h * 0.28);
      g.lineTo(w * 0.64, h * 0.78);
      g.fill();
      g.fillStyle = "#3a2418";
      g.beginPath();
      g.moveTo(w * 0.5, h * 0.3);
      g.lineTo(w * 0.7, h * 0.42);
      g.lineTo(w * 0.46, h * 0.4);
      g.fill();
      g.strokeStyle = "#c9a46a";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(w * 0.62, h * 0.7);
      g.lineTo(w * 0.78, h * 0.36);
      g.stroke();
    },
    thief: function (g, w, h) {
      g.fillStyle = "#1a1816";
      g.fillRect(w * 0.4, h * 0.4, w * 0.16, h * 0.32);
      blob(g, w * 0.48, h * 0.34, w * 0.06, h * 0.07, "#d7b48a");
      g.strokeStyle = "#e8eef4";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(w * 0.62, h * 0.48);
      g.lineTo(w * 0.78, h * 0.66);
      g.stroke();
    },
    seer: function (g, w, h) {
      g.fillStyle = "#e6d2b0";
      g.beginPath();
      g.moveTo(w * 0.32, h * 0.78);
      g.lineTo(w * 0.5, h * 0.32);
      g.lineTo(w * 0.68, h * 0.78);
      g.fill();
      g.fillStyle = "#1a140f";
      g.fillRect(w * 0.42, h * 0.4, w * 0.16, 4);
      moon(g, w * 0.74, h * 0.22, h * 0.08);
    },
    ghost: function (g, w, h) {
      g.fillStyle = "rgba(226,234,240,.72)";
      g.beginPath();
      g.moveTo(w * 0.36, h * 0.78);
      g.quadraticCurveTo(w * 0.3, h * 0.4, w * 0.5, h * 0.28);
      g.quadraticCurveTo(w * 0.72, h * 0.4, w * 0.66, h * 0.78);
      g.quadraticCurveTo(w * 0.58, h * 0.68, w * 0.5, h * 0.78);
      g.quadraticCurveTo(w * 0.42, h * 0.68, w * 0.36, h * 0.78);
      g.fill();
    },
    raven: function (g, w, h) {
      g.fillStyle = "#14181c";
      g.beginPath();
      g.moveTo(w * 0.28, h * 0.48);
      g.quadraticCurveTo(w * 0.5, h * 0.2, w * 0.74, h * 0.5);
      g.quadraticCurveTo(w * 0.5, h * 0.4, w * 0.28, h * 0.48);
      g.fill();
      g.beginPath();
      g.moveTo(w * 0.7, h * 0.46);
      g.lineTo(w * 0.84, h * 0.5);
      g.lineTo(w * 0.7, h * 0.52);
      g.fill();
    },
    dryad: function (g, w, h) {
      g.fillStyle = "#2f6b45";
      g.fillRect(w * 0.46, h * 0.4, w * 0.08, h * 0.38);
      blob(g, w * 0.5, h * 0.32, w * 0.14, h * 0.1, "#3d8a52");
      blob(g, w * 0.38, h * 0.4, w * 0.08, h * 0.06, "#4e9a5c");
      blob(g, w * 0.64, h * 0.38, w * 0.08, h * 0.06, "#4e9a5c");
      blob(g, w * 0.5, h * 0.46, w * 0.04, h * 0.05, "#e4c2a2");
    },
    bear: function (g, w, h) {
      blob(g, w * 0.5, h * 0.62, w * 0.2, h * 0.16, "#4a3428");
      blob(g, w * 0.5, h * 0.4, w * 0.12, h * 0.1, "#5a4032");
      blob(g, w * 0.4, h * 0.32, w * 0.04, h * 0.04, "#3a241c");
      blob(g, w * 0.6, h * 0.32, w * 0.04, h * 0.04, "#3a241c");
    },
    mage: function (g, w, h) {
      g.fillStyle = "#3a2418";
      g.beginPath();
      g.moveTo(w * 0.34, h * 0.8);
      g.lineTo(w * 0.5, h * 0.3);
      g.lineTo(w * 0.66, h * 0.8);
      g.fill();
      flame(g, w * 0.72, h * 0.58, h / 140, true);
      g.fillStyle = "#67c48a";
      g.globalAlpha = 0.7;
      g.beginPath();
      g.arc(w * 0.3, h * 0.5, h * 0.06, 0, 7);
      g.fill();
      g.globalAlpha = 1;
    },
    golem: function (g, w, h) {
      g.fillStyle = "#6d6458";
      g.fillRect(w * 0.36, h * 0.42, w * 0.28, h * 0.32);
      g.fillRect(w * 0.4, h * 0.26, w * 0.2, h * 0.16);
      g.fillRect(w * 0.24, h * 0.48, w * 0.12, h * 0.08);
      g.fillRect(w * 0.64, h * 0.48, w * 0.12, h * 0.08);
      g.fillStyle = "#f0b429";
      g.fillRect(w * 0.44, h * 0.32, w * 0.12, 3);
    },
    snake: function (g, w, h) {
      g.strokeStyle = "#3d7a45";
      g.lineWidth = Math.max(8, w * 0.04);
      g.beginPath();
      g.moveTo(w * 0.15, h * 0.7);
      g.quadraticCurveTo(w * 0.4, h * 0.3, w * 0.6, h * 0.55);
      g.quadraticCurveTo(w * 0.8, h * 0.75, w * 0.7, h * 0.4);
      g.stroke();
      g.fillStyle = "#f0b429";
      g.beginPath();
      g.arc(w * 0.7, h * 0.38, 3, 0, 7);
      g.fill();
    },
    pirate: function (g, w, h) {
      g.fillStyle = "#8d3a32";
      g.fillRect(w * 0.4, h * 0.42, w * 0.18, h * 0.3);
      blob(g, w * 0.49, h * 0.36, w * 0.06, h * 0.06, "#e4c2a2");
      g.fillStyle = "#1a140f";
      g.beginPath();
      g.moveTo(w * 0.38, h * 0.34);
      g.lineTo(w * 0.66, h * 0.34);
      g.lineTo(w * 0.6, h * 0.42);
      g.lineTo(w * 0.4, h * 0.42);
      g.fill();
      g.strokeStyle = "#c9ced6";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(w * 0.7, h * 0.58, h * 0.04, 0.2, 3);
      g.stroke();
    },
    tree: function (g, w, h) {
      g.fillStyle = "#5a3a24";
      g.fillRect(w * 0.46, h * 0.5, w * 0.08, h * 0.28);
      blob(g, w * 0.5, h * 0.4, w * 0.18, h * 0.16, "#2f6b45");
      blob(g, w * 0.36, h * 0.48, w * 0.1, h * 0.08, "#3d8a52");
      g.fillStyle = "#5a3a24";
      g.fillRect(w * 0.3, h * 0.7, w * 0.06, h * 0.1);
      g.fillRect(w * 0.62, h * 0.7, w * 0.06, h * 0.1);
    },
    jester: function (g, w, h) {
      g.fillStyle = "#c43737";
      g.beginPath();
      g.moveTo(w * 0.38, h * 0.78);
      g.lineTo(w * 0.5, h * 0.4);
      g.lineTo(w * 0.62, h * 0.78);
      g.fill();
      g.fillStyle = "#f0b429";
      g.beginPath();
      g.moveTo(w * 0.4, h * 0.4);
      g.lineTo(w * 0.3, h * 0.22);
      g.lineTo(w * 0.5, h * 0.34);
      g.lineTo(w * 0.62, h * 0.18);
      g.lineTo(w * 0.58, h * 0.4);
      g.fill();
    },
    mirror: function (g, w, h) {
      g.strokeStyle = "#e0b15a";
      g.lineWidth = 6;
      g.strokeRect(w * 0.32, h * 0.22, w * 0.36, h * 0.5);
      g.fillStyle = "#8fb8c8";
      g.fillRect(w * 0.36, h * 0.28, w * 0.28, h * 0.38);
      moon(g, w * 0.5, h * 0.44, h * 0.06);
    },
    thirst: function (g, w, h) {
      moon(g, w * 0.75, h * 0.2, h * 0.1);
      g.fillStyle = "#2a1218";
      g.beginPath();
      g.moveTo(w * 0.38, h * 0.8);
      g.lineTo(w * 0.5, h * 0.28);
      g.lineTo(w * 0.62, h * 0.8);
      g.fill();
      g.fillStyle = "#e24b4b";
      g.beginPath();
      g.arc(w * 0.46, h * 0.42, 2, 0, 7);
      g.arc(w * 0.54, h * 0.42, 2, 0, 7);
      g.fill();
    },
    gaze: function (g, w, h) {
      blob(g, w * 0.5, h * 0.48, w * 0.1, h * 0.12, "#d7b48a");
      g.strokeStyle = "#3d7a45";
      g.lineWidth = 3;
      var i;
      for (i = -3; i <= 3; i++) {
        g.beginPath();
        g.moveTo(w * 0.5, h * 0.4);
        g.quadraticCurveTo(w * (0.5 + i * 0.08), h * 0.22, w * (0.5 + i * 0.1), h * 0.16);
        g.stroke();
      }
      g.fillStyle = "#f0b429";
      g.beginPath();
      g.arc(w * 0.5, h * 0.5, 4, 0, 7);
      g.fill();
    },
    phoenix: function (g, w, h) {
      flame(g, w * 0.5, h * 0.7, h / 70, true);
      g.fillStyle = "#f0b429";
      g.beginPath();
      g.moveTo(w * 0.2, h * 0.55);
      g.quadraticCurveTo(w * 0.5, h * 0.15, w * 0.8, h * 0.55);
      g.quadraticCurveTo(w * 0.5, h * 0.4, w * 0.2, h * 0.55);
      g.fill();
    },
    troll: function (g, w, h) {
      blob(g, w * 0.5, h * 0.6, w * 0.2, h * 0.18, "#5a6a48");
      blob(g, w * 0.5, h * 0.38, w * 0.12, h * 0.1, "#6a7a56");
      g.fillStyle = "#f4e7d0";
      g.fillRect(w * 0.44, h * 0.36, 4, 3);
      g.fillRect(w * 0.54, h * 0.36, 4, 3);
      g.fillStyle = "#3a2418";
      g.fillRect(w * 0.2, h * 0.62, w * 0.5, h * 0.04);
    },
    bow: function (g, w, h) {
      g.fillStyle = "#6b3a1e";
      g.beginPath();
      g.moveTo(w * 0.4, h * 0.78);
      g.lineTo(w * 0.5, h * 0.36);
      g.lineTo(w * 0.58, h * 0.78);
      g.fill();
      blob(g, w * 0.5, h * 0.32, w * 0.05, h * 0.05, "#e4c2a2");
      g.strokeStyle = "#c9a46a";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(w * 0.68, h * 0.5, h * 0.16, 0.6, 5.6);
      g.stroke();
    },
    bell: function (g, w, h) {
      g.fillStyle = "#e0b15a";
      g.beginPath();
      g.moveTo(w * 0.36, h * 0.32);
      g.lineTo(w * 0.64, h * 0.32);
      g.lineTo(w * 0.7, h * 0.62);
      g.quadraticCurveTo(w * 0.5, h * 0.74, w * 0.3, h * 0.62);
      g.fill();
      g.fillStyle = "#1a140f";
      g.beginPath();
      g.arc(w * 0.5, h * 0.6, 4, 0, 7);
      g.fill();
    },
    octo: function (g, w, h) {
      blob(g, w * 0.5, h * 0.42, w * 0.12, h * 0.1, "#6a3a6a");
      g.strokeStyle = "#6a3a6a";
      g.lineWidth = 6;
      var i;
      for (i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(w * 0.5, h * 0.5);
        g.quadraticCurveTo(w * (0.2 + i * 0.12), h * 0.7, w * (0.16 + i * 0.12), h * 0.84);
        g.stroke();
      }
    },
    smith: function (g, w, h) {
      g.fillStyle = "#3a342c";
      g.fillRect(w * 0.28, h * 0.62, w * 0.3, h * 0.08);
      g.fillStyle = "#8d97a3";
      g.fillRect(w * 0.55, h * 0.4, w * 0.16, h * 0.06);
      flame(g, w * 0.34, h * 0.62, h / 140, true);
      blob(g, w * 0.62, h * 0.36, w * 0.05, h * 0.05, "#e4c2a2");
    },
    ship: function (g, w, h) {
      g.fillStyle = "#3a2418";
      g.beginPath();
      g.moveTo(w * 0.18, h * 0.62);
      g.lineTo(w * 0.82, h * 0.62);
      g.lineTo(w * 0.7, h * 0.74);
      g.lineTo(w * 0.3, h * 0.74);
      g.fill();
      g.fillStyle = "#e6dcc8";
      g.beginPath();
      g.moveTo(w * 0.48, h * 0.62);
      g.lineTo(w * 0.48, h * 0.22);
      g.lineTo(w * 0.72, h * 0.5);
      g.fill();
    },
    hydra: function (g, w, h) {
      g.strokeStyle = "#3d7a45";
      g.lineWidth = 8;
      var i;
      for (i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(w * 0.5, h * 0.75);
        g.quadraticCurveTo(w * (0.3 + i * 0.2), h * 0.4, w * (0.28 + i * 0.22), h * 0.28);
        g.stroke();
        g.fillStyle = "#f0b429";
        g.beginPath();
        g.arc(w * (0.28 + i * 0.22), h * 0.26, 3, 0, 7);
        g.fill();
      }
    },
    priest: function (g, w, h) {
      g.fillStyle = "#f4e7d0";
      g.beginPath();
      g.moveTo(w * 0.34, h * 0.8);
      g.lineTo(w * 0.5, h * 0.28);
      g.lineTo(w * 0.66, h * 0.8);
      g.fill();
      g.strokeStyle = "#e0b15a";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(w * 0.5, h * 0.24, h * 0.06, 0, 7);
      g.stroke();
    },
    lich: function (g, w, h) {
      g.fillStyle = "#d7c4a8";
      blob(g, w * 0.5, h * 0.36, w * 0.07, h * 0.08, "#d7c4a8");
      g.fillStyle = "#1a140f";
      g.fillRect(w * 0.44, h * 0.34, 5, 3);
      g.fillRect(w * 0.54, h * 0.34, 5, 3);
      g.fillStyle = "#3a2418";
      g.fillRect(w * 0.4, h * 0.46, w * 0.2, h * 0.28);
      g.fillStyle = "#e0b15a";
      g.beginPath();
      g.moveTo(w * 0.4, h * 0.28);
      g.lineTo(w * 0.5, h * 0.18);
      g.lineTo(w * 0.6, h * 0.28);
      g.fill();
    },
    griffin: function (g, w, h) {
      blob(g, w * 0.46, h * 0.66, w * 0.16, h * 0.1, "#c9a46a");
      g.fillStyle = "#e6d2b0";
      g.beginPath();
      g.moveTo(w * 0.4, h * 0.5);
      g.quadraticCurveTo(w * 0.2, h * 0.28, w * 0.5, h * 0.4);
      g.fill();
      g.beginPath();
      g.moveTo(w * 0.55, h * 0.48);
      g.lineTo(w * 0.72, h * 0.42);
      g.lineTo(w * 0.58, h * 0.54);
      g.fill();
    },
    sea: function (g, w, h) {
      g.strokeStyle = "#1d4e6e";
      g.lineWidth = 14;
      g.beginPath();
      g.moveTo(0, h * 0.7);
      g.quadraticCurveTo(w * 0.3, h * 0.2, w * 0.6, h * 0.55);
      g.quadraticCurveTo(w * 0.8, h * 0.75, w, h * 0.4);
      g.stroke();
    },
    lizard: function (g, w, h) {
      blob(g, w * 0.45, h * 0.64, w * 0.18, h * 0.08, "#6a7a32");
      g.fillStyle = "#6a7a32";
      g.beginPath();
      g.moveTo(w * 0.6, h * 0.6);
      g.lineTo(w * 0.82, h * 0.5);
      g.lineTo(w * 0.62, h * 0.66);
      g.fill();
      g.fillStyle = "#f0b429";
      g.beginPath();
      g.arc(w * 0.74, h * 0.54, 3, 0, 7);
      g.fill();
    },
    titan: function (g, w, h) {
      g.fillStyle = "#3a4048";
      g.fillRect(w * 0.28, h * 0.28, w * 0.44, h * 0.5);
      g.fillRect(w * 0.36, h * 0.12, w * 0.28, h * 0.18);
      castle(g, w * 0.2, h * 0.7, h / 280);
      castle(g, w * 0.8, h * 0.72, h / 300);
    },
    plague: function (g, w, h) {
      g.fillStyle = "rgba(90,140,70,.35)";
      g.fillRect(0, h * 0.3, w, h * 0.5);
      var i;
      for (i = 0; i < 5; i++) {
        g.fillStyle = "#14181c";
        g.beginPath();
        g.ellipse(w * (0.2 + i * 0.15), h * (0.28 + (i % 2) * 0.06), 10, 4, -0.4, 0, 7);
        g.fill();
      }
    },
    tentacle: function (g, w, h) {
      g.strokeStyle = "#1d4e6e";
      g.lineWidth = 10;
      var i;
      for (i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(w * (0.15 + i * 0.15), h);
        g.quadraticCurveTo(w * (0.2 + i * 0.14), h * 0.4, w * (0.1 + i * 0.16), h * 0.22);
        g.stroke();
      }
    },
    fallen: function (g, w, h) {
      g.fillStyle = "#2a2430";
      g.beginPath();
      g.moveTo(w * 0.38, h * 0.8);
      g.lineTo(w * 0.5, h * 0.3);
      g.lineTo(w * 0.62, h * 0.8);
      g.fill();
      g.fillStyle = "rgba(180,180,190,.35)";
      g.beginPath();
      g.moveTo(w * 0.5, h * 0.4);
      g.lineTo(w * 0.18, h * 0.55);
      g.lineTo(w * 0.48, h * 0.5);
      g.fill();
      g.beginPath();
      g.moveTo(w * 0.5, h * 0.4);
      g.lineTo(w * 0.82, h * 0.52);
      g.lineTo(w * 0.52, h * 0.5);
      g.fill();
    }
  };

  function arcaneGrade(g, w, h) {
    var i, x, y;
    g.save();
    g.globalCompositeOperation = "overlay";
    g.globalAlpha = 0.22;
    g.lineCap = "round";
    for (i = 0; i < 70; i++) {
      x = (i * 53) % w;
      y = (i * 37) % h;
      g.strokeStyle = i % 3 === 0 ? "#e7a15a" : i % 3 === 1 ? "#1f6d78" : "#c45a78";
      g.lineWidth = 1.5 + (i % 4);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 18, y - 10, x + 42, y + 6);
      g.stroke();
    }
    g.restore();
    g.save();
    g.globalCompositeOperation = "multiply";
    var wash = g.createLinearGradient(0, 0, w, h);
    wash.addColorStop(0, "rgba(10, 42, 52, 0.55)");
    wash.addColorStop(0.55, "rgba(28, 18, 24, 0.2)");
    wash.addColorStop(1, "rgba(92, 28, 24, 0.35)");
    g.fillStyle = wash;
    g.fillRect(0, 0, w, h);
    g.restore();
    g.save();
    g.globalCompositeOperation = "screen";
    var rim = g.createRadialGradient(w * 0.72, h * 0.18, 8, w * 0.55, h * 0.35, w * 0.75);
    rim.addColorStop(0, "rgba(240, 150, 70, 0.34)");
    rim.addColorStop(0.45, "rgba(180, 60, 90, 0.08)");
    rim.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rim;
    g.fillRect(0, 0, w, h);
    g.restore();
    var vig = g.createRadialGradient(w * 0.5, h * 0.45, w * 0.15, w * 0.5, h * 0.5, w * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.62)");
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
  }

  function draw(canvas, id, kind) {
    var w = canvas.width;
    var h = canvas.height;
    var key = "arcane2:" + kind + ":" + id + ":" + w + "x" + h;
    if (!cache[key]) {
      var off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      var g = off.getContext("2d");
      if (kind === "place") (places[id] || places.piazza)(g, w, h);
      else if (kind === "back") {
        g.fillStyle = "#140e0c";
        g.fillRect(0, 0, w, h);
        g.strokeStyle = "#c6a15b";
        g.lineWidth = Math.max(3, w * 0.03);
        g.strokeRect(w * 0.08, h * 0.06, w * 0.84, h * 0.88);
        dragon(g, w * 0.22, h * 0.62, h / 220, { fire: true });
      } else if (kind === "title") {
        sky(g, w, h, "fire");
        stars(g, w, h, rnd(1), 40);
        ridge(g, w, h, "#2a120e", h * 0.62, 24);
        castle(g, w * 0.18, h * 0.58, h / 160);
        castle(g, w * 0.84, h * 0.56, h / 180);
        ground(g, w, h, "#5a3424");
        knight(g, w * 0.28, h * 0.78, h / 200, { plume: "#f0b429" });
        dragon(g, w * 0.52, h * 0.5, h / 190, { fire: true });
      } else if (scenes[id]) {
        scenes[id](g, w, h);
      } else {
        varied(g, w, h, id);
      }
      arcaneGrade(g, w, h);
      cache[key] = off;
    }
    canvas.getContext("2d").drawImage(cache[key], 0, 0);
  }

  function paintAll(scope) {
    var nodes = (scope || document).querySelectorAll("canvas[data-art]");
    var i;
    for (i = 0; i < nodes.length; i++) {
      draw(nodes[i], nodes[i].dataset.art, nodes[i].dataset.kind || "card");
    }
  }

  root.LumePaint = { paintAll: paintAll, draw: draw };
})(window);
