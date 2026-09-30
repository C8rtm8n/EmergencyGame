// ============================================================================
//  sprites.js — all pixel art is generated procedurally at boot (no image
//  files => tiny download). Sprites are drawn with fillRect-only primitives so
//  there is no anti-aliasing, then get an automatic 1 px dark outline.
// ============================================================================
'use strict';
(function () {
  var C = Z.C;

  // ------------------------------------------------------------ primitives
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function R(g, col, x, y, w, h) { g.fillStyle = col; g.fillRect(x | 0, y | 0, w || 1, h || 1); }
  // Bresenham line with a square brush of size t (top-left anchored)
  function line(g, col, x0, y0, x1, y1, t) {
    t = t || 1; g.fillStyle = col;
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) {
      g.fillRect(x0, y0, t, t);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // filled pixel disc / ellipse
  function disc(g, col, cx, cy, rx, ry) {
    ry = ry === undefined ? rx : ry; g.fillStyle = col;
    for (var y = -ry; y <= ry; y++) {
      var hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + 0.35) * (ry + 0.35)))));
      g.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
    }
  }
  // scanline polygon fill (no AA)
  function poly(g, col, pts) {
    g.fillStyle = col;
    var minY = 1e9, maxY = -1e9, i;
    for (i = 0; i < pts.length; i++) { minY = Math.min(minY, pts[i][1]); maxY = Math.max(maxY, pts[i][1]); }
    for (var y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      var xs = [], yy = y + 0.5;
      for (i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + (yy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort(function (p, q) { return p - q; });
      for (i = 0; i + 1 < xs.length; i += 2) { var x0 = Math.round(xs[i]), x1 = Math.round(xs[i + 1]); if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1); }
    }
  }
  // dither-fill a rect with checkerboard of col
  function dither(g, col, x, y, w, h, phase) {
    g.fillStyle = col;
    for (var j = 0; j < h; j++) for (var i = (j + (phase || 0)) & 1; i < w; i += 2) g.fillRect(x + i, y + j, 1, 1);
  }
  function outline(src, col) {
    var c = cv(src.width + 2, src.height + 2), g = c.getContext('2d');
    var s = cv(src.width, src.height), sg = s.getContext('2d');
    sg.drawImage(src, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = col || C.ink; sg.fillRect(0, 0, s.width, s.height);
    g.drawImage(s, 0, 1); g.drawImage(s, 2, 1); g.drawImage(s, 1, 0); g.drawImage(s, 1, 2);
    g.drawImage(src, 1, 1);
    return c;
  }
  function flip(src) {
    var c = cv(src.width, src.height), g = c.getContext('2d');
    g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); return c;
  }
  function rot90(src, ccw) {
    var c = cv(src.height, src.width), g = c.getContext('2d');
    if (ccw) { g.translate(0, src.width); g.rotate(-Math.PI / 2); } else { g.translate(src.height, 0); g.rotate(Math.PI / 2); }
    g.drawImage(src, 0, 0); return c;
  }
  function mk(w, h, fn) { var c = cv(w, h); fn(c.getContext('2d'), c); return c; }

  Z.Pix = { cv: cv, R: R, line: line, disc: disc, poly: poly, dither: dither, outline: outline, flip: flip, mk: mk };

  // ------------------------------------------------------------ hero
  // Pose = joint coordinates in a 20x22 frame (facing right, feet on row 21).
  // Limbs: [shoulder/hip, elbow/knee, hand/foot].
  var HERO = { skin: C.skin, skinD: C.skinD, pants: C.pants, pantsD: C.pantsD, band: C.red, bandD: C.redD, hair: C.hair, torso: null, hat: false, beard: false };
  function heroPose(p, pal) {
    pal = pal || HERO;
    return outline(mk(20, 22, function (g) {
      var d = p.drop || 0, hy = 5 + d + (p.hy || 0);
      function limb(col, L) { line(g, col, L[0][0], L[0][1], L[1][0], L[1][1], 1); line(g, col, L[1][0], L[1][1], L[2][0], L[2][1], 1); }
      function leg(L, pc, sc) {
        line(g, pc, L[0][0], L[0][1], L[1][0], L[1][1], 2);
        line(g, sc, L[1][0], L[1][1], L[2][0], L[2][1], 2);
        R(g, pc, L[1][0], L[1][1], 2, 1); // ragged trouser end
        R(g, sc, L[2][0] + (p.toe === -1 ? -1 : 2), L[2][1] + 1, 1, 1); // toes
      }
      limb(pal.skinD, p.ab);
      leg(p.lb, pal.pantsD, pal.skinD);
      // torso
      R(g, pal.torso || pal.skin, 8, 11 + d, 4, 5);
      R(g, pal.torso ? pal.pantsD : pal.skinD, 8, 11 + d, 1, 5);
      if (!pal.torso) R(g, pal.skinD, 10, 13 + d, 1, 1);
      // trousers + rope belt
      R(g, pal.pants, 7, 15 + d, 6, 2);
      R(g, C.rope, 7, 15 + d, 6, 1);
      leg(p.lf, pal.pants, pal.skin);
      // head
      var x = 7;
      R(g, pal.skin, x, hy + 1, 6, 5);
      R(g, pal.hair, x, hy + 2, 1, 2); R(g, pal.hair, x + 1, hy + 2, 1, 1);
      R(g, pal.skinD, x + 2, hy + 3, 1, 1);           // ear
      R(g, C.ink, x + 4, hy + 3, 1, 1);               // eye
      R(g, pal.skin, x + 6, hy + 3, 1, 1);            // nose
      R(g, pal.skinD, x + 3, hy + 5, 3, 1);           // stubble / chin
      if (pal.beard) { R(g, C.white, x + 1, hy + 4, 5, 2); R(g, C.white, x + 2, hy + 6, 3, 1); R(g, C.ink, x + 4, hy + 3, 1, 1); }
      if (pal.hat) {
        R(g, C.ink, x - 2, hy, 10, 2); R(g, C.night, x, hy - 2, 6, 2); R(g, C.gold, x + 2, hy - 1, 2, 1);
      } else {
        R(g, pal.band, x + 1, hy, 5, 1);              // bandana
        R(g, pal.band, x, hy + 1, 6, 1);
        R(g, C.white, x + 3, hy + 1, 1, 1);           // polka dot
        if (p.tail === 'fly') { R(g, pal.band, x - 1, hy + 1, 1, 1); R(g, pal.band, x - 3, hy + 1, 2, 1); R(g, pal.bandD, x - 4, hy + 2, 2, 1); }
        else if (p.tail === 'up') { R(g, pal.band, x - 1, hy, 1, 1); R(g, pal.bandD, x - 2, hy - 1, 1, 1); }
        else { R(g, pal.band, x - 1, hy + 1, 1, 2); R(g, pal.bandD, x - 2, hy + 3, 1, 1); }
      }
      if (p.mouth) R(g, C.ink, x + 5, hy + 5, 1, 1);
      limb(pal.skin, p.af);
    }));
  }
  var POSES = {
    idle: { ab: [[8, 12], [7, 14], [7, 16]], af: [[11, 12], [12, 14], [12, 16]], lb: [[8, 17], [8, 19], [8, 20]], lf: [[11, 17], [11, 19], [11, 20]] },
    idle2: { hy: 1, ab: [[8, 13], [7, 15], [7, 17]], af: [[11, 13], [12, 15], [12, 17]], lb: [[8, 17], [8, 19], [8, 20]], lf: [[11, 17], [11, 19], [11, 20]] },
    scratch1: { ab: [[8, 12], [7, 14], [7, 16]], af: [[11, 12], [14, 9], [12, 5]], lb: [[8, 17], [8, 19], [8, 20]], lf: [[11, 17], [11, 19], [11, 20]] },
    scratch2: { ab: [[8, 12], [7, 14], [7, 16]], af: [[11, 12], [14, 9], [13, 6]], lb: [[8, 17], [8, 19], [8, 20]], lf: [[11, 17], [11, 19], [11, 20]] },
    crouch: { drop: 3, ab: [[8, 15], [6, 17], [4, 18]], af: [[11, 15], [9, 17], [7, 18]], lb: [[8, 19], [10, 19], [8, 20]], lf: [[11, 19], [14, 19], [13, 20]], tail: 'fly' },
    fly: { ab: [[8, 12], [11, 10], [14, 8]], af: [[11, 12], [14, 10], [16, 7]], lb: [[8, 17], [6, 18], [4, 19]], lf: [[11, 17], [10, 19], [8, 20]], tail: 'fly', mouth: 1 },
    fall: { ab: [[8, 12], [6, 8], [5, 5]], af: [[11, 12], [13, 8], [14, 5]], lb: [[8, 17], [7, 19], [7, 20]], lf: [[11, 17], [13, 19], [12, 20]], tail: 'up', mouth: 1 },
    swing: { ab: [[8, 11], [7, 7], [9, 1]], af: [[11, 11], [12, 7], [10, 1]], lb: [[8, 17], [8, 19], [9, 20]], lf: [[10, 17], [11, 19], [11, 20]] },
    swing2: { ab: [[8, 11], [7, 7], [9, 1]], af: [[11, 11], [12, 7], [10, 1]], lb: [[8, 17], [7, 18], [5, 19]], lf: [[10, 17], [9, 19], [7, 20]], tail: 'fly' },
    cling: { ab: [[8, 12], [12, 13], [15, 13]], af: [[11, 12], [13, 11], [15, 9]], lb: [[8, 17], [11, 19], [14, 20]], lf: [[11, 17], [14, 16], [15, 18]] },
    flail1: { ab: [[8, 12], [6, 9], [4, 7]], af: [[11, 12], [13, 8], [13, 4]], lb: [[8, 17], [8, 19], [8, 20]], lf: [[11, 17], [11, 19], [11, 20]], tail: 'up', mouth: 1 },
    flail2: { ab: [[8, 12], [7, 8], [7, 4]], af: [[11, 12], [14, 9], [16, 7]], lb: [[8, 17], [8, 19], [8, 20]], lf: [[11, 17], [11, 19], [11, 20]], tail: 'up', mouth: 1 },
    wave1: { ab: [[8, 12], [7, 14], [7, 16]], af: [[11, 12], [14, 8], [16, 4]], lb: [[8, 17], [8, 19], [8, 20]], lf: [[11, 17], [11, 19], [11, 20]], mouth: 1 },
    wave2: { ab: [[8, 12], [7, 14], [7, 16]], af: [[11, 12], [13, 8], [12, 4]], lb: [[8, 17], [8, 19], [8, 20]], lf: [[11, 17], [11, 19], [11, 20]], mouth: 1 },
    win: { ab: [[8, 12], [6, 8], [5, 5]], af: [[11, 12], [13, 8], [15, 5]], lb: [[8, 17], [7, 19], [7, 20]], lf: [[11, 17], [12, 19], [12, 20]], mouth: 1 },
    land: { drop: 2, ab: [[8, 14], [6, 15], [5, 17]], af: [[11, 14], [13, 15], [14, 17]], lb: [[8, 18], [7, 19], [7, 20]], lf: [[11, 18], [12, 19], [12, 20]] }
  };

  // ------------------------------------------------------------ builders
  var S = Z.S = {};
  function both(name, img) { S[name] = img; S[name + '_l'] = flip(img); }

  function buildHero() {
    Object.keys(POSES).forEach(function (k) { both('hero_' + k, heroPose(POSES[k])); });
    S.hero_lie = rot90(S.hero_idle, true);          // lying on the beach
    var cap = { skin: C.skin, skinD: C.skinD, pants: C.woodD, pantsD: C.ink, band: C.red, bandD: C.redD, hair: C.grey, torso: C.deep, hat: true, beard: true };
    both('captain', heroPose(POSES.idle, cap));
    both('captain_give', heroPose(POSES.wave2, cap));
    var sailor = { skin: C.skinD, skinD: C.woodD, pants: C.pantsD, pantsD: C.ink, band: C.white, bandD: C.grey, hair: C.ink, torso: C.white };
    both('sailor', heroPose(POSES.idle, sailor));
    both('sailor2', heroPose(POSES.idle2, sailor));
  }

  function buildCritters() {
    // monkey 14x14
    function monkey(throwing) {
      return outline(mk(14, 15, function (g) {
        var B = C.wood, F = C.sandD;
        line(g, B, 10, 11, 12, 9); line(g, B, 12, 9, 12, 6); R(g, B, 11, 5, 1, 1);  // tail
        R(g, B, 4, 6, 6, 6); R(g, F, 5, 8, 4, 4);                                    // body
        R(g, B, 3, 0, 7, 6); R(g, F, 4, 2, 5, 4);                                    // head
        R(g, F, 2, 2, 1, 2); R(g, F, 10, 2, 1, 2);                                   // ears
        R(g, C.ink, 5, 3, 1, 1); R(g, C.ink, 7, 3, 1, 1); R(g, C.woodD, 6, 5, 1, 1);
        R(g, B, 4, 12, 2, 2); R(g, B, 8, 12, 2, 2);                                  // legs
        R(g, B, 3, 7, 1, 4);                                                          // arm
        if (throwing) { line(g, B, 10, 7, 11, 3); disc(g, C.woodD, 11, 2, 2); } else R(g, B, 10, 7, 1, 4);
      }));
    }
    both('monkey', monkey(false)); both('monkey_t', monkey(true));
    // coconut
    S.nut = outline(mk(5, 5, function (g) { disc(g, C.woodD, 2, 2, 2); R(g, C.wood, 1, 1, 1, 1); }));
    // parrot 9x6 (two frames)
    function parrot(up) {
      return outline(mk(10, 7, function (g) {
        R(g, C.red, 2, 2, 5, 2); R(g, C.red, 6, 1, 2, 2); R(g, C.yellow, 8, 2, 1, 1); R(g, C.ink, 7, 1, 1, 1);
        R(g, C.sea, 0, 3, 2, 1); R(g, C.seaL, 0, 4, 1, 1);
        if (up) { R(g, C.seaL, 3, 0, 3, 2); R(g, C.yellow, 3, 1, 3, 1); } else { R(g, C.seaL, 3, 4, 3, 2); R(g, C.yellow, 3, 4, 3, 1); }
      }));
    }
    both('parrot1', parrot(true)); both('parrot2', parrot(false));
    // crab (two frames)
    function crab(f) {
      return outline(mk(11, 7, function (g) {
        R(g, C.red, 2, 2, 7, 3); R(g, C.orange, 3, 2, 5, 1);
        R(g, C.red, 3, 0, 1, 2); R(g, C.red, 7, 0, 1, 2); R(g, C.ink, 3, 0, 1, 1); R(g, C.ink, 7, 0, 1, 1);
        R(g, C.red, 0, 1, 2, 2); R(g, C.red, 9, 1, 2, 2);
        R(g, C.redD, 1 + f, 5, 1, 2); R(g, C.redD, 4 - f, 5, 1, 2); R(g, C.redD, 6 + f, 5, 1, 2); R(g, C.redD, 9 - f, 5, 1, 2);
      }));
    }
    S.crab1 = crab(0); S.crab2 = crab(1);
    // croc 26x8 (closed / open)
    function croc(open) {
      return outline(mk(28, 10, function (g) {
        var G = C.leafD, L = C.leaf;
        R(g, G, 0, 5, 22, 4); R(g, L, 1, 5, 20, 1);
        for (var i = 2; i < 20; i += 3) R(g, G, i, 4, 2, 1);
        R(g, G, 17, 3, 3, 2); R(g, C.yellow, 18, 3, 1, 1); R(g, C.ink, 19, 3, 1, 1);
        if (open) { R(g, G, 19, 0, 8, 2); R(g, C.white, 20, 2, 7, 1); R(g, C.redD, 20, 3, 7, 2); R(g, G, 20, 6, 8, 2); R(g, C.white, 21, 5, 6, 1); }
        else { R(g, G, 19, 5, 9, 3); R(g, C.white, 21, 7, 1, 1); R(g, C.white, 24, 7, 1, 1); R(g, C.ink, 26, 5, 1, 1); }
      }));
    }
    both('croc', croc(false)); both('croc_o', croc(true));
    // carnivorous plant (closed / open) 14x22
    function plant(open) {
      return outline(mk(14, 22, function (g) {
        line(g, C.leafD, 7, 21, 6, 12, 2);
        poly(g, C.leaf, [[6, 18], [0, 14], [3, 19]]); poly(g, C.leaf, [[8, 17], [14, 13], [11, 19]]);
        if (open) {
          poly(g, C.purple, [[1, 1], [7, 6], [6, 9], [1, 6]]); poly(g, C.purple, [[13, 1], [7, 6], [8, 9], [13, 6]]);
          R(g, C.redD, 5, 5, 4, 5); R(g, C.white, 2, 3, 1, 2); R(g, C.white, 11, 3, 1, 2); R(g, C.white, 3, 6, 1, 1); R(g, C.white, 10, 6, 1, 1);
          R(g, C.pink, 2, 2, 1, 1); R(g, C.pink, 11, 2, 1, 1);
        } else {
          disc(g, C.purple, 7, 6, 5, 4); R(g, C.pink, 4, 4, 2, 1); R(g, C.pink, 9, 3, 1, 1);
          R(g, C.white, 3, 6, 9, 1); R(g, C.redD, 3, 7, 9, 1);
        }
      }));
    }
    S.plant = plant(false); S.plant_o = plant(true);
  }

  function buildItems() {
    S.compass = outline(mk(9, 9, function (g) { disc(g, C.gold, 4, 4, 4); disc(g, C.white, 4, 4, 3); R(g, C.red, 4, 1, 1, 3); R(g, C.ink, 4, 4, 1, 3); R(g, C.gold, 4, 4, 1, 1); R(g, C.yellow, 2, 1, 1, 1); }));
    S.bottle = outline(mk(7, 11, function (g) { R(g, C.woodL, 2, 0, 3, 2); R(g, C.leaf, 2, 2, 3, 2); R(g, C.leaf, 0, 4, 7, 7); R(g, C.leafL, 1, 5, 1, 4); R(g, C.white, 2, 5, 3, 4); R(g, C.parchD, 3, 6, 1, 2); }));
    S.spyglass = outline(mk(13, 6, function (g) {
      R(g, C.woodD, 0, 0, 5, 6); R(g, C.gold, 1, 1, 3, 4); R(g, C.seaL, 0, 1, 1, 4);   // wide end + lens
      R(g, C.gold, 5, 1, 4, 4); R(g, C.yellow, 5, 1, 4, 1); R(g, C.woodD, 8, 1, 1, 4);
      R(g, C.gold, 9, 2, 4, 2); R(g, C.yellow, 9, 2, 4, 1); R(g, C.ink, 12, 2, 1, 2);
    }));
    S.page = outline(mk(8, 10, function (g) { R(g, C.parch, 0, 0, 8, 10); R(g, C.parchD, 6, 0, 2, 2); R(g, C.parchD, 0, 9, 8, 1); for (var y = 2; y < 9; y += 2) R(g, C.woodD, 1, y, 5 - (y % 4 ? 1 : 0), 1); }));
    S.banana = outline(mk(8, 8, function (g) {
      poly(g, C.yellow, [[1, 1], [3, 5], [7, 6], [7, 7], [3, 7], [0, 4]]); R(g, C.gold, 1, 4, 2, 2); R(g, C.gold, 3, 6, 3, 1); R(g, C.woodD, 0, 0, 2, 1); R(g, C.woodD, 7, 6, 1, 1);
    }));
    S.banana_off = outline(mk(8, 8, function (g) { poly(g, C.rockD, [[1, 1], [3, 5], [7, 6], [7, 7], [3, 7], [0, 4]]); }), C.night);
    function star(col, col2) { return outline(mk(9, 9, function (g) { poly(g, col, [[4.5, 0], [6, 3], [9, 3.5], [6.8, 5.6], [7.5, 9], [4.5, 7.2], [1.5, 9], [2.2, 5.6], [0, 3.5], [3, 3]]); if (col2) R(g, col2, 4, 2, 1, 2); })); }
    S.star = star(C.yellow, C.white); S.star_off = star(C.rockD); S.star_big = null;
    S.hand = outline(mk(9, 11, function (g) { // tutorial pointing hand
      R(g, C.white, 3, 0, 2, 6); R(g, C.white, 1, 5, 7, 5); R(g, C.white, 0, 6, 1, 2); R(g, C.grey, 5, 5, 1, 2); R(g, C.grey, 7, 5, 1, 2); R(g, C.grey, 1, 9, 7, 1);
    }));
    S.lock = outline(mk(7, 8, function (g) { R(g, C.grey, 1, 0, 5, 1); R(g, C.grey, 1, 0, 1, 4); R(g, C.grey, 5, 0, 1, 4); R(g, C.gold, 0, 3, 7, 5); R(g, C.ink, 3, 5, 1, 2); }));
    S.gear = outline(mk(9, 9, function (g) { disc(g, C.parch, 4, 4, 3); for (var a = 0; a < 8; a++) { R(g, C.parch, Math.round(4 + Math.cos(a * Math.PI / 4) * 4), Math.round(4 + Math.sin(a * Math.PI / 4) * 4), 1, 1); } disc(g, C.woodD, 4, 4, 1); }));
    S.book = outline(mk(10, 8, function (g) { R(g, C.redD, 0, 0, 10, 8); R(g, C.parch, 1, 1, 8, 6); R(g, C.redD, 5, 0, 1, 8); R(g, C.parchD, 2, 3, 2, 1); R(g, C.parchD, 6, 3, 2, 1); }));
    S.film = outline(mk(10, 8, function (g) { R(g, C.ink, 0, 0, 10, 8); R(g, C.parch, 2, 2, 6, 4); for (var i = 0; i < 10; i += 2) { R(g, C.white, i, 0, 1, 1); R(g, C.white, i, 7, 1, 1); } }));
    S.skull = outline(mk(7, 7, function (g) { R(g, C.white, 1, 0, 5, 5); R(g, C.white, 2, 5, 3, 2); R(g, C.ink, 2, 2, 1, 1); R(g, C.ink, 4, 2, 1, 1); }));
    S.pause = mk(8, 8, function (g) { R(g, C.white, 1, 1, 2, 6); R(g, C.white, 5, 1, 2, 6); });
    S.play = mk(8, 8, function (g) { poly(g, C.white, [[1, 0], [7, 4], [1, 8]]); });
    S.x_mark = mk(9, 9, function (g) { line(g, C.redD, 1, 1, 7, 7, 2); line(g, C.redD, 7, 1, 1, 7, 2); });
  }

  // ------------------------------------------------------------ props (static)
  function buildProps() {
    S.crate = outline(mk(14, 12, function (g) { R(g, C.woodL, 0, 0, 14, 12); R(g, C.wood, 1, 1, 12, 10); line(g, C.woodL, 1, 1, 12, 10, 1); R(g, C.woodD, 0, 5, 14, 1); R(g, C.ink, 1, 1, 1, 1); R(g, C.ink, 12, 1, 1, 1); R(g, C.ink, 1, 10, 1, 1); R(g, C.ink, 12, 10, 1, 1); }));
    S.barrel = outline(mk(10, 12, function (g) { R(g, C.wood, 1, 0, 8, 12); R(g, C.wood, 0, 2, 10, 8); R(g, C.woodL, 2, 1, 2, 10); R(g, C.rockD, 0, 2, 10, 1); R(g, C.rockD, 0, 9, 10, 1); }));
    S.shell = outline(mk(7, 5, function (g) { poly(g, C.pink, [[0, 5], [3.5, 0], [7, 5]]); R(g, C.white, 3, 1, 1, 4); R(g, C.white, 1, 3, 1, 2); R(g, C.white, 5, 3, 1, 2); }));
    S.starfish = outline(mk(7, 7, function (g) { R(g, C.orange, 3, 0, 1, 7); R(g, C.orange, 0, 2, 7, 1); R(g, C.orange, 2, 1, 3, 4); R(g, C.orange, 1, 5, 1, 2); R(g, C.orange, 5, 5, 1, 2); R(g, C.yellow, 3, 2, 1, 1); }));
    S.stone = outline(mk(10, 6, function (g) { disc(g, C.rock, 5, 3, 4, 2); R(g, C.rockL, 3, 1, 3, 1); }));
    S.flower = outline(mk(7, 9, function (g) { line(g, C.leaf, 3, 4, 3, 8); R(g, C.leafL, 1, 6, 2, 1); R(g, C.pink, 2, 0, 3, 3); R(g, C.pink, 1, 1, 5, 1); R(g, C.yellow, 3, 1, 1, 1); }));
    S.sign = outline(mk(14, 16, function (g) { R(g, C.woodD, 6, 4, 2, 12); poly(g, C.woodL, [[0, 1], [10, 1], [13, 4.5], [10, 8], [0, 8]]); R(g, C.wood, 1, 6, 9, 1); }));
  }

  Z.buildSprites = function () {
    buildHero(); buildCritters(); buildItems(); buildProps();
  };

  // ------------------------------------------------------------ dynamic draw helpers
  // Draw a sprite anchored at feet/centre-bottom.
  Z.drawFeet = function (g, img, x, y) { g.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height + 1)); };
  Z.drawCenter = function (g, img, x, y) { g.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2)); };

  // Campfire (lit flickers procedurally, unlit smokes lightly)
  Z.drawCampfire = function (g, x, y, lit, t) {
    x = Math.round(x); y = Math.round(y);
    R(g, C.rockD, x - 7, y - 2, 3, 2); R(g, C.rock, x + 4, y - 2, 3, 2); R(g, C.rock, x - 4, y - 1, 8, 1);
    line(g, C.woodD, x - 6, y - 1, x + 5, y - 4, 2); line(g, C.wood, x - 5, y - 4, x + 6, y - 1, 2);
    if (lit) {
      for (var i = 0; i < 7; i++) {
        var fx = x - 3 + i, h = 4 + Math.floor(3 * Math.abs(Math.sin(t * 9 + i * 1.7)) + (i === 3 ? 3 : 0) - Math.abs(i - 3));
        R(g, C.orange, fx, y - 3 - h, 1, h); if (h > 3) R(g, C.yellow, fx, y - 3 - h + 2, 1, h - 3);
      }
      R(g, C.white, x, y - 6, 1, 2);
    } else {
      var sy = (t * 8) % 12;
      R(g, C.grey, x + Math.round(Math.sin(t * 2) * 1.5), y - 6 - sy, 2, 2);
    }
  };
  // Goal flag: pole + waving red bandana
  Z.drawFlag = function (g, x, y, t) {
    x = Math.round(x); y = Math.round(y);
    R(g, C.ink, x - 1, y - 27, 3, 27); R(g, C.woodL, x, y - 26, 1, 26); R(g, C.yellow, x - 1, y - 29, 3, 2);
    for (var i = 0; i < 10; i++) {
      var o = Math.round(Math.sin(t * 6 - i * 0.6) * (i / 6));
      R(g, i < 1 ? C.redD : C.red, x + 1 + i, y - 25 + o, 1, 6 - Math.floor(i / 4));
      if (i === 4) R(g, C.white, x + 1 + i, y - 23 + o, 1, 1);
    }
    R(g, C.stone || C.rockD, x - 3, y - 2, 7, 2);
  };
  // Mushroom / leaf bouncer with squash
  Z.drawBouncer = function (g, b) {
    var x = Math.round(b.x), y = Math.round(b.y), w = b.w, sq = Math.round(b.sq * 3);
    if (b.t === 'mush') {
      R(g, C.ink, x + w / 2 - 3, y + 5, 6, 8); R(g, C.white, x + w / 2 - 2, y + 5, 4, 8); R(g, C.parchD, x + w / 2 - 2, y + 10, 4, 2);
      var cy = y + 1 + sq, ch = 5 - sq;
      R(g, C.ink, x - 1, cy - 1, w + 2, ch + 3); R(g, C.red, x, cy, w, ch + 1); R(g, C.redD, x, cy + ch, w, 1);
      R(g, C.ink, x, cy - 1, 1, 1); R(g, C.ink, x + w - 1, cy - 1, 1, 1);
      for (var i = 2; i < w - 2; i += 6) R(g, C.white, x + i, cy + 1 + ((i / 6) & 1), 2, 2);
    } else {
      var droop = 2 + sq;
      for (var k = 0; k < w; k++) {
        var yy = y + Math.round(Math.sin(k / w * Math.PI) * -1 + (k / w) * droop);
        R(g, C.ink, x + k, yy - 1, 1, 5); R(g, k % 5 ? C.leafL : C.lime, x + k, yy, 1, 3);
      }
      line(g, C.leafD, x, y + 1, x + w - 2, y + 1 + droop, 1);
    }
  };
})();
