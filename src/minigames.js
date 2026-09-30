// Short (3–8 s) treatment minigames played with one button (tap / Space / E / Enter):
//  cpr     – tap in rhythm as the ring meets the heart
//  bandage – tap fast to wrap the bandage
//  splint  – tap when the moving marker is in the green zone
//  breathe – hold, release in the green zone (oxygen mask / childbirth breathing)
//  triage  – pick the most urgent of three patients
// Friendly, symbol-based visuals only (no blood or realistic injuries).
'use strict';
(function () {
  var G = null;
  var MG = Z.minigames = {
    active: false,
    start: function (kind, opts, cb) {
      G = { kind: kind, opts: opts || {}, cb: cb, t: 0, score: 0, n: 0, hits: [], msg: '', flash: 0, holding: false, done: false, sel: 1 };
      if (kind === 'cpr') { G.beat = 0.62; G.total = 8; G.first = 1.0; }
      if (kind === 'bandage') { G.need = 16; G.limit = 5; }
      if (kind === 'splint') { G.need = 3; G.limit = 7; G.pos = 0; G.dir = 1; G.zone = 0.22; }
      if (kind === 'breathe') { G.need = 3; G.fill = 0; G.limit = 9; }
      if (kind === 'triage') { G.limit = 9; }
      MG.active = true; MG.pointerDown = false;
      Z.input.clear();
    },
    pointer: function (x, y, down, W, H) {
      if (!G) return;
      MG.pointerDown = down;
      if (!down) return;
      if (G.kind === 'triage') {
        var i = Math.floor((x / W - 0.14) / 0.24); if (i >= 0 && i < 3) { G.sel = i; choose(); }
        return;
      }
      tap();
    },
    update: function (dt) {
      if (!G) return;
      G.t += dt; if (G.flash > 0) G.flash -= dt;
      var I = Z.input;
      var pressed = I.take('action') || I.take('siren') || I.take('up');
      if (G.kind === 'triage') {
        if (I.take('left')) G.sel = Math.max(0, G.sel - 1);
        if (I.take('right')) G.sel = Math.min(2, G.sel + 1);
        if (I.take('n1')) { G.sel = 0; pressed = true; } if (I.take('n2')) { G.sel = 1; pressed = true; } if (I.take('n3')) { G.sel = 2; pressed = true; }
        if (I.pressed.left) I.pressed.left = false;
        if (pressed) choose();
        if (G && G.t > G.limit) choose();
        return;
      }
      if (pressed && G.kind !== 'breathe') tap();
      if (G.kind === 'cpr') {
        var k = Math.floor((G.t - G.first) / G.beat + 0.5);
        if (k >= G.total && G.t > G.first + G.beat * (G.total - 0.5)) end(G.score / G.total);
      } else if (G.kind === 'bandage') {
        if (G.n >= G.need) end(1); else if (G.t > G.limit) end(G.n / G.need);
      } else if (G.kind === 'splint') {
        G.pos += G.dir * dt * (1.2 + G.n * 0.35); if (G.pos > 1) { G.pos = 1; G.dir = -1; } if (G.pos < 0) { G.pos = 0; G.dir = 1; }
        if (G.hits.length >= G.need || G.t > G.limit) end(G.score / G.need);
      } else if (G.kind === 'breathe') {
        var hold = I.hold('action') || I.hold('siren') || I.hold('up') || MG.pointerDown;
        if (hold) { G.holding = true; G.fill = Math.min(1.15, G.fill + dt * 0.75); }
        else if (G.holding) { // released: judge
          G.holding = false;
          var ok = G.fill > 0.66 && G.fill < 0.9;
          if (ok) { G.score++; G.msg = '✔'; Z.audio.blip('good'); } else { G.msg = '✖'; Z.audio.blip('bad'); }
          G.flash = 0.4; G.n++; G.fill = 0;
        }
        if (G.n >= G.need || G.t > G.limit) end(G.score / G.need);
      }
    },
    draw: draw,
  };

  function tap() {
    if (!G || G.done) return;
    if (G.kind === 'cpr') {
      var ph = (G.t - G.first) / G.beat, k = Math.round(ph);
      if (k < 0 || k >= G.total || G.hits[k] !== undefined) return;
      var err = Math.abs(ph - k) * G.beat;
      var q = err < 0.09 ? 1 : err < 0.18 ? 0.6 : 0;
      G.hits[k] = q; G.score += q; G.msg = q === 1 ? '★' : q ? '✔' : '✖'; G.flash = 0.25;
      Z.audio.blip(q ? 'beat' : 'bad');
    } else if (G.kind === 'bandage') {
      G.n++; G.flash = 0.1; Z.audio.tone(500 + G.n * 25, 0.05, 0.06, 'triangle');
    } else if (G.kind === 'splint') {
      var c = 0.5, inZone = Math.abs(G.pos - c) < G.zone / 2;
      G.hits.push(inZone); if (inZone) G.score++; G.zone *= 0.8; G.n++;
      G.msg = inZone ? '✔' : '✖'; G.flash = 0.35; Z.audio.blip(inZone ? 'good' : 'bad');
    }
  }
  function choose() { if (!G || G.done) return; var sel = G.sel; end(1, sel); }
  function end(res, extra) {
    if (G.done) return;
    G.done = true;
    var cb = G.cb, r = Z.clamp(res, 0, 1);
    setTimeout(function () { G = null; MG.active = false; Z.input.clear(); cb && cb(r, extra); }, G.kind === 'triage' ? 150 : 450);
    G.msg = r > 0.8 ? Z.t('perfect') : r > 0.5 ? Z.t('good') : Z.t('ok');
    G.flash = 1;
  }

  // ---------------------------------------------------------------- drawing
  function panel(g, W, H) {
    g.fillStyle = 'rgba(8,16,28,0.55)'; g.fillRect(0, 0, W, H);
    var w = Math.min(W * 0.8, H * 1.4), h = H * 0.62, x = (W - w) / 2, y = H * 0.18;
    g.fillStyle = 'rgba(250,250,245,0.96)'; round(g, x, y, w, h, 18); g.fill();
    return { x: x, y: y, w: w, h: h };
  }
  function round(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function text(g, s, x, y, size, col) { g.fillStyle = col || '#123'; g.font = '700 ' + size + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y); }
  function timeBar(g, p, frac) {
    g.fillStyle = '#dde'; g.fillRect(p.x + 20, p.y + p.h - 22, p.w - 40, 8);
    g.fillStyle = frac > 0.3 ? '#3aa0ff' : '#ff7043'; g.fillRect(p.x + 20, p.y + p.h - 22, (p.w - 40) * Z.clamp(frac, 0, 1), 8);
  }
  function draw(g, W, H) {
    if (!G) return;
    var p = panel(g, W, H), s = p.h / 300, cx = p.x + p.w / 2, cy = p.y + p.h * 0.55;
    var titles = { cpr: 'tap_rhythm', bandage: 'tap_fast', splint: 'tap_zone', breathe: 'hold_breathe', triage: 'triage' };
    text(g, Z.t(titles[G.kind]), cx, p.y + 34 * s, 26 * s);
    if (G.kind === 'cpr') {
      var ph = (G.t - G.first) / G.beat, frac = ph - Math.floor(ph);
      var beatNow = Math.floor(ph + 0.5);
      var pulse = 1 + Math.max(0, 0.25 - Math.abs(ph - Math.round(ph))) * 0.9;
      g.save(); g.translate(cx, cy); g.scale(pulse, pulse);
      text(g, '❤️', 0, 0, 90 * s); g.restore();
      if (ph > -1.5 && beatNow < G.total) {
        var rr = (1 - frac) * 110 * s + 38 * s; if (ph < 0) rr = (-ph) * 110 * s + 38 * s;
        g.strokeStyle = '#3aa0ff'; g.lineWidth = 6 * s; g.beginPath(); g.arc(cx, cy, rr, 0, 6.283); g.stroke();
        g.strokeStyle = 'rgba(58,160,255,0.3)'; g.lineWidth = 2 * s; g.beginPath(); g.arc(cx, cy, 44 * s, 0, 6.283); g.stroke();
      }
      for (var k = 0; k < G.total; k++) { g.fillStyle = G.hits[k] === undefined ? '#ccd' : G.hits[k] === 1 ? '#2bb673' : G.hits[k] ? '#9ccc65' : '#ef5350'; g.beginPath(); g.arc(cx + (k - (G.total - 1) / 2) * 22 * s, p.y + p.h - 40 * s, 7 * s, 0, 6.283); g.fill(); }
    } else if (G.kind === 'bandage') {
      var f = G.n / G.need;
      text(g, '💪', cx - 80 * s, cy, 80 * s);
      g.fillStyle = '#f4e9d8'; g.strokeStyle = '#c9b89c'; g.lineWidth = 3 * s;
      for (var w = 0; w < Math.min(G.need, G.n); w++) { g.fillStyle = w % 2 ? '#fffdf6' : '#f1ebe0'; g.fillRect(cx - 118 * s + w * 5 * s, cy - 18 * s, 14 * s, 36 * s); }
      text(g, '🩹', cx + 90 * s, cy, 70 * s);
      timeBar(g, p, 1 - G.t / G.limit);
      g.fillStyle = '#2bb673'; g.fillRect(p.x + 20, p.y + p.h - 40 * s, (p.w - 40) * Math.min(1, f), 10 * s);
    } else if (G.kind === 'splint') {
      var bx = p.x + 40 * s, bw = p.w - 80 * s, by = cy + 20 * s;
      text(g, '🦵', cx, cy - 55 * s, 64 * s);
      g.fillStyle = '#e3e6ea'; g.fillRect(bx, by, bw, 26 * s);
      g.fillStyle = '#2bb673'; g.fillRect(bx + bw * (0.5 - G.zone / 2), by, bw * G.zone, 26 * s);
      g.fillStyle = '#123'; g.fillRect(bx + bw * G.pos - 4 * s, by - 10 * s, 8 * s, 46 * s);
      for (k = 0; k < G.need; k++) text(g, G.hits[k] === undefined ? '○' : G.hits[k] ? '✔' : '✖', cx + (k - 1) * 40 * s, by + 70 * s, 28 * s, G.hits[k] === false ? '#e53935' : '#2bb673');
      timeBar(g, p, 1 - G.t / G.limit);
    } else if (G.kind === 'breathe') {
      var gx = cx + 90 * s, gy = cy - 80 * s, gh = 170 * s;
      text(g, G.opts.baby ? '👶' : '😮‍💨', cx - 70 * s, cy, 90 * s);
      g.fillStyle = '#e3e6ea'; g.fillRect(gx, gy, 34 * s, gh);
      g.fillStyle = 'rgba(43,182,115,0.45)'; g.fillRect(gx, gy + gh * (1 - 0.9), 34 * s, gh * 0.24);
      g.fillStyle = G.fill > 0.9 ? '#ef5350' : '#3aa0ff'; var fh = gh * Math.min(1, G.fill); g.fillRect(gx + 6 * s, gy + gh - fh, 22 * s, fh);
      for (k = 0; k < G.need; k++) g.fillStyle = k < G.n ? '#2bb673' : '#ccd', g.beginPath(), g.arc(cx - 110 * s + k * 24 * s, p.y + p.h - 40 * s, 7 * s, 0, 6.283), g.fill();
      timeBar(g, p, 1 - G.t / G.limit);
    } else if (G.kind === 'triage') {
      var pts = G.opts.patients || [];
      for (k = 0; k < 3; k++) {
        var cw = W * 0.2, chh = p.h * 0.55, x = W * (0.14 + 0.24 * k) + W * 0.02, y = p.y + p.h * 0.25;
        g.fillStyle = k === G.sel ? '#fff4d6' : '#f0f2f5'; round(g, x, y, cw, chh, 14); g.fill();
        g.strokeStyle = k === G.sel ? '#ffb300' : '#ccd'; g.lineWidth = 4; g.stroke();
        var pt = pts[k] || { cond: 50, icon: '🤕' };
        text(g, pt.icon, x + cw / 2, y + chh * 0.35, chh * 0.3);
        var c = pt.cond / 100;
        g.fillStyle = '#dde'; g.fillRect(x + 14, y + chh * 0.72, cw - 28, 14);
        g.fillStyle = c < 0.45 ? '#e53935' : c < 0.65 ? '#ffb300' : '#43a047'; g.fillRect(x + 14, y + chh * 0.72, (cw - 28) * c, 14);
        text(g, '❤ ' + (k + 1), x + cw / 2, y + chh * 0.88, 18 * s);
      }
      timeBar(g, p, 1 - G.t / G.limit);
    }
    if (G.flash > 0 && G.msg) { g.globalAlpha = Math.min(1, G.flash * 3); text(g, G.msg, cx, p.y + 70 * s, 30 * s, G.msg === '✖' ? '#e53935' : '#2bb673'); g.globalAlpha = 1; }
  }
})();
