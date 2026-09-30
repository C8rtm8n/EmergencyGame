// ============================================================================
//  game.js — gameplay scene: drag & launch input, camera, hero animation,
//  effects, HUD, tutorial hand, hints, pause / win / fail / diary dialogs.
// ============================================================================
'use strict';
(function () {
  var P = Z.P, C = Z.C, F = Z.Font, UI = Z.UI, R = Z.Pix.R, S;
  var MUSIC_TR = [0, -2, 3, -4];            // chapter music transposition
  var AMB = ['beach', 'dusk', 'river', 'volcano'];

  function Game(idx) { this.idx = idx; this.lv = Z.LEVELS[idx]; }
  var G = Game.prototype;

  G.enter = function () {
    S = Z.S;
    var lv = this.lv;
    this.world = new Z.World(lv);
    this.static = Z.LevelGfx.build(this.world);
    this.bg = Z.BG.get(lv.bg, Z.CHAPTERS[lv.ch].mood);
    this.parts = new Z.Particles();
    this.t = 0; this.acc = 0; this.drag = null; this.shake = 0;
    this.anim = { idleT: 0, act: '', actT: 0, landT: 0, launchT: 0, look: 0 };
    this.got = []; this.extra = 0; this.failT = 0; this.winT = 0; this.done = false;
    this.launched = 0;
    this.hints = (lv.hint || []).slice(); this.hintT = 0;
    // intro pan: camera starts at the goal and flies to the hero
    this.cam = { x: 0, y: 0 };
    this.pan = 1.6; this.focus(lv.goal[0], lv.goal[1], true); this.panFrom = { x: this.cam.x, y: this.cam.y };
    this.banner = 2.6;
    this.btns = new UI.Buttons([{ x: Z.W - 26, y: 4, w: 22, h: 18, icon: S.pause, cb: this.pause.bind(this) }]);
    Z.Audio.playSong('jungle', MUSIC_TR[lv.ch]);
    Z.Audio.setAmbient(lv.bg === 'beach' ? 'beach' : (lv.ch === 0 ? 'jungle' : AMB[lv.ch]));
    Z.SDK.gameplayStart();
  };
  G.exit = function () { Z.Audio.stretchStop(); Z.SDK.gameplayStop(); };

  // camera target for a world point
  G.focus = function (x, y, snap) {
    var w = this.world, tx = Z.clamp(x - Z.W / 2, 0, w.w - Z.W), ty = Z.clamp(y - Z.H * 0.58, 0, w.h - Z.H);
    if (snap) { this.cam.x = tx; this.cam.y = ty; }
    return { x: tx, y: ty };
  };

  // ------------------------------------------------------------ update
  G.update = function (dt) {
    this.t += dt;
    this.parts.update(dt);
    if (this.shake > 0) this.shake -= dt;
    if (Z.modals.length) return;               // paused by a dialog
    var w = this.world, h = w.hero;
    if (this.banner > 0) this.banner -= dt;
    if (this.pan > 0) {
      this.pan -= dt;
      var to = this.focus(h.x, h.y), k = Z.ease(1 - this.pan / 1.6);
      this.cam.x = Z.lerp(this.panFrom.x, to.x, k); this.cam.y = Z.lerp(this.panFrom.y, to.y, k);
    }
    this.acc = Math.min(this.acc + dt, 0.1);
    while (this.acc >= P.dt) { w.step(P.dt); this.acc -= P.dt; }
    this.handleEvents();
    this.updateAnim(dt);
    if (this.pan <= 0) this.updateCamera(dt);
    // hints (after the pan)
    if (this.pan <= 0 && this.hints.length) { this.hintT += dt; if (this.hintT > 3.6) { this.hints.shift(); this.hintT = 0; } }
    // aiming sound
    if (this.drag && w.canLaunch()) Z.Audio.stretch(this.dragPower()); else Z.Audio.stretchStop();
    // win
    if (w.won && !this.done) {
      this.winT += dt;
      if (h.st === 'win' || this.winT > 1.2) { if (this.winT > 0.3) this.finish(); }
    }
    // out of bananas
    if (!w.won && !this.done && w.jumps <= 0 && (h.st === 'idle' || h.st === 'cling' || h.st === 'swing')) {
      this.failT += dt; if (this.failT > 0.9) this.fail();
    } else this.failT = 0;
  };

  G.updateCamera = function (dt) {
    var h = this.world.hero, tx = h.x, ty = h.y;
    if (h.st === 'dead' && h.dead > 0.6) { tx = this.world.cp.x; ty = this.world.cp.y; }
    // while aiming, look ahead in the launch direction
    if (this.drag && this.world.canLaunch()) {
      var v = this.dragVel();
      tx += v.x * 0.25; ty += v.y * 0.12;
    } else if (h.st === 'fly') { tx += h.vx * 0.3; ty += h.vy * 0.1; }
    var to = this.focus(tx, ty), k = 1 - Math.pow(0.02, dt);
    this.cam.x += (to.x - this.cam.x) * k; this.cam.y += (to.y - this.cam.y) * k;
  };

  // ------------------------------------------------------------ events -> fx/sfx
  G.handleEvents = function () {
    var w = this.world, A = Z.Audio, pp = this.parts, self = this;
    w.events.forEach(function (e) {
      switch (e.t) {
        case 'launch':
          A.play('launch', e.power); self.anim.launchT = 0.18; self.launched++;
          pp.add(w.hero.x, w.hero.y, 6, { c: [C.sandL, C.white], ang: -Math.PI / 2, spread: 1.2, min: 10, max: 40, life: 0.3, g: 100 });
          if (e.power > 0.93) { A.play('yell'); }
          break;
        case 'land': {
          self.anim.landT = 0.16; self.anim.idleT = 0;
          var k = e.kind === 'branch' ? 'leaves' : e.kind === 'trunk' ? 'wood' : e.t === 'wreck' || e.t === 'wreck' ? 'wood' : (e.t === 'sand' ? 'sand' : 'land');
          if (e.kind === 'solid' && e.t === 'wreck') k = 'wood';
          A.play(k);
          var col = e.kind === 'branch' ? [C.leaf, C.leafL] : e.t === 'sand' ? [C.sandL, C.sand] : e.t === 'soil' ? [C.leafL, C.woodD] : [C.rockL, C.grey];
          pp.add(e.x, e.y - 1, 6 + Math.min(8, e.speed / 40 | 0), { c: col, ang: -Math.PI / 2, spread: 1.4, min: 15, max: 45, life: 0.35, g: 200 });
          if (e.maxH > 70) self.shake = 0.12;
          break;
        }
        case 'bounce': A.play('bounce'); pp.add(e.x, e.y, 8, { c: e.t === 'mush' ? [C.red, C.white] : [C.leafL, C.lime], ang: -Math.PI / 2, spread: 1.3, min: 20, max: 60, life: 0.4 }); break;
        case 'cling': A.play('cling'); pp.add(e.x + w.hero.face * 4, e.y - 8, 5, { c: [C.woodL, C.wood], min: 10, max: 30, life: 0.3 }); break;
        case 'vine': A.play('vine'); pp.add(e.x, e.y - 18, 5, { c: [C.leaf, C.leafL], min: 10, max: 30, life: 0.5, g: 60 }); break;
        case 'crack': A.play('crack'); break;
        case 'break': A.play('break'); pp.add(e.x, e.y, 14, { c: ['#7a6a4a', '#4a4030', C.lime], min: 20, max: 60, life: 0.7, w: 12 }); break;
        case 'bump': A.play('land'); break;
        case 'die':
          self.drag = null; self.shake = 0.25;
          if (e.kind === 'water' || e.kind === 'river' || e.kind === 'croc') { A.play('splash'); pp.add(e.x, e.y - 2, 22, { c: [C.foam, C.seaL, C.white], ang: -Math.PI / 2, spread: 0.8, min: 40, max: 110, life: 0.6, g: 300 }); if (e.kind === 'croc') A.play('snap'); }
          else if (e.kind === 'lava') { A.play('sizzle'); pp.add(e.x, e.y, 20, { c: [C.orange, C.yellow, C.red], ang: -Math.PI / 2, spread: 0.9, min: 30, max: 90, life: 0.6 }); }
          else { A.play('hurt'); pp.add(e.x, e.y - 8, 10, { c: [C.white, C.yellow], min: 30, max: 70, life: 0.4, g: 0, drag: 4 }); }
          break;
        case 'respawn': A.play('checkpoint'); pp.add(w.hero.x, w.hero.y - 8, 16, { c: [C.yellow, C.orange, C.white], min: 20, max: 50, life: 0.5, g: -40 }); break;
        case 'item': self.collect(e.item); break;
        case 'checkpoint':
          A.play('checkpoint'); UI.toast(Z.t('hint_fire'), 1.6);
          pp.add(e.x, e.y - 6, 14, { c: [C.orange, C.yellow], ang: -Math.PI / 2, spread: 0.6, min: 20, max: 60, life: 0.6, g: -30 });
          break;
        case 'throw': A.play('throw'); break;
        case 'nut': A.play('nut'); pp.add(e.x, e.y, 8, { c: [C.woodD, C.white], min: 20, max: 60, life: 0.4 }); break;
        case 'snap': if (Math.abs(e.x - w.hero.x) < 200) A.play('snap'); break;
        case 'win': self.drag = null; A.play('collect'); break;
      }
    });
    w.events.length = 0;
  };

  G.collect = function (it) {
    var idx = this.world.items.indexOf(it);
    if (this.got.indexOf(idx) < 0) this.got.push(idx);
    this.parts.add(it.x, it.y, 16, { c: [C.yellow, C.white, C.gold], min: 20, max: 70, life: 0.6, g: 20, drag: 2 });
    if (it.t === 'page') {
      Z.Audio.play('page');
      var n = it.id, self = this;
      self.drag = null;
      UI.open({ w: 240, h: 128, title: Z.t('diary') + ' - ' + Z.t('page', n),
        body: function (g, x, y, t) {
          var lines = F.wrap(Z.tl('pages', n - 1), 200);
          var shown = Math.floor(t * 40);
          lines.forEach(function (l, i) { var s = l.slice(0, Math.max(0, shown - lines.slice(0, i).join('').length)); F.draw(g, s, x + 20, y + 26 + i * 11, C.woodD); });
          if (Math.sin(t * 5) > 0) F.draw(g, Z.t('tap_continue'), x + 120, y + 108, C.parchD, { align: 'center' });
          g.drawImage(S.page, x + 212, y + 8);
        },
        tap: function () { UI.close(); }
      });
    } else {
      Z.Audio.play('collect');
      UI.toast(Z.t('item_' + it.t), 1.8);
    }
  };

  // ------------------------------------------------------------ hero animation
  G.updateAnim = function (dt) {
    var a = this.anim, h = this.world.hero;
    a.landT -= dt; a.launchT -= dt;
    if (h.st === 'idle' && !this.drag) {
      a.idleT += dt;
      if (!a.act && a.idleT > 2.5 && Math.random() < dt * 0.6) { a.act = Math.random() < 0.5 ? 'look' : 'scratch'; a.actT = 0; }
    } else { a.idleT = 0; a.act = ''; }
    if (a.act) { a.actT += dt; if (a.actT > 1.6) { a.act = ''; a.idleT = 0; } }
  };
  G.heroFrame = function () {
    var w = this.world, h = w.hero, a = this.anim, t = this.t, face = h.face, name = 'idle', sx = 1, sy = 1;
    switch (h.st) {
      case 'idle':
        if (this.drag && w.canLaunch()) {
          var p = this.dragPower(), v = this.dragVel(); name = 'crouch'; sx = 1 + p * 0.22; sy = 1 - p * 0.28;
          if (Math.abs(v.x) > 5) face = v.x > 0 ? 1 : -1;
        } else if (a.landT > 0) name = 'land';
        else if (a.act === 'scratch') name = Math.floor(a.actT * 6) % 2 ? 'scratch1' : 'scratch2';
        else { name = Math.floor(t * 1.6) % 2 ? 'idle2' : 'idle'; if (a.act === 'look' && a.actT > 0.3 && a.actT < 1.2) face = -face; }
        break;
      case 'fly':
        name = h.vy < 40 ? 'fly' : 'fall';
        if (a.launchT > 0) { sx = 0.85; sy = 1.2; }
        break;
      case 'cling': name = 'cling'; if (this.drag && w.canLaunch()) { var pp = this.dragPower(); sx = 1 - pp * 0.15; sy = 1 - pp * 0.15; } break;
      case 'swing': name = Math.abs(h.swing.v.av) > 1 ? 'swing2' : 'swing'; break;
      case 'dead': name = Math.floor(t * 8) % 2 ? 'flail1' : 'flail2'; break;
      case 'win': name = Math.floor(t * 4) % 2 ? 'wave1' : 'win'; break;
    }
    return { img: S['hero_' + name + (face < 0 ? '_l' : '')], sx: sx, sy: sy };
  };

  // ------------------------------------------------------------ input
  G.dragVel = function () {
    var d = this.drag, dx = d.x - d.ax, dy = d.y - d.ay, l = Math.sqrt(dx * dx + dy * dy);
    if (l < 0.001) return { x: 0, y: 0 };
    var p = Math.min(l, P.dragMax) / P.dragMax;
    return { x: -dx / l * p * P.vmax, y: -dy / l * p * P.vmax };
  };
  G.dragPower = function () { var d = this.drag, dx = d.x - d.ax, dy = d.y - d.ay; return Math.min(Math.sqrt(dx * dx + dy * dy), P.dragMax) / P.dragMax; };
  G.down = function (x, y) {
    if (this.btns.down(x, y)) return;
    if (this.pan > 0) { this.pan = 0; return; }
    var h = this.world.hero;
    if (this.world.won || h.st === 'dead') return;
    this.drag = { ax: x, ay: y, x: x, y: y };
  };
  G.move = function (x, y) { this.btns.move(x, y); if (this.drag) { this.drag.x = x; this.drag.y = y; } };
  G.up = function (x, y) {
    if (this.btns.up(x, y)) return;
    var d = this.drag; this.drag = null; Z.Audio.stretchStop();
    if (!d) return;
    d.x = x; d.y = y;
    var dx = d.x - d.ax, dy = d.y - d.ay;
    if (Math.sqrt(dx * dx + dy * dy) < P.dragMin) return;
    this.drag = d; var v = this.dragVel(); this.drag = null;
    if (!this.world.launch(v.x, v.y) && this.world.canLaunch()) { this.shake = 0.08; Z.Audio.play('cling'); }
  };
  G.key = function (k) { if (k === 'Escape' || k === 'p' || k === 'P') this.pause(); };
  G.blur = function () { if (!Z.modals.length && !this.done) this.pause(); };

  // ------------------------------------------------------------ dialogs
  G.pause = function () {
    if (Z.modals.length || this.done) return;
    var self = this; this.drag = null; Z.Audio.stretchStop();
    Z.SDK.gameplayStop();
    var m = UI.open({ w: 170, h: 158, title: Z.t('pause'), buttons: [
      { label: function () { return Z.t('resume'); }, tone: 'green', cb: function () { UI.close(m); Z.SDK.gameplayStart(); } },
      { label: function () { return Z.t('restart'); }, cb: function () { UI.close(m); self.restart(); } },
      { label: function () { return Z.t('skip_level'); }, ad: true, cb: function () { self.skipLevel(); } },
      { label: function () { return Z.t('settings'); }, icon: S.gear, cb: function () { UI.settings(); } },
      { label: function () { return Z.t('map'); }, cb: function () { UI.close(m); Z.go(function () { Z.setScene(new Z.MapScene()); }); } }
    ] });
  };
  G.restart = function () {
    var idx = this.idx;
    Z.go(function () { Z.setScene(new Game(idx)); });
  };
  G.skipLevel = function () {
    var self = this;
    Z.SDK.rewarded(function (ok) {
      if (!ok) { UI.toast(Z.t('ad_fail')); return; }
      Z.modals.length = 0;
      if (!Z.Save.level(self.lv.id)) Z.Save.complete(self.lv.id, 0, []);
      self.done = true;
      self.next();
    });
  };
  G.fail = function () {
    if (this.done || Z.modals.length) return;
    var self = this; Z.Audio.play('fail'); Z.SDK.gameplayStop();
    var m = UI.open({ w: 180, h: 118, title: Z.t('out_of'),
      body: function (g, x, y, t) { for (var i = 0; i < 3; i++) g.drawImage(S.banana, x + 70 + i * 12, y + 24 + Math.round(Math.sin(t * 4 + i) * 1.5)); },
      buttons: [
        { label: function () { return Z.t('plus3'); }, ad: true, tone: 'green', disabled: this.extra > 0, cb: function () {
          Z.SDK.rewarded(function (ok) {
            if (!ok) { UI.toast(Z.t('ad_fail')); return; }
            UI.close(m); self.world.jumps += 3; self.extra += 3; self.failT = 0; Z.Audio.play('collect'); Z.SDK.gameplayStart();
          });
        } },
        { label: function () { return Z.t('retry'); }, cb: function () { UI.close(m); self.restart(); } },
        { label: function () { return Z.t('map'); }, cb: function () { UI.close(m); Z.go(function () { Z.setScene(new Z.MapScene()); }); } }
      ] });
  };
  G.stars = function () {
    var left = this.world.jumps, st = this.lv.stars;
    var s = left >= st[1] ? 3 : left >= st[0] ? 2 : 1;
    if (this.extra) s = 1;               // bought bananas => one star
    return s;
  };
  G.finish = function () {
    if (this.done) return;
    this.done = true;
    var self = this, lv = this.lv, stars = this.stars();
    var before = Z.Save.chapterItemsFound(lv.ch);
    Z.Save.complete(lv.id, stars, this.got);
    var after = Z.Save.chapterItemsFound(lv.ch);
    this.unlockMemory = after.got === after.total && after.total > 0 && !Z.Save.d.memories[lv.ch];
    if (this.unlockMemory) { Z.Save.d.memories[lv.ch] = true; Z.Save.write(); }
    Z.SDK.gameplayStop();
    Z.Audio.play('fanfare');
    var total = this.world.items.length;
    UI.open({ w: 210, h: 140, title: Z.t('level_done'),
      body: function (g, x, y, t) {
        for (var i = 0; i < 3; i++) {
          var appear = t - 0.4 - i * 0.35, img = i < stars ? S.star : S.star_off;
          if (appear > 0 && !self['starSnd' + i] && i < stars) { self['starSnd' + i] = 1; Z.Audio.play('star', i); }
          var sc = appear > 0 ? 2 : 0, bob = appear > 0 && appear < 0.15 ? -2 : 0;
          if (sc) g.drawImage(img, x + 60 + i * 32, y + 22 + bob + (i === 1 ? -3 : 0), img.width * 2, img.height * 2);
        }
        F.draw(g, Z.t('jumps') + ':', x + 30, y + 52, C.woodD);
        g.drawImage(S.banana, x + 30 + F.width(Z.t('jumps') + ':') + 4, y + 51); F.draw(g, 'x' + self.world.jumps, x + 30 + F.width(Z.t('jumps') + ':') + 16, y + 52, C.woodD);
        F.draw(g, Z.t('items') + ': ' + self.got.length + '/' + total, x + 120, y + 52, C.woodD);
        if (self.unlockMemory && Math.sin(t * 4) > -0.5) F.draw(g, Z.t('all_found'), x + 105, y + 66, C.redD, { align: 'center' });
        if (!self.unlockMemory && before.got !== after.got) F.draw(g, Z.t('collected', after.got, after.total), x + 105, y + 66, C.leafD, { align: 'center' });
      },
      cols: 3,
      buttons: [
        { label: function () { return Z.t('map'); }, cb: function () { Z.go(function () { Z.setScene(new Z.MapScene()); }); } },
        { label: function () { return Z.t('retry'); }, cb: function () { self.restart(); } },
        { label: function () { return Z.t('next'); }, tone: 'green', cb: function () { self.next(); } }
      ] });
  };
  // Continue after a level: memory scene / chapter end / next level.
  G.next = function () {
    var lv = this.lv, idx = this.idx, self = this;
    var chapterDone = Z.lastLevelOfChapter(lv.ch) === idx;
    Z.go(function () {
      var after = function () {
        if (chapterDone) Z.setScene(new Z.ChapterEndScene(lv.ch));
        else Z.setScene(idx + 1 < Z.LEVELS.length ? new Game(idx + 1) : new Z.MapScene());
      };
      if (self.unlockMemory) Z.setScene(new Z.MemoryScene(lv.ch, after));
      else after();
    });
  };

  // ------------------------------------------------------------ draw
  G.draw = function (g) {
    var w = this.world, h = w.hero, t = this.t;
    var sx = this.shake > 0 ? Math.round(Z.rand(-2, 2)) : 0, sy = this.shake > 0 ? Math.round(Z.rand(-2, 2)) : 0;
    var cx = Math.round(this.cam.x) + sx, cy = Math.round(this.cam.y) + sy;
    Z.BG.draw(g, this.bg, cx, cy, w.h, t);
    g.drawImage(this.static, -cx, -cy);
    // hero behind liquids when sinking
    var sinking = h.st === 'dead' && (h.kind === 'water' || h.kind === 'river' || h.kind === 'croc' || h.kind === 'lava');
    if (sinking) this.drawHero(g, cx, cy);
    Z.LevelGfx.drawDynamic(g, w, cx, cy, t);
    if (!sinking) this.drawHero(g, cx, cy);
    this.parts.draw(g, cx, cy);
    Z.BG.drawFront(g, this.bg, cx, cy, w.h, t);
    this.drawAim(g, cx, cy);
    this.drawTutorial(g, cx, cy);
    this.drawHUD(g);
  };
  G.drawHero = function (g, cx, cy) {
    var h = this.world.hero, f = this.heroFrame();
    if (!f.img) return;
    g.save();
    if (h.st === 'swing') {
      var hp = this.world.handPos();
      g.translate(Math.round(hp.x - cx), Math.round(hp.y - cy)); g.rotate(-h.swing.v.ang);
      g.drawImage(f.img, -11, -2);
    } else {
      g.translate(Math.round(h.x - cx), Math.round(h.y - cy));
      if (h.st === 'fly' && Math.abs(h.vx) > 20) g.rotate(Z.clamp(h.vx / 900, -0.25, 0.25));
      g.scale(f.sx, f.sy);
      g.drawImage(f.img, -11, -23);
    }
    g.restore();
  };
  G.drawAim = function (g, cx, cy) {
    var d = this.drag, w = this.world;
    if (!d || !w.canLaunch()) return;
    var v = this.dragVel(), valid = w.validLaunch(v.x, v.y), p = this.dragPower();
    // rubber band from touch anchor
    R(g, C.ink, d.ax - 2, d.ay - 2, 5, 5); R(g, C.white, d.ax - 1, d.ay - 1, 3, 3);
    var n = 10;
    for (var i = 1; i < n; i++) { if (i % 2) R(g, C.rope, Math.round(d.ax + (d.x - d.ax) * i / n), Math.round(d.ay + (d.y - d.ay) * i / n), 1, 1); }
    if (p < P.dragMin / P.dragMax) return;
    if (!valid) {
      var o = w.launchOrigin();
      g.drawImage(S.x_mark, Math.round(o.x - cx) - 4, Math.round(o.y - cy) - 30);
      return;
    }
    var pts = w.predict(v.x, v.y, P.previewTime);
    pts.forEach(function (pt, i) {
      var big = i % 2 === 0 && pt.t < 0.7, x = Math.round(pt.x - cx), y = Math.round(pt.y - cy);
      if (pt.t > 0.85 && i % 2) return;
      R(g, C.ink, x - 1, y - 1, big ? 4 : 3, big ? 4 : 3);
      R(g, p > 0.95 ? C.yellow : C.white, x, y, big ? 2 : 1, big ? 2 : 1);
    });
    // power meter above the hero
    var ho = w.launchOrigin(), mx = Math.round(ho.x - cx) - 8, my = Math.round(ho.y - cy) - 32;
    R(g, C.ink, mx - 1, my - 1, 18, 4); R(g, p > 0.95 ? C.orange : C.lime, mx, my, Math.round(16 * p), 2);
  };
  // Animated hand showing how to drag (first level, until the first launch).
  G.drawTutorial = function (g, cx, cy) {
    if (!this.lv.tutorial || this.launched > 0 || this.pan > 0 || this.drag || this.world.hero.st !== 'idle') return;
    var h = this.world.hero, t = this.t % 2.4, hx = Math.round(h.x - cx), hy = Math.round(h.y - cy);
    var ax = hx + 34, ay = hy - 40, k = Z.ease((t - 0.4) / 1.0), px = ax - 30 * k, py = ay + 22 * k;
    if (t > 0.4 && t < 1.8) {
      R(g, C.white, ax - 1, ay - 1, 3, 3);
      for (var i = 1; i < 8; i++) R(g, C.rope, Math.round(ax + (px - ax) * i / 8), Math.round(ay + (py - ay) * i / 8), 1, 1);
      for (var j = 1; j <= 7; j++) { var tt = j * 0.05 * k * 1.4; R(g, C.white, Math.round(hx + 150 * tt), Math.round(hy - 8 - 140 * tt + 190 * tt * tt), 2, 2); }
    }
    if (t < 2.0) g.drawImage(S.hand, Math.round(px) - 3, Math.round(py) - 1 + (t < 0.4 || t > 1.8 ? -3 : 0));
    F.draw(g, Z.t('hint_drag'), Z.W / 2, 40, C.white, { align: 'center', outline: C.ink });
  };
  G.drawHUD = function (g) {
    var w = this.world, lv = this.lv, total = lv.jumps + this.extra, i;
    // bananas
    UI.plank(g, 3, 3, Math.min(12, total) * 9 + 12 + (total > 12 ? 24 : 0), 18);
    if (total <= 12) {
      for (i = 0; i < total; i++) {
        var on = i < w.jumps, img = on ? S.banana : S.banana_off;
        var blink = on && w.jumps === 1 && Math.sin(this.t * 10) > 0;
        g.drawImage(img, 9 + i * 9, 8 - (blink ? 1 : 0));
      }
    } else {
      g.drawImage(S.banana, 9, 8); F.draw(g, 'x' + w.jumps, 21, 9, C.white, { shadow: C.ink });
    }
    // found items of this level
    var ix = Z.W - 34;
    for (i = w.items.length - 1; i >= 0; i--) {
      var it = w.items[i], im = S[it.t];
      ix -= im.width + 2;
      g.globalAlpha = it.got ? 1 : 0.3; g.drawImage(im, ix, 6 + Math.round((14 - im.height) / 2)); g.globalAlpha = 1;
    }
    this.btns.draw(g);
    // level banner
    if (this.banner > 0) {
      var k = Math.min(1, Math.min(this.banner, 2.6 - this.banner) * 3), text = lv.id + '  ' + Z.tl('levels', this.idx);
      var bw = F.width(text) + 24;
      UI.sign(g, Math.round(Z.W / 2 - bw / 2), Math.round(-24 + 50 * Z.ease(k)), bw, 18, text, C.yellow);
    }
    // hints
    if (this.pan <= 0 && this.hints.length && !(this.lv.tutorial && this.launched === 0 && this.hints[0] === 'hint_drag')) {
      var ht = Z.t(this.hints[0]), hw = F.width(ht) + 24, a = Math.min(1, this.hintT * 4, (3.6 - this.hintT) * 4);
      g.globalAlpha = Z.clamp(a, 0, 1);
      UI.sign(g, Math.round(Z.W / 2 - hw / 2), Z.H - 26, hw, 18, ht);
      g.globalAlpha = 1;
    }
  };

  Z.GameScene = Game;
})();
