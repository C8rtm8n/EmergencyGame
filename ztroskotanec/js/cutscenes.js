// ============================================================================
//  cutscenes.js — short pixel-art story scenes without long texts.
//  Cutscene = list of shots {dur, start(), draw(g,t,dt), cap: textKey | fn}.
//  Tap skips the whole scene.
// ============================================================================
'use strict';
(function () {
  var C = Z.C, F = Z.Font, P = Z.Pix, R = P.R, A = Z.Audio;

  function Cutscene(shots, onEnd) { this.shots = shots; this.onEnd = onEnd; }
  var CS = Cutscene.prototype;
  CS.enter = function () { this.i = 0; this.t = 0; this.total = 0; this.ended = false; this.parts = new Z.Particles(); this.shake = 0; Z.SDK.gameplayStop(); this.startShot(); };
  CS.startShot = function () { var s = this.shots[this.i]; if (s && s.start) s.start.call(this); };
  CS.update = function (dt) {
    if (this.ended) return;
    this.t += dt; this.total += dt; this.parts.update(dt); if (this.shake > 0) this.shake -= dt;
    var s = this.shots[this.i];
    if (s.update) s.update.call(this, dt, this.t);
    if (this.t >= s.dur) { this.i++; this.t = 0; if (this.i >= this.shots.length) this.end(); else this.startShot(); }
  };
  CS.end = function () { if (this.ended) return; this.ended = true; this.i = this.shots.length - 1; this.onEnd(); };
  CS.draw = function (g) {
    var s = this.shots[Math.min(this.i, this.shots.length - 1)], t = this.ended ? s.dur : this.t;
    g.save();
    if (this.shake > 0) g.translate(Math.round(Z.rand(-3, 3)), Math.round(Z.rand(-2, 2)));
    s.draw.call(this, g, t);
    this.parts.draw(g, 0, 0);
    g.restore();
    // cinematic letterbox + caption
    R(g, C.ink, 0, 0, Z.W, 14); R(g, C.ink, 0, Z.H - 22, Z.W, 22);
    var cap = typeof s.cap === 'function' ? s.cap.call(this, t) : s.cap;
    if (cap) {
      var txt = Z.t(cap), a = Z.clamp(Math.min(t * 3, (s.dur - t) * 3), 0, 1);
      g.globalAlpha = a; F.draw(g, txt, Z.W / 2, Z.H - 16, C.white, { align: 'center' }); g.globalAlpha = 1;
    }
    if (this.total > 1 && Math.sin(this.total * 3) > 0) F.draw(g, Z.t('tap_skip'), Z.W - 4, 3, C.grey, { align: 'right' });
    // fade in/out per shot
    var f = Math.min(t / 0.4, (s.dur - t) / 0.4, 1);
    if (f < 1 && !s.noFade) { g.globalAlpha = 1 - Z.clamp(f, 0, 1); R(g, C.ink, 0, 0, Z.W, Z.H); g.globalAlpha = 1; }
  };
  CS.down = function () {};
  CS.up = function () { if (this.total > 0.6) this.end(); };

  // ------------------------------------------------------------ shared painters
  function nightSky(g, t, flash) {
    var b = ['#0e0a1a', '#161226', '#1f1a34', '#2b2442', '#3b3a6b'];
    for (var i = 0; i < 5; i++) R(g, b[i], 0, i * 22, Z.W, 23);
    R(g, b[4], 0, 110, Z.W, 70);
    for (var c = 0; c < 6; c++) { g.globalAlpha = 0.6; P.disc(g, '#3a3450', ((c * 70 + t * 12) % 400) - 40, 30 + (c % 3) * 12, 30, 10); } g.globalAlpha = 1;
    if (flash > 0) { g.globalAlpha = Math.min(1, flash * 3); R(g, '#e8e8ff', 0, 0, Z.W, Z.H); g.globalAlpha = 1; }
  }
  function bolt(g, x, seed) {
    var y = 14, px = x;
    while (y < 100) { var nx = px + (Z.hash(y, seed, 3) - 0.5) * 16, ny = y + 8; P.line(g, C.white, px, y, nx, ny, 1); px = nx; y = ny; }
  }
  function stormSea(g, t, y0, big) {
    var cols = ['#1d2a4a', '#23355a', '#2b406a'];
    for (var layer = 0; layer < 3; layer++) {
      for (var x = 0; x < Z.W; x++) {
        var y = y0 + layer * 14 + Math.sin(x * 0.04 + t * (1.2 + layer * 0.4) + layer) * big + Math.sin(x * 0.11 - t * 2) * 2;
        R(g, cols[layer], x, Math.round(y), 1, Z.H);
        if (Math.sin(x * 0.04 + t * (1.2 + layer * 0.4) + layer) > 0.85) R(g, '#9ab0d0', x, Math.round(y), 1, 1);
      }
    }
  }
  function rain(g, t, n) {
    for (var i = 0; i < n; i++) {
      var x = ((i * 37 + t * 260) % 360) - 20, y = ((i * 53 + t * 420) % 200) - 10;
      P.line(g, '#8a9ac0', x | 0, y | 0, (x - 3) | 0, (y + 6) | 0, 1);
    }
  }
  function speech(g, x, y, txt) {
    var w = F.width(txt) + 8;
    R(g, C.ink, x - w / 2 - 1, y - 12, w + 2, 13); R(g, C.white, x - w / 2, y - 11, w, 11); R(g, C.white, x - 1, y - 1, 3, 2); R(g, C.ink, x, y + 1, 1, 1);
    F.draw(g, txt, x, y - 10, C.ink, { align: 'center' });
  }

  // ------------------------------------------------------------ intro
  Z.IntroScene = function () {
    var flash = 0, shipX = 0, bg0 = Z.BG.get('beach', 0);
    return new Cutscene([
      { dur: 4.6, cap: 'intro_storm',
        start: function () { A.playSong('storm'); A.setAmbient('storm'); flash = 0; },
        update: function (dt, t) { flash -= dt; if ((t > 1.2 && t - dt <= 1.2) || (t > 3.3 && t - dt <= 3.3)) { flash = 0.35; A.play('thunder'); } },
        draw: function (g, t) {
          nightSky(g, t, flash);
          if (flash > 0.15) bolt(g, t < 2 ? 80 : 250, t < 2 ? 1 : 2);
          stormSea(g, t, 118, 6);
          Z.drawRot(g, Z.S.ship, 160 + Math.sin(t * 0.8) * 6, 108 + Math.sin(t * 1.6) * 4, Math.sin(t * 1.6) * 0.14);
          stormSea(g, t + 1, 140, 5);
          rain(g, t, 70);
        } },
      { dur: 3.8, cap: 'intro_wreck',
        start: function () { shipX = 90; flash = 0; this.hit = false; },
        update: function (dt, t) {
          flash -= dt;
          if (t < 1.8) shipX += dt * 60;
          if (t >= 1.8 && !this.hit) { this.hit = true; flash = 0.5; this.shake = 0.6; A.play('crash'); A.play('thunder');
            this.parts.add(shipX + 30, 110, 30, { c: [C.wood, C.woodL, C.white], min: 30, max: 110, life: 1, g: 250 }); }
        },
        draw: function (g, t) {
          nightSky(g, t, flash);
          stormSea(g, t, 118, 7);
          var sink = t > 1.8 ? (t - 1.8) * 8 : 0, tilt = t > 1.8 ? Math.min(0.5, (t - 1.8) * 0.5) : Math.sin(t * 1.6) * 0.12;
          Z.drawRot(g, t > 1.8 ? Z.S.wreck : Z.S.ship, shipX, 108 + sink + Math.sin(t * 1.6) * 3, tilt);
          P.poly(g, '#0e0a1a', [[228, 180], [240, 112], [258, 100], [270, 118], [290, 180]]); R(g, '#3a3450', 250, 104, 6, 2);
          stormSea(g, t + 1, 142, 6);
          rain(g, t, 70);
        } },
      { dur: 2.8, cap: 'intro_dark',
        draw: function (g, t) {
          nightSky(g, t, 0);
          stormSea(g, t, 104, 5);
          Z.drawFeet(g, Z.S[Math.floor(t * 6) % 2 ? 'hero_flail1' : 'hero_flail2'], 160, 132 + Math.sin(t * 2) * 5);
          stormSea(g, t + 2, 126, 6);
          rain(g, t, 40);
        } },
      { dur: 6.4, cap: function (t) { return t < 2.6 ? 'intro_morning' : 'intro_where'; },
        start: function () { A.playSong('title'); A.setAmbient('beach'); },
        draw: function (g, t) {
          Z.BG.draw(g, bg0, 40, 0, Z.H, t);
          Z.drawRot(g, Z.S.wreck, 290, 120, -0.3);
          Z.drawBeach(g, t);
          Z.drawFeet(g, Z.S.crate, 220, 158); Z.drawFeet(g, Z.S.starfish, 90, 162);
          var hx = 150, hy = 157, img;
          if (t < 1.8) { img = Z.S.hero_lie; g.drawImage(img, hx - 12, hy - img.height + 2); }
          else if (t < 2.3) Z.drawFeet(g, Z.S.hero_crouch, hx, hy);
          else if (t < 4.2) Z.drawFeet(g, Z.S[(t > 2.9 && t < 3.6) ? 'hero_idle_l' : 'hero_idle'], hx, hy);
          else Z.drawFeet(g, Z.S[Math.floor(t * 6) % 2 ? 'hero_scratch1' : 'hero_scratch2'], hx, hy);
          if (t > 4.3) speech(g, hx + 2, hy - 26, '?');
          if (t < 1.8 && Math.floor(t * 2) % 2) F.draw(g, 'Z', hx + 8, hy - 18 - (t * 4 % 6), C.white);
        } },
      { dur: 4.2, cap: 'intro_goal',
        draw: function (g, t) {
          Z.BG.draw(g, bg0, 40 + t * 30, 0, Z.H, t);
          Z.drawBeach(g, t);
          var k = Z.ease(t / 1.5);
          Z.drawFeet(g, Z.S[t > 1.5 && Math.floor(t * 3) % 2 ? 'hero_wave1' : 'hero_idle'], 100 - k * 20, 157);
          // pointing arrow to the volcano
          if (t > 1.5 && Math.sin(t * 6) > 0) { R(g, C.yellow, 150, 60, 2, 2); R(g, C.yellow, 156, 56, 2, 2); R(g, C.yellow, 162, 52, 2, 2); }
        } }
    ], function () {
      Z.Save.d.seenIntro = true; Z.Save.write();
      Z.go(function () { Z.setScene(Z.Save.level(Z.LEVELS[0].id) ? new Z.MapScene() : new Z.GameScene(0)); });
    });
  };

  // ------------------------------------------------------------ chapter end ("finds from the ship")
  Z.ChapterEndScene = function (ch) {
    var mood = Z.CHAPTERS[ch].mood, bg = Z.BG.get(ch === 0 ? 'beach' : 'jungle', mood);
    var finds = ['compass', 'bottle', 'spyglass', 'page'], nextHas = Z.LEVELS.some(function (l) { return l.ch === ch + 1; });
    return new Cutscene([
      { dur: 6.0, cap: function (t) { return t < 3 ? 'finds' : 'ch_end_1'; },
        start: function () { Z.SDK.happytime(); A.playSong('rescue'); },
        update: function (dt, t) {
          for (var i = 0; i < finds.length; i++) { var at = 2 + i * 0.6; if (t >= at && t - dt < at) { A.play('collect'); this.parts.add(190 + i * 18 - 27, 120, 10, { c: [C.yellow, C.white], min: 20, max: 50, life: 0.5, g: 0, drag: 3 }); } }
        },
        draw: function (g, t) {
          Z.BG.draw(g, bg, 60, 0, Z.H, t);
          Z.drawBeach(g, t);
          var cx = Math.max(196, 300 - t * 70);
          Z.drawFeet(g, Z.S.crate, cx, 157 + (t < 1.2 ? Math.round(Math.sin(t * 8)) : 0));
          Z.drawFeet(g, Z.S[t > 1.4 ? (t > 4 ? 'hero_win' : 'hero_crouch') : 'hero_idle'], 160, 157);
          for (var i = 0; i < finds.length; i++) {
            var at = 2 + i * 0.6; if (t < at) continue;
            var k = Z.ease((t - at) / 0.6);
            Z.drawCenter(g, Z.S[finds[i]], 190 + i * 18 - 27, 150 - k * 30 + Math.sin(t * 3 + i) * 1.5);
          }
        } },
      { dur: 4.2, cap: 'ch_end_2',
        draw: function (g, t) {
          R(g, C.parch, 0, 0, Z.W, Z.H);
          P.dither(g, C.parchD, 0, 14, Z.W, 4, 0); P.dither(g, C.parchD, 0, Z.H - 26, Z.W, 4, 1);
          if (nextHas) {
            F.draw(g, Z.t('chapter', ch + 2), Z.W / 2, 60, C.redD, { align: 'center', scale: 2 });
            F.draw(g, Z.tl('ch', ch + 1), Z.W / 2, 90, C.woodD, { align: 'center' });
          } else {
            F.draw(g, Z.t('chapter', ch + 2) + ': ' + Z.tl('ch', ch + 1), Z.W / 2, 60, C.woodD, { align: 'center' });
            F.draw(g, Z.t('soon'), Z.W / 2, 84, C.redD, { align: 'center', scale: 2 });
          }
          Z.drawFeet(g, Z.S[Math.floor(t * 4) % 2 ? 'hero_idle' : 'hero_idle2'], 40 + t * 50, 140);
          for (var i = 0; i < 12; i++) R(g, C.redD, 20 + i * 24, 142, 3, 2);
        } }
    ], function () {
      Z.SDK.midgame(function () {
        Z.go(function () {
          if (ch === 3) Z.setScene(Z.EndingScene());
          else Z.setScene(new Z.MapScene());
        });
      });
    });
  };

  // ------------------------------------------------------------ memory (sepia flashback on deck)
  Z.MemoryScene = function (ch, after) {
    var key = function (s) { var k = 'memory_' + (ch + 1) + s; return Z.TEXT.cs[k] ? k : 'memory_1' + s; };
    function deck(g, t) {
      var b = ['#1a1428', '#241c36', '#2e2644'];
      for (var i = 0; i < 3; i++) R(g, b[i], 0, i * 40, Z.W, 41);
      R(g, b[2], 0, 120, Z.W, 60);
      for (var s = 0; s < 40; s++) if (Math.sin(t * 2 + s * 3) > -0.6) R(g, C.white, (Z.hash(s, 1) * Z.W) | 0, 14 + ((Z.hash(s, 2) * 90) | 0), 1, 1);
      P.disc(g, C.parch, 260, 36, 9); P.disc(g, b[0], 264, 33, 8);
      // sea
      for (var x = 0; x < Z.W; x++) R(g, '#2b3a5a', x, 112 + Math.round(Math.sin(x * 0.05 + t) * 1.5), 1, 30);
      // deck + railing + mast
      R(g, C.woodD, 0, 138, Z.W, 42);
      for (var y = 140; y < 180; y += 5) R(g, C.wood, 0, y, Z.W, 4);
      R(g, C.woodD, 0, 120, Z.W, 3); for (var r = 4; r < Z.W; r += 18) R(g, C.woodD, r, 120, 3, 18);
      R(g, C.ink, 70, 0, 8, 140); R(g, C.wood, 71, 0, 6, 140); R(g, C.woodL, 71, 0, 1, 140);
      // lantern with flicker glow
      var fl = 0.18 + Math.sin(t * 13) * 0.03 + Math.sin(t * 7) * 0.03;
      g.globalAlpha = fl; P.disc(g, C.yellow, 90, 92, 40, 30); g.globalAlpha = 1;
      R(g, C.ink, 84, 82, 12, 16); R(g, C.yellow, 86, 85, 8, 10); R(g, C.white, 89, 88, 2, 4); R(g, C.ink, 89, 78, 2, 4);
    }
    return new Cutscene([
      { dur: 9.5, cap: function (t) { return t < 3 ? key('a') : t < 6.3 ? key('b') : key('c'); },
        start: function () { A.playSong('title', -5); A.setAmbient(''); },
        draw: function (g, t) {
          deck(g, t);
          Z.drawFeet(g, Z.S.sailor, 40, 150); Z.drawFeet(g, Z.S.sailor2_l, 270, 150);
          Z.drawFeet(g, Z.S[t > 3 && t < 5 ? 'captain_give_l' : 'captain_l'], 186, 150);
          Z.drawFeet(g, Z.S[t > 6.3 ? 'hero_idle2' : 'hero_idle'], 160, 151);
          if (t > 3.2 && t < 4.8) { var k = Z.ease((t - 3.2) / 1.2); R(g, C.red, Math.round(180 - k * 12), Math.round(128 + k * 2), 4, 2); }
          // sepia wash + vignette
          g.globalAlpha = 0.28; R(g, '#8a5a2a', 0, 0, Z.W, Z.H); g.globalAlpha = 1;
          P.dither(g, C.ink, 0, 14, Z.W, 3, 0); P.dither(g, C.ink, 0, 14, 4, Z.H - 36, 0); P.dither(g, C.ink, Z.W - 4, 14, 4, Z.H - 36, 1);
        } }
    ], after || function () { Z.go(function () { Z.setScene(new Z.MapScene()); }); });
  };

  // ------------------------------------------------------------ ending: signal fire + rescue ship at sunset
  Z.EndingScene = function () {
    var bg = Z.BG.get('volcano', 3), fireOn = false;
    function scene(g, t, shipX) {
      Z.BG.draw(g, bg, 0, 0, Z.H, t);
      // sunset sea on the horizon
      for (var y = 116; y < Z.H; y++) R(g, y % 3 ? '#7a2a3a' : '#5a1e30', 0, y, Z.W, 1);
      for (var s = 0; s < 20; s++) if (Math.sin(t * 2 + s) > 0.3) R(g, C.orange, 150 + ((s * 17) % 120), 118 + (s * 7) % 30, 4, 1);
      if (shipX !== null) Z.drawRot(g, Z.S.ship, shipX, 112 + Math.sin(t * 1.5) * 1.5, Math.sin(t * 1.5) * 0.04);
      // summit rock
      P.poly(g, '#2e1224', [[0, 180], [0, 150], [40, 138], [70, 128], [110, 126], [140, 138], [170, 180]]);
      P.poly(g, '#4a1a2e', [[40, 138], [70, 128], [110, 126], [100, 131], [60, 135]]);
    }
    return new Cutscene([
      { dur: 5.5, cap: 'end_1',
        start: function () { Z.SDK.happytime(); A.playSong('rescue'); A.setAmbient(''); },
        update: function (dt, t) {
          if (t > 1.6 && !fireOn) { fireOn = true; A.play('fire'); }
          if (fireOn && Math.random() < dt * 30) this.parts.add(92 + Z.rand(-3, 3), 110, 1, { c: ['#5a4a4a', '#7a6a6a', '#3a2a2a'], ang: -Math.PI / 2, spread: 0.3, min: 15, max: 30, life: 3, g: -4, s: 2 });
          if (fireOn && Math.random() < dt * 20) this.parts.add(92, 116, 1, { c: [C.yellow, C.orange], ang: -Math.PI / 2, spread: 0.5, min: 20, max: 50, life: 0.6, g: -10 });
        },
        draw: function (g, t) {
          scene(g, t, null);
          if (fireOn) { for (var i = 0; i < 3; i++) Z.drawCampfire(g, 86 + i * 6, 127, true, t + i); } else Z.drawCampfire(g, 92, 127, false, t);
          Z.drawFeet(g, Z.S[t < 1.6 ? 'hero_crouch' : 'hero_win'], 70, 128);
        } },
      { dur: 6.5, cap: function (t) { return t < 3.5 ? 'end_2' : 'rescue'; },
        update: function (dt, t) {
          if (t > 2.5 && t - dt <= 2.5) A.play('horn');
          if (Math.random() < dt * 30) this.parts.add(92 + Z.rand(-3, 3), 110, 1, { c: ['#5a4a4a', '#7a6a6a'], ang: -Math.PI / 2, spread: 0.3, min: 15, max: 30, life: 3, g: -4, s: 2 });
        },
        draw: function (g, t) {
          scene(g, t, 340 - Math.min(t, 5) * 30);
          for (var i = 0; i < 3; i++) Z.drawCampfire(g, 86 + i * 6, 127, true, t + i);
          Z.drawFeet(g, Z.S[Math.floor(t * 5) % 2 ? 'hero_wave1' : 'hero_wave2'], 60, 128);
        } },
      { dur: 5, noFade: false,
        draw: function (g, t) {
          scene(g, t + 12, 190);
          for (var i = 0; i < 3; i++) Z.drawCampfire(g, 86 + i * 6, 127, true, t + i);
          Z.drawFeet(g, Z.S.hero_win, 60, 128);
          g.globalAlpha = Z.clamp(t, 0, 0.6); R(g, C.ink, 0, 0, Z.W, Z.H); g.globalAlpha = 1;
          F.draw(g, Z.t('the_end'), Z.W / 2, 60, C.yellow, { align: 'center', scale: 3, outline: C.ink });
          if (t > 1.2) F.draw(g, Z.t('thanks'), Z.W / 2, 100, C.white, { align: 'center' });
        } }
    ], function () { Z.go(function () { Z.setScene(new Z.TitleScene()); }); });
  };
})();
