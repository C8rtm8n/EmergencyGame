// ============================================================================
//  bg.js — parallax backgrounds, generated per (type, mood) and cached.
//  Layers: sky (static) -> far mountains + volcano -> sea / tree line ->
//  near foliage -> (gameplay) -> foreground ferns. Plus animated extras:
//  clouds, sea sparkle, light rays, mist, fireflies, ash, rain.
// ============================================================================
'use strict';
(function () {
  var P = Z.Pix, C = Z.C;
  var MOODS = [
    { // 0 morning coast
      sky: ['#5aa9e6', '#74bdee', '#98d2f2', '#c2e6f2', '#f2e6c4'], sun: '#fff3c4', sunY: 34,
      far: '#9cbfd0', farD: '#83a9bd', smoke: '#dfe9ee', sea: ['#4a9ad0', '#3a86c2', '#2f6fa8'], seaHi: '#cdeff5',
      mid: '#4f8f78', midD: '#3b7563', near: '#2f6a45', nearD: '#23572b', fg: '#1d3f24', canopy: '#2f6a3a', canopyL: '#4f9a4a', clouds: '#ffffff', cloudD: '#cfe6f0'
    },
    { // 1 deep jungle (green gloom)
      sky: ['#1b3327', '#23422f', '#2f5638', '#446c43', '#5e8750'], sun: '#e8f0a0', sunY: 20,
      far: '#3a5e44', farD: '#314f3a', smoke: '#6f8a6a', sea: ['#2a4a3a', '#22402f', '#1a3326'], seaHi: '#6f9a6a',
      mid: '#244a31', midD: '#1b3a26', near: '#173222', nearD: '#10261a', fg: '#0a1810', canopy: '#1f4a2a', canopyL: '#346a3a', clouds: null,
      rays: true, mist: true, fireflies: true
    },
    { // 2 afternoon river temple
      sky: ['#e39a48', '#eab25a', '#f0c878', '#f5dc9c', '#f8ecc4'], sun: '#fff0b0', sunY: 44,
      far: '#c68e6a', farD: '#ad7658', smoke: '#e6c8a8', sea: ['#5a9a8a', '#468a7a', '#367060'], seaHi: '#d8f0d8',
      mid: '#7d8a4a', midD: '#66743c', near: '#4a5e2e', nearD: '#3a4a24', fg: '#26321a', canopy: '#56702e', canopyL: '#7c9a3e', clouds: '#fff4dc', cloudD: '#f0d8b0'
    },
    { // 3 sunset volcano
      sky: ['#3a1638', '#6e1d3a', '#b3323a', '#e0603a', '#f7a84a'], sun: '#ffd27a', sunY: 120,
      far: '#4a1a2e', farD: '#3a1426', smoke: '#5a3a44', sea: ['#7a2a3a', '#5a1e30', '#3a1426'], seaHi: '#f7a84a',
      mid: '#2e1224', midD: '#240e1c', near: '#1c0b18', nearD: '#140812', fg: '#0c050c', canopy: '#2a1020', canopyL: '#3a1a2a', clouds: '#e87a5a', cloudD: '#b84a4a',
      ash: true, lava: true
    }
  ];
  Z.MOODS = MOODS;
  var cache = {};

  function sky(m) {
    return P.mk(Z.W, Z.H, function (g) {
      var bands = m.sky, bh = Math.ceil(Z.H * 0.75 / bands.length);
      for (var i = 0; i < bands.length; i++) {
        P.R(g, bands[i], 0, i * bh, Z.W, bh + 1);
        if (i > 0) P.dither(g, bands[i], 0, i * bh - 2, Z.W, 2, 0);
      }
      P.R(g, bands[bands.length - 1], 0, bands.length * bh, Z.W, Z.H);
      // sun with a pixel halo
      var sx = 236, sy = m.sunY;
      for (var r = 22; r > 12; r -= 4) { g.globalAlpha = 0.12; P.disc(g, m.sun, sx, sy, r); }
      g.globalAlpha = 1; P.disc(g, m.sun, sx, sy, 11);
      if (m.lava) { for (var k = 0; k < 4; k++) P.R(g, bands[2], sx - 14, sy + 2 + k * 3, 28, 1); }
    });
  }
  // far mountains + volcano (tile width 640)
  function far(m, type) {
    var W = 640;
    return P.mk(W, 120, function (g) {
      var y, x;
      for (x = 0; x < W; x++) {
        y = 78 + Math.sin(x * 0.011) * 10 + Math.sin(x * 0.037 + 1) * 5 + Math.sin(x * 0.09) * 2;
        P.R(g, m.farD, x, Math.round(y), 1, 120);
      }
      // volcano cone
      var vx = 420, top = type === 'volcano' ? 10 : 22;
      P.poly(g, m.far, [[vx - 120, 120], [vx - 14, top], [vx + 14, top], [vx + 130, 120]]);
      P.poly(g, m.farD, [[vx + 4, top], [vx + 14, top], [vx + 130, 120], [vx + 40, 120]]);
      if (m.lava) { P.R(g, '#f08a2e', vx - 12, top, 24, 2); P.line(g, '#d0413c', vx - 4, top + 2, vx - 14, top + 30, 1); P.line(g, '#f08a2e', vx + 6, top + 2, vx + 12, top + 24, 1); }
      // smoke plume
      for (var i = 0; i < 7; i++) { g.globalAlpha = 0.55 - i * 0.06; P.disc(g, m.smoke, vx - 4 + i * 7, top - 6 - i * 5, 5 + i, 3 + i * 0.6); }
      g.globalAlpha = 1;
      // nearer hills
      for (x = 0; x < W; x++) {
        y = 96 + Math.sin(x * 0.02 + 2) * 6 + Math.sin(x * 0.05) * 3;
        P.R(g, m.far, x, Math.round(y), 1, 120);
      }
    });
  }
  // sea band for beaches
  function sea(m) {
    return P.mk(Z.W, 80, function (g) {
      P.R(g, m.sea[0], 0, 0, Z.W, 6); P.R(g, m.sea[1], 0, 6, Z.W, 18); P.R(g, m.sea[2], 0, 24, Z.W, 60);
      P.dither(g, m.sea[1], 0, 5, Z.W, 2, 0); P.dither(g, m.sea[2], 0, 23, Z.W, 2, 1);
      P.R(g, m.seaHi, 0, 0, Z.W, 1);
      for (var i = 0; i < 40; i++) { var x = Z.hash(i, 3) * Z.W | 0, y = 3 + (Z.hash(i, 5) * 40 | 0); P.R(g, m.sea[0], x, y, 3 + (Z.hash(i, 7) * 8 | 0), 1); }
    });
  }
  function palm(g, col, x, y, h, lean) {
    for (var i = 0; i < h; i++) P.R(g, col, Math.round(x + Math.sin(i / h * 1.4) * lean), y - i, 3, 1);
    var tx = Math.round(x + Math.sin(1.4) * lean) + 1, ty = y - h;
    for (var a = 0; a < 6; a++) {
      var ang = -Math.PI + a * Math.PI / 5, len = 14 + (a % 2) * 4;
      for (var k = 0; k < len; k++) {
        var px = tx + Math.cos(ang) * k, py = ty + Math.sin(ang) * k * 0.5 + (k * k) / (len * 2.2);
        P.R(g, col, Math.round(px), Math.round(py), 2, 1);
      }
    }
  }
  // mid layer: palms (beach) or tree line (jungle / temple / volcano)
  function mid(m, type) {
    var W = 480;
    return P.mk(W, 140, function (g) {
      var i, x;
      if (type === 'beach') {
        for (i = 0; i < 7; i++) palm(g, m.mid, 20 + i * 70 + (Z.hash(i, 1) * 30 | 0), 140, 50 + (Z.hash(i, 2) * 30 | 0), (Z.hash(i, 3) - 0.5) * 24);
        P.R(g, m.midD, 0, 132, W, 8);
        return;
      }
      if (type === 'volcano') {  // jagged lava-rock crags
        for (x = 0; x < W; x++) {
          var yc = 70 + Math.sin(x * 0.03) * 12 + Math.abs(Math.sin(x * 0.11)) * -14 + Z.hash(x >> 1, 4) * 3;
          P.R(g, m.mid, x, Math.round(yc), 1, 140);
          if (Math.sin(x * 0.11) > 0.96) P.R(g, '#f08a2e', x, Math.round(yc) + 6, 1, 12);
        }
        return;
      }
      for (x = 0; x < W; x += 1) {
        var y = 40 + Math.sin(x * 0.06) * 6 + Math.sin(x * 0.17) * 3 + Z.hash(x >> 3, 9) * 4;
        P.R(g, m.midD, x, Math.round(y), 1, 140);
      }
      for (i = 0; i < 10; i++) {
        x = i * 48 + (Z.hash(i, 4) * 20 | 0);
        P.R(g, m.mid, x, 30, 4 + (i % 3), 110);
        P.disc(g, m.mid, x + 2, 34, 16 + (i % 2) * 4, 9);
      }
      if (type === 'temple') {
        for (i = 0; i < 3; i++) { x = 60 + i * 160; P.R(g, m.mid, x, 60, 40, 80); P.R(g, m.midD, x + 4, 50, 32, 10); P.R(g, m.midD, x + 12, 40, 16, 10); P.R(g, m.midD, x + 16, 90, 8, 12); }
      }
    });
  }
  // near foliage with hanging vine silhouettes
  function near(m, type) {
    var W = 400;
    return P.mk(W, 100, function (g) {
      var x;
      if (type === 'beach') {
        for (x = 0; x < W; x++) { var y = 86 + Math.sin(x * 0.05) * 3 + Z.hash(x >> 2, 2) * 3; P.R(g, m.near, x, Math.round(y), 1, 20); }
        return;
      }
      for (x = 0; x < W; x++) {
        var yb = 70 + Math.sin(x * 0.045) * 8 + Math.sin(x * 0.13) * 4 + Z.hash(x >> 2, 6) * 3;
        P.R(g, m.near, x, Math.round(yb), 1, 40);
      }
    });
  }
  // hanging foliage along the top of jungle screens
  function top(m) {
    var W = 400;
    return P.mk(W, 60, function (g) {
      var x;
      for (x = 0; x < W; x++) {
        var yt = 6 + Math.sin(x * 0.05 + 1) * 5 + Z.hash(x >> 2, 8) * 4;
        P.R(g, m.near, x, 0, 1, Math.round(yt));
      }
      for (var i = 0; i < 9; i++) {
        x = 10 + i * 44 + (Z.hash(i, 11) * 20 | 0);
        var len = 14 + (Z.hash(i, 12) * 36 | 0);
        for (var k = 0; k < len; k++) P.R(g, m.nearD, x + Math.round(Math.sin(k * 0.2) * 1.5), 8 + k, 1, 1);
        P.R(g, m.nearD, x - 1, 8 + len, 3, 2);
      }
    });
  }
  function fg(m) {
    var W = 360;
    return P.mk(W, 26, function (g) {
      for (var i = 0; i < 16; i++) {
        var x = i * 24 + (Z.hash(i, 21) * 12 | 0), h = 12 + (Z.hash(i, 22) * 12 | 0);
        for (var k = -3; k <= 3; k++) P.line(g, m.fg, x, 26, x + k * 3, 26 - h + Math.abs(k) * 2, 1);
      }
    });
  }
  function cloud() {
    return P.mk(40, 14, function (g) { P.disc(g, '#fff', 12, 8, 8, 5); P.disc(g, '#fff', 22, 6, 9, 6); P.disc(g, '#fff', 31, 9, 7, 4); P.R(g, '#fff', 6, 10, 30, 4); });
  }

  Z.BG = {
    get: function (type, mood) {
      var key = type + mood;
      if (cache[key]) return cache[key];
      var m = MOODS[mood];
      var b = { type: type, m: m, sky: sky(m), far: far(m, type), mid: mid(m, type), near: near(m, type), top: type === 'jungle' ? top(m) : null, fg: type === 'beach' ? null : fg(m),
        sea: type === 'beach' ? sea(m) : null, cloud: m.clouds ? cloud() : null, t0: 0 };
      cache[key] = b; return b;
    },
    // Draw all back layers. camX/camY = camera top-left in world px, lvH = level height.
    draw: function (g, b, camX, camY, lvH, t) {
      var m = b.m, vy = (lvH - Z.H) - camY; // how far the camera is above the level bottom
      g.drawImage(b.sky, 0, 0);
      // clouds
      if (b.cloud) {
        g.globalAlpha = 0.85;
        for (var i = 0; i < 4; i++) {
          var cx = ((i * 97 + t * (2 + i) - camX * 0.05) % 420 + 420) % 420 - 50;
          g.drawImage(b.cloud, Math.round(cx), 14 + i * 11 + Math.round(vy * 0.05));
        }
        g.globalAlpha = 1;
      }
      tile(g, b.far, camX * 0.08, 52 + vy * 0.08);
      if (b.sea) {
        var sy = Math.round(112 + vy * 0.15);
        g.drawImage(b.sea, 0, sy);
        if (sy + 80 < Z.H) P.R(g, m.sea[2], 0, sy + 80, Z.W, Z.H - sy - 80);
        for (var k = 0; k < 14; k++) {  // sparkles
          if (Math.sin(t * 3 + k * 7.1) > 0.6) P.R(g, m.seaHi, (k * 53 + Math.floor(t * 4) - camX * 0.15 % 320 + 640) % 320 | 0, sy + 3 + (k * 13) % 30, 2, 1);
        }
      }
      tile(g, b.mid, camX * 0.3, (b.sea ? 40 : 40) + vy * 0.3, m.midD);
      if (m.rays) rays(g, t);
      tile(g, b.near, camX * 0.55, 80 + vy * 0.55, m.near);
      if (b.top) tile(g, b.top, camX * 0.55, -camY * 0.55);
      if (m.mist) mist(g, t, camX);
    },
    // Foreground ferns + ambient particles in front of the gameplay layer.
    drawFront: function (g, b, camX, camY, lvH, t) {
      var m = b.m;
      if (b.fg) { var y = Math.round(lvH - camY - 16); if (y < Z.H) tile(g, b.fg, camX * 1.25, y); }
      if (m.fireflies) for (var i = 0; i < 14; i++) {
        var fx = ((i * 67 + Math.sin(t * 0.5 + i) * 30 - camX * 0.7) % 340 + 340) % 340 - 10, fy = 40 + (i * 37) % 120 + Math.sin(t * 0.8 + i * 2) * 12;
        if (Math.sin(t * 2.3 + i * 1.7) > 0.2) P.R(g, '#e8f76a', fx | 0, fy | 0, 1, 1);
      }
      if (m.ash) for (var a = 0; a < 30; a++) {
        var ax = ((a * 41 + t * 6 + Math.sin(t + a) * 10 - camX * 0.9) % 330 + 330) % 330 - 5, ay = ((a * 29 + t * 14) % 190) - 5;
        P.R(g, a % 3 ? '#8a7a7a' : '#f08a2e', ax | 0, ay | 0, 1, 1);
      }
    }
  };
  function tile(g, img, ox, y, fillBelow) {
    y = Math.round(y);
    var x = -Math.round(((ox % img.width) + img.width) % img.width);
    for (; x < Z.W; x += img.width) g.drawImage(img, x, y);
    if (fillBelow && y + img.height < Z.H) P.R(g, fillBelow, 0, y + img.height, Z.W, Z.H - y - img.height);
  }
  function rays(g, t) {
    g.globalAlpha = 0.07 + Math.sin(t * 0.7) * 0.02;
    for (var i = 0; i < 4; i++) {
      var x = 30 + i * 80 + Math.sin(t * 0.2 + i) * 10;
      P.poly(g, '#f6f0a0', [[x, 0], [x + 14, 0], [x + 70, Z.H], [x + 40, Z.H]]);
    }
    g.globalAlpha = 1;
  }
  function mist(g, t, camX) {
    g.globalAlpha = 0.12;
    for (var i = 0; i < 3; i++) {
      var y = 110 + i * 22;
      for (var x = 0; x < Z.W; x += 4) {
        var h = 6 + Math.sin((x + camX * 0.4) * 0.03 + t * 0.4 + i) * 4;
        P.R(g, '#cfe8d0', x, Math.round(y - h / 2), 4, Math.round(h));
      }
    }
    g.globalAlpha = 1;
  }
})();
