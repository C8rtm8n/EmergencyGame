// ============================================================================
//  levelgfx.js — level rendering.
//  Static geometry (ground, rocks, wreck planks, trunks, decorations, spikes)
//  is pre-rendered once into a level-sized canvas. Moving / animated things
//  (water, vines, branches, bouncers, actors, items) are drawn every frame.
// ============================================================================
'use strict';
(function () {
  var P = Z.Pix, C = Z.C, R = P.R, H = Z.hash;
  var SOIL = '#5a3a26', SOILD = '#3f2819', STONE = '#8a8f7a', STONED = '#62685a', BASALT = '#3a2a30', BASALTL = '#5a4048';

  // ------------------------------------------------------------ solids
  function drawSolid(g, s, bg) {
    var x = s.x, y = s.y, w = s.w, h = s.h, i, j;
    switch (s.t) {
      case 'sand':
        R(g, C.sand, x, y, w, h);
        for (j = 10; j < h; j += 1) if (j > 14) P.dither(g, C.sandD, x, y + j, w, 1, j); else if (j > 10) for (i = 0; i < w; i += 4) R(g, C.sandD, x + i + (j & 1) * 2, y + j, 1, 1);
        for (i = 0; i < w; i++) for (j = 2; j < Math.min(h, 12); j++) if (H(x + i, y + j, 1) < 0.05) R(g, C.sandD, x + i, y + j, 1, 1);
        R(g, C.sandL, x, y, w, 2); R(g, C.white, x, y, w, 1);
        for (i = 0; i < w; i++) if (H(x + i, y, 2) < 0.08) R(g, C.sandD, x + i, y + 2, 2, 1);
        break;
      case 'rock':
        R(g, C.rock, x, y, w, h);
        R(g, C.rockD, x + w - 2, y + 2, 2, h - 2); R(g, C.rockD, x, y + 2, 1, h - 2);
        for (i = 0; i < 8 + w * h / 90; i++) {
          var cx = x + 2 + (H(i, x, 3) * (w - 5) | 0), cy = y + 4 + (H(i, y, 4) * (h - 6) | 0), l = 2 + (H(i, 5, x) * 4 | 0);
          P.line(g, C.rockD, cx, cy, cx + l - 2, cy + l, 1);
          R(g, C.rockL, cx + 1, cy, 1, 1);
        }
        R(g, C.rockL, x + 1, y, w - 2, 2); R(g, C.white, x + 2, y, w - 4, 1);
        R(g, 'rgba(0,0,0,0)', x, y, 1, 1);
        g.clearRect(x, y, 1, 1); g.clearRect(x + w - 1, y, 1, 1);
        if (bg !== 'beach') for (i = 1; i < w - 1; i++) if (H(i, x, 7) < 0.45) { R(g, C.leaf, x + i, y, 1, 1 + (H(i, 9, x) * 3 | 0)); if (H(i, 3, y) < 0.3) R(g, C.leafL, x + i, y - 1, 1, 1); }
        break;
      case 'wreck':
        for (j = 0; j < h; j += 4) {
          R(g, (j / 4) % 2 ? C.wood : C.woodL, x, y + j, w, 4);
          R(g, C.woodD, x, y + j + 3, w, 1);
          for (i = ((j / 4) % 2) * 9; i < w; i += 18) { R(g, C.woodD, x + i, y + j, 1, 3); R(g, C.ink, x + i + 2, y + j + 1, 1, 1); }
        }
        R(g, C.woodL, x, y, w, 1); R(g, C.rope, x, y, w, 1);
        R(g, C.woodD, x, y, 1, h); R(g, C.woodD, x + w - 1, y, 1, h);
        for (i = 0; i < w; i += 2) if (H(i, x, 11) < 0.25) g.clearRect(x + i, y + h - 1 - (H(i, 1, x) * 3 | 0), 2, 4);
        break;
      case 'soil':
        R(g, SOIL, x, y, w, h);
        for (i = 0; i < w; i++) for (j = 4; j < h; j++) if (H(x + i, y + j, 12) < 0.07) R(g, SOILD, x + i, y + j, 1, 1);
        for (i = 0; i < w; i++) { var gh = 3 + (H(x + i, 0, 13) * 3 | 0); R(g, C.leaf, x + i, y, 1, gh); R(g, C.leafD, x + i, y + gh, 1, 1); }
        R(g, C.leafL, x, y, w, 1);
        for (i = 0; i < w; i += 1) if (H(x + i, 1, 14) < 0.25) R(g, H(i, x, 2) < 0.5 ? C.leafL : C.leaf, x + i, y - 1 - (H(i, 3, x) * 2 | 0), 1, 2);
        break;
      case 'stone':
        R(g, STONE, x, y, w, h);
        for (j = 0; j < h; j += 6) { R(g, STONED, x, y + j + 5, w, 1); for (i = ((j / 6) % 2) * 6; i < w; i += 12) R(g, STONED, x + i, y + j, 1, 6); }
        R(g, C.rockL, x, y, w, 1);
        break;
      case 'basalt':
        R(g, BASALT, x, y, w, h); R(g, BASALTL, x, y, w, 2);
        for (i = 0; i < w * h / 150; i++) { var bx = x + (H(i, x, 21) * w | 0), by = y + 4 + (H(i, y, 22) * (h - 4) | 0); P.line(g, i % 3 ? C.redD : C.orange, bx, by, bx + 3, by + 2, 1); }
        break;
    }
  }

  // ------------------------------------------------------------ trunks
  function drawTrunk(g, t) {
    var x = t.x, y = t.y, w = t.w, h = t.h, j;
    if (t.t === 'palm') {
      for (j = 0; j < h; j++) {
        R(g, j % 5 === 0 ? C.woodD : (j % 5 < 2 ? C.woodL : C.sandD), x, y + j, w, 1);
        R(g, C.woodD, x + w - 2, y + j, 2, 1);
      }
      R(g, C.ink, x - 1, y, 1, h); R(g, C.ink, x + w, y, 1, h);
      // fronds
      var cx = x + w / 2, cy = y - 1;
      for (var a = 0; a < 8; a++) {
        var ang = -Math.PI + a * Math.PI / 7 + 0.05, len = 16 + (a % 2) * 5;
        for (var k = 2; k < len; k++) {
          var px = cx + Math.cos(ang) * k, py = cy + Math.sin(ang) * k * 0.45 + (k * k) / (len * 2.6);
          R(g, C.leafD, Math.round(px), Math.round(py), 2, 2);
          R(g, k % 3 ? C.leaf : C.leafL, Math.round(px), Math.round(py), 2, 1);
        }
      }
      P.disc(g, C.woodD, cx - 2, cy + 3, 2); P.disc(g, C.wood, cx + 2, cy + 3, 2);
    } else {
      R(g, C.woodD, x, y, w, h);
      for (j = 0; j < h; j++) {
        R(g, C.wood, x + 1, y + j, w - 3, 1);
        if (H(j >> 2, x, 31) < 0.5) R(g, C.woodD, x + 3 + (H(j >> 3, x, 32) * (w - 6) | 0), y + j, 1, 1);
        if (H(j, x, 33) < 0.05) R(g, C.leaf, x + (H(j, 1, x) < 0.5 ? 0 : w - 2), y + j, 2, 2);
      }
      R(g, C.woodL, x + 1, y, 1, h);
      R(g, C.ink, x - 1, y, 1, h); R(g, C.ink, x + w, y, 1, h);
      // roots
      R(g, C.woodD, x - 3, y + h - 3, 3, 3); R(g, C.woodD, x + w, y + h - 3, 3, 3);
      // crown
      var cx2 = x + w / 2;
      P.disc(g, C.leafD, cx2, y - 4, 16, 8); P.disc(g, C.leaf, cx2 - 3, y - 6, 12, 6); P.disc(g, C.leafL, cx2 - 6, y - 8, 5, 3);
      R(g, C.woodD, x, y - 2, w, 3);
    }
  }
  function drawBranchImg(b) {
    var c = P.cv(b.w + 8, 10), g = c.getContext('2d'), w = b.w;
    var col = b.rot ? '#7a6a4a' : C.wood, colD = b.rot ? '#4a4030' : C.woodD, colL = b.rot ? '#9a8a60' : C.woodL;
    R(g, C.ink, 3, 0, w + 2, 6);
    R(g, col, 4, 1, w, 4); R(g, colL, 4, 1, w, 1); R(g, colD, 4, 4, w, 1);
    for (var i = 6; i < w; i += 7) R(g, colD, 4 + i, 2, 2, 1);
    if (b.rot) {
      for (var k = 5; k < w; k += 9) { R(g, C.ink, 4 + k, 1, 1, 3); R(g, C.lime, 4 + k + 2, 0, 2, 1); }
      R(g, C.white, 6, 5, 2, 2); R(g, C.white, w - 2, 5, 2, 1); R(g, C.parchD, 6, 6, 2, 1);
    } else {
      P.disc(g, C.leafD, w + 3, 3, 4, 3); P.disc(g, C.leaf, w + 2, 2, 3, 2); R(g, C.leafL, w + 1, 1, 2, 1);
      R(g, C.leaf, 12, 5, 2, 3); R(g, C.leafL, 12, 5, 1, 1);
    }
    return c;
  }

  // ------------------------------------------------------------ decorations
  function drawDeco(g, d, bg) {
    var x = d[0], y = d[1], t = d[2], i;
    switch (t) {
      case 'palm': {
        var h = 70, lean = 10;
        for (i = 0; i < h; i++) { var px = Math.round(x + Math.sin(i / h * 1.3) * lean); R(g, C.ink, px - 1, y - i, 6, 1); R(g, i % 4 ? C.woodL : C.woodD, px, y - i, 4, 1); }
        var tx = Math.round(x + Math.sin(1.3) * lean) + 2, ty = y - h;
        for (var a = 0; a < 9; a++) {
          var ang = -Math.PI + a * Math.PI / 8, len = 18 + (a % 2) * 6;
          for (var k = 2; k < len; k++) { var fx = tx + Math.cos(ang) * k, fy = ty + Math.sin(ang) * k * 0.5 + (k * k) / (len * 2.4); R(g, C.leafD, Math.round(fx), Math.round(fy), 2, 2); R(g, C.leaf, Math.round(fx), Math.round(fy), 2, 1); }
        }
        P.disc(g, C.woodD, tx - 2, ty + 3, 2); P.disc(g, C.wood, tx + 2, ty + 4, 2);
        break;
      }
      case 'canopy': {
        var w = d[3] || 320;
        for (i = 0; i < w; i += 6) {
          var r = 8 + (H(i, 1, 41) * 8 | 0), cy = 2 + (H(i, 2, 41) * 8 | 0);
          P.disc(g, C.leafD, x + i, y + cy, r, r * 0.7);
        }
        for (i = 0; i < w; i += 9) { var r2 = 5 + (H(i, 3, 41) * 5 | 0); P.disc(g, C.leaf, x + i, y + 3 + (H(i, 4, 41) * 6 | 0), r2, r2 * 0.6); }
        for (i = 0; i < w; i += 13) R(g, C.leafL, x + i, y + 2 + (H(i, 5, 41) * 6 | 0), 3, 1);
        for (i = 0; i < w; i += 23) { var l = 6 + (H(i, 6, 41) * 18 | 0); for (var k2 = 0; k2 < l; k2++) R(g, C.leafD, x + i + Math.round(Math.sin(k2 * 0.3)), y + 12 + k2, 1, 1); R(g, C.leaf, x + i - 1, y + 12 + l, 3, 2); }
        break;
      }
      case 'grass':
        for (i = 0; i < 9; i++) P.line(g, i % 2 ? C.leaf : C.leafL, x + i, y, x + i + ((i % 3) - 1) * 2, y - 3 - (i * 7 % 5), 1);
        break;
      case 'fern':
        for (i = -4; i <= 4; i++) { P.line(g, C.leafD, x, y, x + i * 3, y - 10 + Math.abs(i) * 1.5, 1); P.line(g, C.leaf, x, y - 1, x + i * 3, y - 11 + Math.abs(i) * 1.5, 1); }
        break;
      case 'bush':
        P.disc(g, C.leafD, x, y - 5, 10, 6); P.disc(g, C.leaf, x - 2, y - 7, 7, 4); R(g, C.leafL, x - 5, y - 9, 3, 1); R(g, C.red, x + 3, y - 6, 2, 2); R(g, C.red, x - 4, y - 4, 2, 2);
        break;
      case 'mast':
        R(g, C.ink, x - 3, y - 50, 6, 50); R(g, C.wood, x - 2, y - 50, 4, 50); R(g, C.woodL, x - 2, y - 50, 1, 50);
        R(g, C.ink, x - 18, y - 42, 30, 4); R(g, C.woodL, x - 17, y - 41, 28, 2);
        P.poly(g, C.white, [[x - 16, y - 38], [x + 10, y - 38], [x + 4, y - 22], [x - 6, y - 30]]);
        P.poly(g, C.parchD, [[x + 4, y - 22], [x + 10, y - 38], [x + 6, y - 38]]);
        P.line(g, C.rope, x - 16, y - 38, x - 26, y, 1);
        for (i = 0; i < 5; i++) R(g, C.ink, x - 3 + (i % 2) * 4, y - 52 - i, 2, 1);
        break;
      case 'crate': Z.drawFeet(g, Z.S.crate, x, y); break;
      case 'barrel': Z.drawFeet(g, Z.S.barrel, x, y); break;
      case 'shell': Z.drawFeet(g, Z.S.shell, x, y); break;
      case 'starfish': Z.drawFeet(g, Z.S.starfish, x, y); break;
      case 'stone': Z.drawFeet(g, Z.S.stone, x, y); break;
      case 'flower': Z.drawFeet(g, Z.S.flower, x, y); break;
      case 'sign': Z.drawFeet(g, Z.S.sign, x, y); break;
      case 'skull': Z.drawFeet(g, Z.S.skull, x, y); break;
    }
  }
  function drawSpikes(g, z) {
    for (var x = z.x; x < z.x + z.w; x += 8) {
      if (z.t === 'spikes') {
        P.disc(g, C.ink, x + 4, z.y + 5, 4, 3); P.disc(g, C.purple, x + 4, z.y + 5, 3, 2);
        for (var a = 0; a < 7; a++) { var an = -Math.PI + a * Math.PI / 6; P.line(g, C.ink, x + 4, z.y + 5, x + 4 + Math.round(Math.cos(an) * 6), z.y + 5 + Math.round(Math.sin(an) * 5), 1); }
      } else {
        P.line(g, C.leafD, x + 4, z.y + 10, x + 4, z.y + 3, 1);
        P.line(g, C.leafD, x + 4, z.y + 7, x + 1, z.y + 4, 1); P.line(g, C.leafD, x + 4, z.y + 8, x + 7, z.y + 5, 1);
        P.disc(g, C.leafD, x + 4, z.y + 2, 2, 2); R(g, C.purple, x + 3, z.y - 1, 3, 2); R(g, C.pink, x + 4, z.y - 1, 1, 1);
        R(g, C.ink, x + 1, z.y + 2, 1, 1); R(g, C.ink, x + 7, z.y + 2, 1, 1); R(g, C.ink, x + 4, z.y - 2, 1, 1);
      }
    }
    R(g, SOILD, z.x, z.y + 10, z.w, z.h - 10);
  }

  // ------------------------------------------------------------ build static layer
  Z.LevelGfx = {
    deco: drawDeco, solid: drawSolid,
    build: function (world) {
      var lv = world.lv, c = P.cv(world.w, world.h), g = c.getContext('2d'), bg = lv.bg;
      var deco = lv.deco || [];
      deco.forEach(function (d) { if (d[2] === 'canopy' || d[2] === 'palm') drawDeco(g, d, bg); });
      world.trunks.forEach(function (t) { drawTrunk(g, t); });
      world.hazards.forEach(function (z) { if (z.t === 'spikes' || z.t === 'thistle') drawSpikes(g, z); });
      world.solids.forEach(function (s) { drawSolid(g, s, bg); });
      deco.forEach(function (d) { if (d[2] !== 'canopy' && d[2] !== 'palm') drawDeco(g, d, bg); });
      world.branches.forEach(function (b) { b.img = drawBranchImg(b); });
      return c;
    },

    // ---------------------------------------------------------- dynamic layer
    drawDynamic: function (g, world, cx, cy, t) {
      var S = Z.S, i, vis = function (x, y, w, h) { return x + w > cx - 20 && x < cx + Z.W + 20 && y + h > cy - 40 && y < cy + Z.H + 40; };
      // wind / waterfalls
      world.winds.forEach(function (w) {
        if (!vis(w.x, w.y, w.w, w.h)) return;
        if (w.t === 'fall') {
          g.globalAlpha = 0.55; R(g, C.seaL, w.x - cx, w.y - cy, w.w, w.h); g.globalAlpha = 1;
          for (var k = 0; k < w.w; k += 2) { var off = (t * 90 + H(k, 1, 5) * 200) % w.h; R(g, C.foam, w.x + k - cx, w.y + off - cy, 1, 6); }
        } else {
          for (var q = 0; q < w.w * w.h / 400; q++) {
            var px = w.x + H(q, 1, 6) * w.w, spd = w.fy < 0 ? -1 : 1, py = w.y + ((H(q, 2, 6) * w.h + t * 60 * spd) % w.h + w.h) % w.h;
            if (w.fx) px = w.x + ((H(q, 3, 6) * w.w + t * 50 * Math.sign(w.fx)) % w.w + w.w) % w.w;
            R(g, 'rgba(255,255,255,0.5)', px - cx, py - cy, w.fx ? 4 : 1, w.fx ? 1 : 4);
          }
        }
      });
      // liquids
      world.hazards.forEach(function (z) {
        if (z.t === 'spikes' || z.t === 'thistle' || !vis(z.x, z.y, z.w, z.h)) return;
        var top = z.y - cy, x0 = Math.max(z.x, cx - 2), x1 = Math.min(z.x + z.w, cx + Z.W + 2);
        var c1, c2, c3, hi;
        if (z.t === 'lava') { c1 = C.orange; c2 = C.red; c3 = C.redD; hi = C.yellow; }
        else if (z.t === 'river') { c1 = '#4f9a8a'; c2 = '#357a6a'; c3 = '#24584c'; hi = '#bfe8d0'; }
        else { c1 = C.seaL; c2 = C.sea; c3 = C.seaD; hi = C.foam; }
        for (var x = x0; x < x1; x++) {
          var wy = Math.round(Math.sin(x * 0.18 + t * 3) * 1 + Math.sin(x * 0.05 - t * 1.3));
          R(g, c2, x - cx, top + 2 + wy, 1, z.h);
          R(g, c1, x - cx, top + 1 + wy, 1, 3);
          if (((x + Math.floor(t * 6)) % 11) < 2) R(g, hi, x - cx, top + 1 + wy, 1, 1);
        }
        R(g, c3, x0 - cx, top + 9, x1 - x0, z.h);
        P.dither(g, c3, x0 - cx, top + 7, x1 - x0, 2, 0);
        if (z.t === 'lava') for (var b = 0; b < z.w / 20; b++) { var bx = z.x + H(b, 7, 3) * z.w, ph = (t * 1.3 + H(b, 8, 3) * 5) % 2; if (ph < 0.6) R(g, C.yellow, bx - cx, top + 2 - ph * 6, 2, 2); }
      });
      // crocs (bob in the water)
      world.crocs.forEach(function (c) {
        if (!vis(c.x, c.y - 10, 30, 20)) return;
        var img = c.open ? S.croc_o_l : S.croc_l;
        g.drawImage(img, Math.round(c.x - cx) - 2, Math.round(c.y - cy) - 9 + Math.round(Math.sin(t * 2 + c.x) * 0.6));
        // warning: jaws twitch just before opening
        if (!c.open && (c.tm % 3.2) > 1.8) R(g, C.white, c.x - cx + 1, c.y - cy - 4, 1, 1);
      });
      // branches
      world.branches.forEach(function (b) {
        if (b.dy > 300 || !vis(b.x, b.y + b.dy, b.w, 10)) return;
        var sh = b.st === 1 ? Math.round(Math.sin(t * 60) * 1) : 0;
        g.save();
        if (b.st === 2) { g.translate(b.x - cx + b.w / 2, b.y + b.dy - cy); g.rotate(b.dy * 0.01); g.drawImage(b.img, -b.w / 2 - 4, -1); }
        else g.drawImage(b.img, Math.round(b.x - cx) - 4 + sh, Math.round(b.y - cy) - 1);
        g.restore();
      });
      world.bouncers.forEach(function (b) { if (vis(b.x, b.y, b.w, 14)) Z.drawBouncer(g, { x: b.x - cx, y: b.y - cy, w: b.w, t: b.t, sq: b.sq }); });
      // vines
      world.vines.forEach(function (v) {
        if (!vis(v.ax - v.len, v.ay, v.len * 2, v.len)) return;
        var sx = Math.sin(v.ang), cyy = Math.cos(v.ang);
        P.disc(g, C.leafD, v.ax - cx, v.ay - cy, 4, 3); R(g, C.leaf, v.ax - cx - 2, v.ay - cy - 2, 3, 1);
        for (var k = 0; k <= v.len; k += 1) {
          var px = Math.round(v.ax + sx * k - cx), py = Math.round(v.ay + cyy * k - cy);
          R(g, (k >> 1) % 2 ? C.leaf : C.leafD, px, py, 2, 1);
          if (k % 7 === 3) R(g, k % 14 === 3 ? C.leafL : C.leaf, px + (k % 14 === 3 ? 2 : -2), py, 2, 2);
        }
        var ex = Math.round(v.ax + sx * v.len - cx), ey = Math.round(v.ay + cyy * v.len - cy);
        R(g, C.leafL, ex - 1, ey, 3, 2);
      });
      // plants
      world.plants.forEach(function (p) {
        if (!vis(p.x - 8, p.y - 24, 16, 24)) return;
        var open = Math.sin(t * 2.2 + p.ph) > 0.2;
        Z.drawFeet(g, open ? S.plant_o : S.plant, p.x - cx, p.y - cy);
      });
      world.walkers.forEach(function (w) {
        if (!vis(w.x - 8, w.y - 8, 16, 8)) return;
        var img = w.t === 'crab' ? ((Math.floor(t * 8) % 2) ? S.crab1 : S.crab2) : S.crab1;
        Z.drawFeet(g, img, w.x - cx, w.y - cy);
      });
      world.monkeys.forEach(function (m) {
        if (!vis(m.x - 10, m.y - 20, 20, 20)) return;
        var img = m.thr > 0 ? S.monkey_t : S.monkey;
        if ((m.face || -1) < 0) img = m.thr > 0 ? S.monkey_t_l : S.monkey_l;
        Z.drawFeet(g, img, m.x - cx, m.y - cy + (m.thr > 0 ? 0 : Math.round(Math.sin(t * 3) * 0.5)));
      });
      world.nuts.forEach(function (n) { Z.drawCenter(g, S.nut, n.x - cx, n.y - cy); });
      world.checkpoints.forEach(function (c) { if (vis(c.x - 10, c.y - 20, 20, 20)) Z.drawCampfire(g, c.x - cx, c.y - cy, c.lit, t); });
      world.items.forEach(function (it) {
        if (it.got || !vis(it.x - 8, it.y - 8, 16, 16)) return;
        var bob = Math.round(Math.sin(t * 3 + it.x) * 1.5);
        if (Math.sin(t * 5 + it.x) > 0.7) { R(g, C.white, it.x - cx - 6, it.y - cy - 6 + bob, 1, 1); R(g, C.yellow, it.x - cx + 6, it.y - cy + 4 + bob, 1, 1); }
        Z.drawCenter(g, S[it.t], it.x - cx, it.y - cy + bob);
      });
      Z.drawFlag(g, world.goal.x - cx, world.goal.y - cy, t);
    }
  };
})();
