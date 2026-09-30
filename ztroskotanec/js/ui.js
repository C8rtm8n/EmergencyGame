// ============================================================================
//  ui.js — wood / rope / bamboo UI kit, modal dialogs, settings dialog,
//  particles, iris transition. All coordinates are internal (320x180).
// ============================================================================
'use strict';
(function () {
  var P = Z.Pix, C = Z.C, R = P.R, F = Z.Font;

  // ------------------------------------------------------------ drawing kit
  var UI = Z.UI = {};
  UI.plank = function (g, x, y, w, h, pressed, tone) {
    x = Math.round(x); y = Math.round(y) + (pressed ? 1 : 0);
    var base = tone === 'green' ? '#5a8a3a' : tone === 'red' ? '#a04030' : C.woodL, dark = tone === 'green' ? '#3a5e24' : tone === 'red' ? '#6a2420' : C.woodD;
    R(g, C.ink, x, y + 1, w, h); R(g, C.ink, x + 1, y, w - 2, h + 2);
    R(g, base, x + 1, y + 1, w - 2, h - 1);
    R(g, 'rgba(255,255,255,0.25)', x + 1, y + 1, w - 2, 1);
    R(g, dark, x + 1, y + h - 1, w - 2, 1);
    if (!pressed) R(g, C.ink, x + 1, y + h + 1, w - 2, 1);
    for (var i = 0; i < 3; i++) R(g, 'rgba(0,0,0,0.12)', x + 3 + i * 7, y + 3 + (i % 2) * (h - 7), Math.max(4, w - 10 - i * 9), 1);
    // rope lashings
    [x + 3, x + w - 6].forEach(function (lx) { R(g, C.rope, lx, y + 1, 3, h - 1); R(g, C.woodD, lx, y + 3, 3, 1); R(g, C.woodD, lx, y + h - 3, 3, 1); });
  };
  UI.button = function (g, b) {
    var pressed = b.pressed && !b.disabled;
    UI.plank(g, b.x, b.y, b.w, b.h, pressed, b.tone);
    var label = typeof b.label === 'function' ? b.label() : (b.label || '');
    var cy = Math.round(b.y + b.h / 2 - 5) + (pressed ? 1 : 0), cx = b.x + b.w / 2;
    var tw = label ? F.width(label) : 0, iw = b.icon ? b.icon.width + (label ? 3 : 0) : 0, sx = Math.round(cx - (tw + iw) / 2);
    if (b.icon) g.drawImage(b.icon, sx, Math.round(b.y + b.h / 2 - b.icon.height / 2) + (pressed ? 1 : 0));
    if (label) F.draw(g, label, sx + iw, cy, b.disabled ? C.grey : C.white, { shadow: C.ink });
    if (b.ad) { R(g, C.ink, b.x + b.w - 14, b.y - 6, 17, 11); R(g, C.yellow, b.x + b.w - 13, b.y - 5, 15, 9); F.draw(g, 'AD', b.x + b.w - 11, b.y - 6, C.ink); }
    if (b.disabled) { g.globalAlpha = 0.35; R(g, C.ink, b.x, b.y, b.w, b.h + 2); g.globalAlpha = 1; }
  };
  UI.bambooH = function (g, x, y, w) {
    R(g, C.ink, x, y - 1, w, 6); R(g, '#c8b050', x, y, w, 4); R(g, '#e8d890', x, y, w, 1); R(g, '#8a7a30', x, y + 3, w, 1);
    for (var i = 10; i < w - 4; i += 14) { R(g, '#8a7a30', x + i, y, 1, 4); R(g, C.ink, x + i + 1, y, 1, 4); }
  };
  UI.bambooV = function (g, x, y, h) {
    R(g, C.ink, x - 1, y, 6, h); R(g, '#c8b050', x, y, 4, h); R(g, '#e8d890', x, y, 1, h); R(g, '#8a7a30', x + 3, y, 1, h);
    for (var i = 10; i < h - 4; i += 14) { R(g, '#8a7a30', x, y + i, 4, 1); R(g, C.ink, x, y + i + 1, 4, 1); }
  };
  // Parchment panel with bamboo frame and rope-tied corners.
  UI.panel = function (g, x, y, w, h) {
    x = Math.round(x); y = Math.round(y);
    R(g, C.ink, x + 2, y + 2, w - 4, h - 4);
    R(g, C.parch, x + 3, y + 3, w - 6, h - 6);
    P.dither(g, C.parchD, x + 3, y + 3, w - 6, 2, 0); P.dither(g, C.parchD, x + 3, y + h - 5, w - 6, 2, 1);
    P.dither(g, C.parchD, x + 3, y + 3, 2, h - 6, 0); P.dither(g, C.parchD, x + w - 5, y + 3, 2, h - 6, 1);
    UI.bambooH(g, x - 2, y, w + 4); UI.bambooH(g, x - 2, y + h - 4, w + 4);
    UI.bambooV(g, x, y - 2, h + 4); UI.bambooV(g, x + w - 4, y - 2, h + 4);
    [[x - 1, y - 1], [x + w - 5, y - 1], [x - 1, y + h - 5], [x + w - 5, y + h - 5]].forEach(function (p) {
      R(g, C.ink, p[0], p[1], 6, 6); R(g, C.rope, p[0] + 1, p[1] + 1, 4, 4); R(g, C.woodD, p[0] + 1, p[1] + 2, 4, 1); R(g, C.woodD, p[0] + 2, p[1] + 1, 1, 4);
    });
  };
  // Hanging wooden sign (used for banners / hints)
  UI.sign = function (g, x, y, w, h, text, col) {
    R(g, C.rope, x + 10, y - 8, 1, 8); R(g, C.rope, x + w - 11, y - 8, 1, 8);
    UI.plank(g, x, y, w, h, false);
    if (text) F.draw(g, text, x + w / 2, y + h / 2 - 5, col || C.white, { align: 'center', shadow: C.ink });
  };
  UI.hit = function (b, x, y) { return !b.hidden && x >= b.x - 2 && x < b.x + b.w + 2 && y >= b.y - 2 && y < b.y + b.h + 4; };

  // Button group helper: press on down, fire on up if still inside.
  function Buttons(list) { this.list = list || []; this.active = null; }
  Buttons.prototype.add = function (b) { this.list.push(b); return b; };
  Buttons.prototype.draw = function (g) { this.list.forEach(function (b) { if (!b.hidden) UI.button(g, b); }); };
  Buttons.prototype.down = function (x, y) {
    for (var i = this.list.length - 1; i >= 0; i--) { var b = this.list[i]; if (!b.hidden && !b.disabled && UI.hit(b, x, y)) { b.pressed = true; this.active = b; return true; } }
    return false;
  };
  Buttons.prototype.move = function (x, y) { if (this.active) this.active.pressed = UI.hit(this.active, x, y); };
  Buttons.prototype.up = function (x, y) {
    var b = this.active; this.active = null;
    if (!b) return false;
    b.pressed = false;
    if (UI.hit(b, x, y)) { Z.Audio.play('click'); b.cb && b.cb(); }
    return true;
  };
  UI.Buttons = Buttons;

  // ------------------------------------------------------------ modal dialogs
  // opts: {w,h,title,buttons:[{label,cb,ad,tone,icon}], body(g,x,y,t), tap(), cols}
  function Modal(opts) {
    this.o = opts; this.t = 0; this.closing = false;
    this.w = opts.w || 200; this.h = opts.h || 120;
    this.x = Math.round((Z.W - this.w) / 2); this.y = Math.round((Z.H - this.h) / 2);
    this.btns = new Buttons();
    this.layout();
  }
  Modal.prototype.layout = function () {
    var o = this.o, self = this, bs = o.buttons || [], cols = o.cols || 1;
    var bw = cols === 1 ? Math.min(150, this.w - 30) : Math.floor((this.w - 24 - (cols - 1) * 6) / cols), bh = 20;
    var rows = Math.ceil(bs.length / cols), y0 = this.y + this.h - 12 - rows * (bh + 6) + 6;
    this.btns.list = bs.map(function (b, i) {
      var c = i % cols, r = Math.floor(i / cols), rowCount = Math.min(cols, bs.length - r * cols);
      var totalW = rowCount * bw + (rowCount - 1) * 6, x0 = self.x + (self.w - totalW) / 2;
      return { x: Math.round(x0 + c * (bw + 6)), y: y0 + r * (bh + 6), w: bw, h: bh, label: b.label, cb: b.cb, ad: b.ad, tone: b.tone, icon: b.icon, disabled: b.disabled };
    });
  };
  Modal.prototype.update = function (dt) { this.t += dt; };
  Modal.prototype.draw = function (g) {
    var k = Z.ease(this.t * 5);
    g.globalAlpha = 0.55 * k; R(g, C.ink, 0, 0, Z.W, Z.H); g.globalAlpha = 1;
    var oy = Math.round((1 - k) * -Z.H);
    g.save(); g.translate(0, oy);
    UI.panel(g, this.x, this.y, this.w, this.h);
    if (this.o.title) F.draw(g, this.o.title, this.x + this.w / 2, this.y + 9, C.redD, { align: 'center', shadow: C.parchD });
    if (this.o.body) this.o.body(g, this.x, this.y, this.t);
    this.btns.draw(g);
    g.restore();
  };
  Modal.prototype.down = function (x, y) { if (this.t < 0.15) return; if (!this.btns.down(x, y)) this.tapArmed = true; };
  Modal.prototype.move = function (x, y) { this.btns.move(x, y); };
  Modal.prototype.up = function (x, y) {
    if (this.btns.up(x, y)) return;
    if (this.tapArmed && this.o.tap) { this.tapArmed = false; this.o.tap(); }
    this.tapArmed = false;
  };
  UI.Modal = Modal;
  Z.modals = [];
  UI.open = function (opts) { var m = new Modal(opts); Z.modals.push(m); return m; };
  UI.close = function (m) { var i = Z.modals.indexOf(m || Z.modals[Z.modals.length - 1]); if (i >= 0) Z.modals.splice(i, 1); };
  UI.toast = function (text, dur) { UI._toast = { text: text, t: dur || 2 }; };
  UI.drawToast = function (g, dt) {
    var tt = UI._toast; if (!tt) return;
    tt.t -= dt; if (tt.t <= 0) { UI._toast = null; return; }
    var w = F.width(tt.text) + 20;
    UI.sign(g, Math.round(Z.W / 2 - w / 2), 150, w, 16, tt.text);
  };

  // ------------------------------------------------------------ settings dialog
  UI.settings = function (onClose) {
    var s = Z.Save.d.settings, m;
    function vol(key, d) { s[key] = Math.round(Z.clamp(s[key] + d, 0, 1) * 10) / 10; Z.Save.apply(); if (key === 'sfx') Z.Audio.play('collect'); }
    m = UI.open({
      w: 220, h: 150, title: Z.t('settings'),
      body: function (g, x, y) {
        var rows = [[Z.t('music'), s.music], [Z.t('sfx'), s.sfx]];
        rows.forEach(function (r, i) {
          var ry = y + 26 + i * 24;
          F.draw(g, r[0], x + 16, ry + 5, C.woodD);
          for (var k = 0; k < 10; k++) { R(g, C.ink, x + 110 + k * 7, ry + 2, 6, 12); R(g, k < Math.round(r[1] * 10) ? C.leafL : C.parchD, x + 111 + k * 7, ry + 3, 4, 10); }
        });
        F.draw(g, Z.t('crt'), x + 16, y + 79, C.woodD);
        F.draw(g, Z.t('lang'), x + 16, y + 103, C.woodD);
      },
      buttons: []
    });
    var x = m.x, y = m.y;
    m.btns.list = [
      { x: x + 84, y: y + 24, w: 20, h: 16, label: '-', cb: function () { vol('music', -0.1); } },
      { x: x + 183, y: y + 24, w: 20, h: 16, label: '+', cb: function () { vol('music', 0.1); } },
      { x: x + 84, y: y + 48, w: 20, h: 16, label: '-', cb: function () { vol('sfx', -0.1); } },
      { x: x + 183, y: y + 48, w: 20, h: 16, label: '+', cb: function () { vol('sfx', 0.1); } },
      { x: x + 110, y: y + 72, w: 60, h: 18, label: function () { return s.crt ? Z.t('on') : Z.t('off'); }, cb: function () { s.crt = !s.crt; Z.Save.apply(); } },
      { x: x + 110, y: y + 96, w: 60, h: 18, label: function () { return s.lang === 'cs' ? 'CZ' : 'EN'; }, cb: function () { s.lang = s.lang === 'cs' ? 'en' : 'cs'; Z.Save.apply(); m.o.title = Z.t('settings'); } },
      { x: x + 60, y: y + 122, w: 100, h: 18, label: function () { return Z.t('back'); }, tone: 'green', cb: function () { Z.Save.write(); UI.close(m); onClose && onClose(); } }
    ];
    return m;
  };

  // ------------------------------------------------------------ particles
  function Particles() { this.list = []; }
  Particles.prototype.add = function (x, y, n, o) {
    o = o || {};
    for (var i = 0; i < n; i++) {
      var a = o.ang !== undefined ? o.ang + Z.rand(-(o.spread || 0.6), o.spread || 0.6) : Z.rand(0, Math.PI * 2), sp = Z.rand(o.min || 10, o.max || 50);
      this.list.push({ x: x + Z.rand(-(o.w || 0), o.w || 0), y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: Z.rand(o.life || 0.5, (o.life || 0.5) * 1.6), t: 0,
        c: Array.isArray(o.c) ? Z.pick(o.c) : (o.c || C.white), g: o.g === undefined ? 200 : o.g, s: o.s || 1, drag: o.drag || 0 });
    }
  };
  Particles.prototype.update = function (dt) {
    for (var i = this.list.length - 1; i >= 0; i--) {
      var p = this.list[i]; p.t += dt;
      if (p.t >= p.life) { this.list.splice(i, 1); continue; }
      p.vy += p.g * dt; if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  };
  Particles.prototype.draw = function (g, cx, cy) {
    for (var i = 0; i < this.list.length; i++) { var p = this.list[i]; R(g, p.c, Math.round(p.x - cx), Math.round(p.y - cy), p.s, p.s); }
  };
  Z.Particles = Particles;

  // ------------------------------------------------------------ iris transition
  // Classic circular wipe. Z.go(fn) closes the iris, runs fn (switch scene), reopens.
  Z.trans = null;
  Z.go = function (fn, cx, cy) {
    if (Z.trans) return;
    Z.trans = { t: 0, phase: 0, fn: fn, cx: cx === undefined ? Z.W / 2 : cx, cy: cy === undefined ? Z.H / 2 : cy };
  };
  Z.updateTrans = function (dt) {
    var tr = Z.trans; if (!tr) return;
    tr.t += dt;
    if (tr.phase === 0 && tr.t >= 0.4) { tr.phase = 1; tr.t = 0; Z.modals.length = 0; tr.fn(); tr.cx = Z.W / 2; tr.cy = Z.H / 2; }
    else if (tr.phase === 1 && tr.t >= 0.4) Z.trans = null;
  };
  Z.drawTrans = function (g) {
    var tr = Z.trans; if (!tr) return;
    var k = tr.phase === 0 ? 1 - tr.t / 0.4 : tr.t / 0.4, r = Z.clamp(k, 0, 1) * 200;
    g.fillStyle = C.ink;
    for (var y = 0; y < Z.H; y++) {
      var dy = y + 0.5 - tr.cy;
      if (Math.abs(dy) >= r) { g.fillRect(0, y, Z.W, 1); continue; }
      var hw = Math.sqrt(r * r - dy * dy), x0 = Math.round(tr.cx - hw), x1 = Math.round(tr.cx + hw);
      if (x0 > 0) g.fillRect(0, y, x0, 1);
      if (x1 < Z.W) g.fillRect(x1, y, Z.W - x1, 1);
    }
  };
})();
