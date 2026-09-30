// ============================================================================
//  scenes.js — title screen and the treasure-map level select.
// ============================================================================
'use strict';
(function () {
  var C = Z.C, F = Z.Font, UI = Z.UI, P = Z.Pix, R = P.R;

  // ------------------------------------------------------------ ships (shared with cutscenes)
  Z.buildShips = function () {
    function ship(broken) {
      return P.outline(P.mk(82, 60, function (g) {
        // masts
        R(g, C.woodD, 30, broken ? 22 : 4, 2, 38); R(g, C.woodD, 54, 10, 2, 30);
        if (broken) P.line(g, C.woodD, 31, 22, 12, 10, 2);
        // sails
        if (!broken) {
          P.poly(g, C.white, [[18, 8], [43, 8], [45, 22], [16, 22]]); P.poly(g, C.parchD, [[38, 8], [43, 8], [45, 22], [40, 22]]);
          P.poly(g, C.white, [[19, 24], [42, 24], [44, 37], [17, 37]]); P.poly(g, C.parchD, [[37, 24], [42, 24], [44, 37], [39, 37]]);
          R(g, C.red, 31, 1, 7, 3); R(g, C.redD, 31, 3, 5, 1);
        } else {
          P.poly(g, C.white, [[19, 26], [42, 26], [44, 37], [30, 34], [17, 37]]); R(g, C.parchD, 26, 29, 3, 3);
        }
        P.poly(g, C.white, [[45, 14], [62, 14], [64, 26], [43, 26]]); P.poly(g, C.white, [[46, 28], [61, 28], [62, 38], [45, 38]]);
        if (broken) { R(g, C.parchD, 50, 16, 4, 6); P.poly(g, C.parchD, [[55, 30], [60, 29], [58, 36]]); }
        R(g, C.woodD, 16, 7, 30, 1); R(g, C.woodD, 43, 13, 22, 1);
        P.line(g, C.rope, 31, 5, 78, 34, 1); P.line(g, C.rope, 31, 5, 6, 38, 1);
        // hull
        P.poly(g, C.wood, [[2, 38], [78, 38], [70, 56], [12, 56]]);
        R(g, C.woodL, 4, 38, 72, 2); R(g, C.gold, 6, 43, 64, 1); R(g, C.woodD, 10, 51, 58, 5);
        for (var i = 14; i < 64; i += 9) R(g, C.ink, i, 45, 3, 2);
        P.poly(g, C.wood, [[58, 30], [78, 30], [78, 38], [58, 38]]); R(g, C.woodL, 58, 30, 20, 1); R(g, C.yellow, 70, 33, 2, 2);
        P.line(g, C.woodD, 78, 38, 82, 30, 1);
        if (broken) { P.poly(g, C.ink, [[30, 46], [36, 42], [40, 47], [37, 53], [31, 55], [27, 50]]); R(g, C.woodD, 33, 44, 1, 8); }
      }));
    }
    Z.S.ship = ship(false); Z.S.wreck = ship(true);
  };
  Z.drawRot = function (g, img, x, y, ang, ax, ay) {
    g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(ang);
    g.drawImage(img, -Math.round(ax === undefined ? img.width / 2 : ax), -Math.round(ay === undefined ? img.height / 2 : ay)); g.restore();
  };
  // Foreground beach strip with animated surf, used by title and cutscenes.
  Z.drawBeach = function (g, t, y0) {
    y0 = y0 || 148;
    R(g, C.sand, 0, y0, Z.W, Z.H - y0); R(g, C.sandL, 0, y0, Z.W, 2); R(g, C.white, 0, y0, Z.W, 1);
    for (var i = 0; i < 60; i++) R(g, C.sandD, (Z.hash(i, 1) * Z.W) | 0, y0 + 4 + ((Z.hash(i, 2) * 12) | 0), 1, 1);
    var wy = Z.H - 10 + Math.sin(t * 0.9) * 3;
    R(g, C.sandD, 0, Math.round(wy - 3), Z.W, 3);
    for (var x = 0; x < Z.W; x++) {
      var yy = Math.round(wy + Math.sin(x * 0.07 + t * 1.5) * 1.5);
      R(g, C.sea, x, yy, 1, Z.H - yy); R(g, C.seaL, x, yy, 1, 2);
      if ((x + Math.floor(t * 10)) % 9 < 4) R(g, C.foam, x, yy - 1, 1, 1);
    }
  };

  // ------------------------------------------------------------ title
  function Title() {}
  var T = Title.prototype;
  T.enter = function () {
    this.t = 0; this.bg = Z.BG.get('beach', 0); this.face = 1; this.gulls = [];
    var self = this;
    this.btns = new UI.Buttons([{ x: Z.W - 26, y: 4, w: 22, h: 18, icon: Z.S.gear, cb: function () { UI.settings(); } }]);
    Z.Audio.playSong('title'); Z.Audio.setAmbient('beach');
    Z.SDK.gameplayStop();
    for (var i = 0; i < 3; i++) this.gulls.push({ x: Z.rand(0, 320), y: Z.rand(70, 100), s: Z.rand(8, 14) });
  };
  T.update = function (dt) {
    this.t += dt;
    this.gulls.forEach(function (gl) { gl.x += gl.s * dt; if (gl.x > 340) { gl.x = -20; gl.y = Z.rand(70, 100); } });
  };
  T.draw = function (g) {
    var t = this.t;
    Z.BG.draw(g, this.bg, t * 4, 0, Z.H, t);
    this.gulls.forEach(function (gl) { var f = Math.floor(t * 4 + gl.x) % 2; R(g, C.white, gl.x | 0, gl.y | 0, 2, 1); R(g, C.white, (gl.x | 0) + 3, gl.y | 0, 2, 1); R(g, C.white, (gl.x | 0) + 2, (gl.y | 0) + f, 1, 1); });
    Z.drawBeach(g, t);
    Z.LevelGfx.deco(g, [26, 152, 'palm']);
    Z.drawRot(g, Z.S.wreck, 250, 140, -0.22);
    Z.drawFeet(g, Z.S.barrel, 196, 156); Z.drawFeet(g, Z.S.crate, 290, 158); Z.drawFeet(g, Z.S.shell, 140, 160); Z.drawFeet(g, Z.S.starfish, 70, 162);
    // hero looking at the wreck, sometimes scratching his head
    var ph = t % 7, frame = ph > 4.5 && ph < 6 ? (Math.floor(t * 6) % 2 ? 'scratch1' : 'scratch2') : (Math.floor(t * 1.6) % 2 ? 'idle2' : 'idle');
    var face = ph > 2.5 && ph < 3.5 ? '_l' : '';
    Z.drawFeet(g, Z.S['hero_' + frame + face], 120, 157);
    // wooden title sign hanging on ropes
    var sy = 12 + Math.round(Math.sin(t * 1.2) * 1);
    R(g, C.rope, 90, 0, 1, sy + 2); R(g, C.rope, 229, 0, 1, sy + 2);
    UI.plank(g, 60, sy, 200, 22); UI.plank(g, 64, sy + 20, 192, 20);
    var title = Z.t('title');
    F.draw(g, title, 161, sy + 14, C.sandL, { align: 'center', scale: 2 });
    F.draw(g, title, 160, sy + 13, C.ink, { align: 'center', scale: 2 });
    var sw = F.width(Z.t('subtitle')) + 20;
    UI.sign(g, Math.round(160 - sw / 2), sy + 52, sw, 15, '');
    F.draw(g, Z.t('subtitle'), 160, sy + 55, C.parch, { align: 'center', shadow: C.ink });
    if (Math.floor(t * 2) % 2 === 0) F.draw(g, Z.t('tap_start'), 160, 120, C.white, { align: 'center', outline: C.ink });
    this.btns.draw(g);
  };
  T.down = function (x, y) { this.btns.down(x, y); };
  T.move = function (x, y) { this.btns.move(x, y); };
  T.up = function (x, y) {
    if (this.btns.up(x, y)) return;
    Z.Audio.play('click');
    Z.go(function () {
      if (!Z.Save.d.seenIntro) Z.setScene(new Z.IntroScene());
      else Z.setScene(new MapScene());
    });
  };
  Z.TitleScene = Title;

  // ------------------------------------------------------------ island map
  var NODES = [
    [70, 300], [104, 312], [140, 302], [176, 312], [212, 302], [246, 290], [276, 304], [310, 308], [344, 298], [376, 286],
    [372, 256], [342, 244], [308, 236], [272, 226], [240, 210], [216, 186], [232, 160], [264, 150], [296, 158], [326, 168],
    [356, 182], [388, 196], [420, 206], [452, 214], [484, 206], [512, 190], [532, 168], [546, 146], [532, 126], [508, 116],
    [486, 126], [466, 116], [456, 100], [468, 88], [484, 84], [498, 92], [512, 82], [506, 70], [492, 62], [502, 50]
  ];
  var mapImg = null;
  function island(x, y) {
    var pts = [], cx = 330, cy = 190;
    for (var a = 0; a < Math.PI * 2; a += 0.04) {
      var r = 1 + 0.07 * Math.sin(3 * a) + 0.05 * Math.sin(7 * a + 1) + 0.025 * Math.sin(13 * a + 2) + 0.015 * Math.sin(29 * a);
      pts.push([cx + Math.cos(a) * 285 * r * (x || 1), cy + Math.sin(a) * 158 * r * (y || 1)]);
    }
    return pts;
  }
  function buildMap() {
    return P.mk(640, 360, function (g) {
      var i, sea = '#d6bd84', seaD = '#b89a5a';
      R(g, sea, 0, 0, 640, 360);
      for (i = 0; i < 90; i++) { var wx = Z.hash(i, 1, 9) * 630 | 0, wy = Z.hash(i, 2, 9) * 350 | 0; R(g, seaD, wx, wy, 2, 1); R(g, seaD, wx + 2, wy - 1, 2, 1); R(g, seaD, wx + 4, wy, 2, 1); }
      P.poly(g, seaD, island(1.04, 1.06));
      P.poly(g, C.ink, island(1.0, 1.0));
      P.poly(g, C.parch, island(0.99, 0.985));
      // beach tint on the south-west coast
      g.globalAlpha = 0.5; P.poly(g, C.sand, [[40, 270], [200, 300], [400, 300], [420, 330], [40, 340]]); g.globalAlpha = 1;
      P.poly(g, C.parch, island(0.93, 0.9));
      // jungle trees
      for (i = 0; i < 70; i++) {
        var tx = 150 + Z.hash(i, 3, 9) * 260, ty = 130 + Z.hash(i, 4, 9) * 120;
        if (Math.hypot((tx - 300) / 150, (ty - 200) / 70) > 1) continue;
        R(g, C.woodD, tx, ty + 3, 1, 3); P.disc(g, C.leaf, tx, ty, 3, 2); R(g, C.leafL, tx - 1, ty - 1, 2, 1);
      }
      // river
      var rx = 520, ry = 110;
      for (i = 0; i < 160; i++) { rx += 0.6; ry += 1.1 + Math.sin(i * 0.1) * 0.2; var ox = Math.sin(i * 0.15) * 8; R(g, C.sea, Math.round(rx + ox - 60), Math.round(ry), 2, 1); }
      // temple
      R(g, C.rock, 460, 222, 22, 4); R(g, C.rock, 464, 218, 14, 4); R(g, C.rock, 468, 214, 6, 4); R(g, C.ink, 470, 222, 2, 4);
      // volcano
      P.poly(g, C.woodD, [[440, 120], [492, 48], [512, 48], [566, 120]]);
      P.poly(g, C.wood, [[440, 120], [492, 48], [500, 48], [480, 120]]);
      R(g, C.red, 492, 46, 20, 3); P.line(g, C.orange, 498, 49, 490, 72, 1);
      for (i = 0; i < 5; i++) { g.globalAlpha = 0.5; P.disc(g, C.grey, 500 + i * 6, 38 - i * 6, 4 + i, 3 + i); } g.globalAlpha = 1;
      // wreck icon
      Z.drawRot(g, Z.S.wreck, 44, 318, -0.3);
      // compass rose
      var cx = 590, cy = 310;
      P.disc(g, seaD, cx, cy, 16); P.disc(g, sea, cx, cy, 14);
      P.poly(g, C.ink, [[cx, cy - 22], [cx + 4, cy], [cx, cy + 22], [cx - 4, cy]]); P.poly(g, C.ink, [[cx - 22, cy], [cx, cy - 4], [cx + 22, cy], [cx, cy + 4]]);
      P.poly(g, C.redD, [[cx, cy - 22], [cx + 4, cy], [cx - 4, cy]]);
      F.draw(g, 'N', cx - 2, cy - 34, C.ink);
      // sea monster doodle
      for (i = 0; i < 3; i++) { P.disc(g, seaD, 90 + i * 12, 60, 4, 4); P.disc(g, sea, 90 + i * 12, 62, 4, 3); }
      R(g, seaD, 124, 54, 3, 6); R(g, C.ink, 125, 55, 1, 1);
      // burnt border
      for (i = 0; i < 640; i += 2) { var d1 = 2 + Z.hash(i, 7, 9) * 4 | 0, d2 = 2 + Z.hash(i, 8, 9) * 4 | 0; R(g, C.woodD, i, 0, 2, d1); R(g, C.woodD, i, 360 - d2, 2, d2); }
      for (i = 0; i < 360; i += 2) { var d3 = 2 + Z.hash(i, 5, 9) * 4 | 0, d4 = 2 + Z.hash(i, 6, 9) * 4 | 0; R(g, C.woodD, 0, i, d3, 2); R(g, C.woodD, 640 - d4, i, d4, 2); }
    });
  }

  function MapScene() {}
  var M = MapScene.prototype;
  M.enter = function () {
    if (!mapImg) mapImg = buildMap();
    this.t = 0;
    this.unl = Z.Save.unlocked();
    var n = NODES[Math.min(this.unl, NODES.length - 1)];
    this.cam = { x: Z.clamp(n[0] - Z.W / 2, 0, 640 - Z.W), y: Z.clamp(n[1] - Z.H / 2, 0, 360 - Z.H) };
    this.drag = null;
    var self = this, S = Z.S;
    this.btns = new UI.Buttons([
      { x: 4, y: 4, w: 22, h: 18, label: '<', cb: function () { Z.go(function () { Z.setScene(new Title()); }); } },
      { x: Z.W - 26, y: 4, w: 22, h: 18, icon: S.gear, cb: function () { UI.settings(); } },
      { x: Z.W - 26, y: 28, w: 22, h: 18, icon: S.book, cb: function () { self.diary(); } },
      { x: Z.W - 26, y: 52, w: 22, h: 18, icon: S.film, cb: function () { self.memories(); }, hidden: !Object.keys(Z.Save.d.memories).length }
    ]);
    Z.Audio.playSong('title'); Z.Audio.setAmbient('beach');
    Z.SDK.gameplayStop();
  };
  M.update = function (dt) { this.t += dt; };
  M.nodeState = function (i) {
    if (i >= Z.LEVELS.length) return i === Z.LEVELS.length && i <= this.unl + 1 ? 'soon' : 'hidden';
    var s = Z.Save.level(Z.LEVELS[i].id);
    if (s) return 'done';
    return i <= this.unl ? 'open' : 'hidden';
  };
  M.draw = function (g) {
    var t = this.t, cx = Math.round(this.cam.x), cy = Math.round(this.cam.y), i, S = Z.S;
    g.drawImage(mapImg, -cx, -cy);
    // fog over chapters not reached yet
    var reached = Math.floor(Math.min(this.unl, Z.LEVELS.length) / 10);
    if (this.unl >= Z.LEVELS.length) reached = Math.floor(Z.LEVELS.length / 10);
    for (var ch = reached + 1; ch < 4; ch++) {
      for (i = ch * 10; i < ch * 10 + 10; i++) {
        var n = NODES[i];
        g.globalAlpha = 0.9; P.disc(g, '#e6d4a6', n[0] - cx + Math.sin(t * 0.5 + i) * 2, n[1] - cy, 22, 16); g.globalAlpha = 1;
        P.dither(g, C.parchD, n[0] - cx - 10, n[1] - cy - 4, 20, 8, i);
      }
    }
    // dotted path
    var lastShown = Math.min(this.unl + 1, NODES.length - 1);
    for (i = 0; i < lastShown; i++) {
      var a = NODES[i], b = NODES[i + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (this.nodeState(i + 1) === 'hidden') break;
      for (var k = 5; k < d - 4; k += 5) R(g, C.redD, Math.round(a[0] + (b[0] - a[0]) * k / d - cx), Math.round(a[1] + (b[1] - a[1]) * k / d - cy), 2, 2);
    }
    // nodes
    for (i = 0; i < NODES.length; i++) {
      var st = this.nodeState(i), x = NODES[i][0] - cx, y = NODES[i][1] - cy;
      if (st === 'hidden') continue;
      if (st === 'done') {
        g.drawImage(S.x_mark, x - 4, y - 4);
        var stars = Z.Save.level(Z.LEVELS[i].id).stars;
        for (var s = 0; s < 3; s++) R(g, s < stars ? C.gold : C.parchD, x - 5 + s * 4, y + 7, 3, 3);
        F.draw(g, Z.LEVELS[i].id, x, y - 14, C.woodD, { align: 'center' });
      } else if (st === 'open') {
        var pr = 7 + Math.round(Math.sin(t * 4));
        P.disc(g, C.ink, x, y, pr + 1); P.disc(g, C.yellow, x, y, pr); P.disc(g, C.red, x, y, pr - 2);
        Z.drawFeet(g, S['hero_' + (Math.floor(t * 2) % 2 ? 'idle' : 'idle2')], x, y - 4 + Math.round(Math.abs(Math.sin(t * 3)) * -2));
        F.draw(g, Z.LEVELS[i].id, x, y + 9, C.redD, { align: 'center' });
      } else if (st === 'soon') {
        P.disc(g, C.ink, x, y, 7); P.disc(g, C.parchD, x, y, 6); F.draw(g, '?', x, y - 5, C.woodD, { align: 'center' });
        F.draw(g, Z.t('soon'), x + 10, y - 17, C.woodD, { align: 'center', shadow: C.parch });
      }
    }
    // header
    var chIdx = this.focusChapter();
    var head = Z.t('chapter', chIdx + 1) + ': ' + Z.tl('ch', chIdx);
    var hw = F.width(head) + 24;
    UI.sign(g, Math.round(Z.W / 2 - hw / 2), 4, hw, 16, head, C.yellow);
    var stxt = '' + Z.Save.totalStars();
    UI.plank(g, 30, 4, 36, 18); g.drawImage(S.star, 35, 8); F.draw(g, stxt, 47, 9, C.white, { shadow: C.ink });
    this.btns.draw(g);
  };
  M.focusChapter = function () {
    var best = 0, bd = 1e9, cx = this.cam.x + Z.W / 2, cy = this.cam.y + Z.H / 2;
    for (var i = 0; i < NODES.length; i++) { var d = Math.hypot(NODES[i][0] - cx, NODES[i][1] - cy); if (d < bd) { bd = d; best = i; } }
    return Math.floor(best / 10);
  };
  M.down = function (x, y) { if (this.btns.down(x, y)) return; this.drag = { x: x, y: y, sx: x, sy: y, moved: 0 }; };
  M.move = function (x, y) {
    this.btns.move(x, y);
    var d = this.drag; if (!d) return;
    this.cam.x = Z.clamp(this.cam.x - (x - d.x), 0, 640 - Z.W); this.cam.y = Z.clamp(this.cam.y - (y - d.y), 0, 360 - Z.H);
    d.moved += Math.abs(x - d.x) + Math.abs(y - d.y); d.x = x; d.y = y;
  };
  M.up = function (x, y) {
    if (this.btns.up(x, y)) return;
    var d = this.drag; this.drag = null;
    if (!d || d.moved > 6) return;
    var wx = x + this.cam.x, wy = y + this.cam.y;
    for (var i = 0; i < Math.min(NODES.length, Z.LEVELS.length); i++) {
      var st = this.nodeState(i);
      if ((st === 'open' || st === 'done') && Math.hypot(NODES[i][0] - wx, NODES[i][1] - wy) < 13) {
        Z.Audio.play('click');
        (function (idx) { Z.go(function () { Z.setScene(new Z.GameScene(idx)); }, x, y); })(i);
        return;
      }
    }
  };
  M.diary = function () {
    var pages = Z.Save.pages(), cur = 0, m;
    m = UI.open({ w: 250, h: 150, title: Z.t('diary'),
      body: function (g, x, y) {
        if (!pages.length) { F.draw(g, Z.t('no_pages'), x + 125, y + 50, C.woodD, { align: 'center' }); return; }
        var n = pages[cur];
        F.draw(g, Z.t('page', n), x + 125, y + 22, C.redD, { align: 'center' });
        F.wrap(Z.tl('pages', n - 1), 210).forEach(function (l, i) { F.draw(g, l, x + 20, y + 36 + i * 11, C.woodD); });
        F.draw(g, (cur + 1) + '/' + pages.length, x + 125, y + 100, C.parchD, { align: 'center' });
      },
      cols: 3,
      buttons: [
        { label: '<', cb: function () { if (pages.length) cur = (cur + pages.length - 1) % pages.length; } },
        { label: function () { return Z.t('back'); }, tone: 'green', cb: function () { UI.close(m); } },
        { label: '>', cb: function () { if (pages.length) cur = (cur + 1) % pages.length; } }
      ] });
  };
  M.memories = function () {
    var list = Object.keys(Z.Save.d.memories).map(Number).sort(), m;
    var btns = list.map(function (ch) {
      return { label: function () { return Z.t('memory') + ' ' + (ch + 1); }, icon: Z.S.film, cb: function () {
        UI.close(m); Z.go(function () { Z.setScene(new Z.MemoryScene(ch, function () { Z.go(function () { Z.setScene(new MapScene()); }); })); });
      } };
    });
    btns.push({ label: function () { return Z.t('back'); }, tone: 'green', cb: function () { UI.close(m); } });
    m = UI.open({ w: 180, h: 50 + btns.length * 26, title: Z.t('memories'), buttons: btns });
  };
  Z.MapScene = MapScene;
})();
