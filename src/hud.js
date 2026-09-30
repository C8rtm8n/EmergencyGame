// In-game HUD drawn on the canvas: icons, bars and arrows rather than text.
'use strict';
(function () {
  var toasts = [], card = null, result = null, buttons = [];
  var H = Z.hud = {
    toast: function (s, col) { toasts.push({ s: s, col: col || '#fff', t: 0 }); if (toasts.length > 4) toasts.shift(); },
    dispatch: function (m) { card = { m: m, t: 0 }; },
    result: function (m, pts, sum, mul) { result = { m: m, pts: pts, sum: sum, mul: mul, t: 0 }; },
    reset: function () { toasts.length = 0; card = null; result = null; },
    buttons: function () { return buttons; },
    draw: draw,
  };
  function txt(g, s, x, y, size, col, align, weight) {
    g.font = (weight || 700) + ' ' + size + 'px system-ui,-apple-system,Segoe UI,sans-serif';
    g.textAlign = align || 'left'; g.textBaseline = 'middle';
    g.lineWidth = Math.max(2, size / 6); g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText(s, x, y);
    g.fillStyle = col || '#fff'; g.fillText(s, x, y);
  }
  function pill(g, x, y, w, h, col) {
    var r = h / 2; g.fillStyle = col || 'rgba(12,20,32,0.62)';
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill();
  }
  function bar(g, x, y, w, h, f, col) {
    pill(g, x, y, w, h, 'rgba(0,0,0,0.45)');
    if (f > 0) pill(g, x + 2, y + 2, Math.max(h - 4, (w - 4) * Z.clamp(f, 0, 1)), h - 4, col);
  }
  function condCol(c) { return c < 30 ? '#ef5350' : c < 60 ? '#ffb300' : '#43d17a'; }

  function draw(g, W, H0, s, st) {
    var S = Z.missions.get(), P = Z.player, pad = 14 * s, safe = Z.game.safe;
    var L = pad + safe.l * s, T = pad + safe.t * s, R = W - pad - safe.r * s, B = H0 - pad - safe.b * s;
    buttons.length = 0;
    // ---- top-left: time, score, clock
    var tl = Z.game.shiftLeft();
    pill(g, L, T, 300 * s, 44 * s);
    txt(g, '⏱ ' + Z.fmtTime(tl), L + 14 * s, T + 22 * s, 22 * s, tl < 30 ? '#ff8a65' : '#fff');
    txt(g, '⭐ ' + (S ? S.score : 0), L + 120 * s, T + 22 * s, 22 * s, '#ffe082');
    txt(g, Z.game.clockText(), L + 230 * s, T + 22 * s, 18 * s, '#cfe3ff', 'left', 600);
    // ---- ambulance damage + smooth run
    var y2 = T + 52 * s;
    txt(g, '🔧', L + 6 * s, y2 + 12 * s, 18 * s);
    bar(g, L + 32 * s, y2 + 3 * s, 130 * s, 18 * s, P.hp / P.maxHp, P.hp / P.maxHp < 0.35 ? '#ef5350' : '#90a4ae');
    if (P.hp / P.maxHp < 0.4) {
      var bx = L + 170 * s, by = y2 - 2 * s, bw = 88 * s, bh = 28 * s;
      pill(g, bx, by, bw, bh, 'rgba(255,193,7,0.95)');
      txt(g, '🎬 🔧', bx + bw / 2, by + bh / 2, 16 * s, '#222', 'center');
      buttons.push({ x: bx, y: by, w: bw, h: bh, id: 'repair' });
    }
    if (S && S.cleanDist > 30) txt(g, '〰 ' + Math.round(S.cleanDist) + ' m', L + 6 * s, y2 + 40 * s, 17 * s, '#9ff0c8');
    // ---- dispatch card (top centre)
    var m = S && S.mission;
    if (m) {
      var cw = 380 * s, cx = W / 2 - cw / 2, cy = T;
      pill(g, cx, cy, cw, 52 * s, m.stage === 1 ? 'rgba(160,20,20,0.78)' : 'rgba(10,80,150,0.8)');
      txt(g, m.def.icon, cx + 30 * s, cy + 26 * s, 28 * s, '#fff', 'center');
      var label = Z.t('c_' + m.type) + (m.night ? ' 🌙' : '');
      txt(g, label, cx + 56 * s, cy + 17 * s, 18 * s);
      txt(g, (m.stage === 1 ? '📍 ' + (m.place || '') : '🏥 ' + Z.t('deliver')), cx + 56 * s, cy + 37 * s, 14 * s, '#e3eefc', 'left', 600);
      txt(g, Z.fmtDist(m.dist || 0), cx + cw - 14 * s, cy + 26 * s, 18 * s, '#fff', 'right');
      // patient condition
      var py = cy + 60 * s;
      txt(g, m.stage === 2 ? '🛏' : '⌛', cx + 12 * s, py + 12 * s, 18 * s);
      bar(g, cx + 38 * s, py + 2 * s, cw - 80 * s, 20 * s, m.cond / 100, condCol(m.cond));
      txt(g, (S.ouch > 0 ? '😣' : '❤'), cx + cw - 22 * s, py + 12 * s, 18 * s, '#fff', 'center');
      if (m.type === 'birth' || m.type === 'transfer') txt(g, '🐢', cx + cw + 12 * s, py + 12 * s, 18 * s, '#fff', 'left');
    }
    // dispatch pop-in
    if (card) {
      card.t += st.dt;
      if (card.t < 2.6) {
        var a = Math.min(1, card.t * 4, (2.6 - card.t) * 3);
        g.globalAlpha = a;
        pill(g, W / 2 - 170 * s, H0 * 0.3, 340 * s, 70 * s, 'rgba(180,20,20,0.85)');
        txt(g, '📻 ' + Z.t('dispatch'), W / 2, H0 * 0.3 + 22 * s, 18 * s, '#ffe0e0', 'center', 600);
        txt(g, card.m.def.icon + ' ' + Z.t('c_' + card.m.type), W / 2, H0 * 0.3 + 48 * s, 24 * s, '#fff', 'center');
        g.globalAlpha = 1;
      } else card = null;
    }
    // ---- minimap (top-right)
    minimap(g, R - 170 * s, T, 170 * s, st);
    // ---- arrow to target
    if (st.target) edgeArrow(g, W, H0, s, st.target);
    // ---- speed + siren state (bottom centre-left)
    var kmh = Math.round(P.speed * 3.6);
    var sx = Z.input.touch ? W / 2 : L + 80 * s, sy = B - 30 * s;
    pill(g, sx - 70 * s, sy - 24 * s, 140 * s, 48 * s);
    txt(g, kmh, sx - 8 * s, sy, 28 * s, '#fff', 'right');
    txt(g, 'km/h', sx - 2 * s, sy + 4 * s, 13 * s, '#bcd', 'left', 600);
    txt(g, P.siren ? '🚨' : '🔕', sx + 50 * s, sy, 20 * s, '#fff', 'center');
    // ---- action prompt
    if (Z.missions.canAct() && m && !Z.minigames.active) {
      var pw = 230 * s, px = W / 2 - pw / 2, pyy = H0 * 0.62;
      var pulse = 0.8 + Math.sin(st.time * 6) * 0.2;
      g.globalAlpha = pulse; pill(g, px, pyy, pw, 50 * s, 'rgba(46,160,90,0.92)'); g.globalAlpha = 1;
      txt(g, (m.stage === 1 ? m.def.icon + ' ✋ ' : '🏥 ✋ ') + (Z.input.touch ? '' : '[E]'), W / 2, pyy + 25 * s, 24 * s, '#fff', 'center');
      buttons.push({ x: px, y: pyy, w: pw, h: 50 * s, id: 'action' });
    }
    if (S && S.atBase && P.hp < P.maxHp) txt(g, '🔧…', W / 2, H0 * 0.55, 26 * s, '#fff', 'center');
    // ---- toasts
    for (var i = toasts.length - 1; i >= 0; i--) { toasts[i].t += st.dt; if (toasts[i].t > 2.4) toasts.splice(i, 1); }
    toasts.forEach(function (o, k) {
      var al = Math.min(1, (2.4 - o.t) * 2), yy = H0 * 0.4 - k * 34 * s - o.t * 10 * s;
      g.globalAlpha = al; txt(g, o.s, W / 2, yy, 24 * s, o.col, 'center'); g.globalAlpha = 1;
    });
    // ---- handover result
    if (result) {
      result.t += st.dt;
      if (result.t < 3.2) {
        var al2 = Math.min(1, result.t * 4, (3.2 - result.t) * 3), rw = 320 * s, rx = W / 2 - rw / 2, ry = H0 * 0.18;
        g.globalAlpha = al2;
        pill(g, rx, ry, rw, 132 * s, 'rgba(12,40,24,0.86)');
        txt(g, result.m.def.icon + ' ' + Z.t('handover') + '  +' + result.sum, W / 2, ry + 24 * s, 22 * s, '#b9f6ca', 'center');
        var P2 = result.pts, rows = [['❤', P2.cond], ['⏱', P2.time], ['〰', P2.clean], ['⚖', P2.triage]].filter(function (r) { return r[1]; });
        rows.forEach(function (r, k) { txt(g, r[0] + ' +' + r[1], rx + 30 * s + (k % 2) * 150 * s, ry + 58 * s + Math.floor(k / 2) * 28 * s, 18 * s, '#fff'); });
        if (result.mul > 1) txt(g, '×' + result.mul.toFixed(2), rx + rw - 20 * s, ry + 110 * s, 16 * s, '#ffe082', 'right');
        g.globalAlpha = 1;
      } else result = null;
    }
    // ---- OSM attribution (required)
    g.font = '600 ' + Math.round(11 * s) + 'px system-ui,sans-serif'; g.textAlign = 'right'; g.textBaseline = 'bottom';
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillText('© OpenStreetMap contributors', R, H0 - 4 * s - safe.b * s);
    if (Z.minigames.active) Z.minigames.draw(g, W, H0);
  }

  function minimap(g, x, y, size, st) {
    var mm = Z.tiles.minimap; if (!mm) return;
    var P = Z.player, sc = mm.scale, b = Z.map.bounds, r = size / 2, cx = x + r, cy = y + r;
    var zoom = 1.35; // minimap px per minimap-image px
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.closePath();
    g.fillStyle = '#6f955a'; g.fill(); g.clip();
    var ix = (P.x - b[0]) * sc, iy = (P.y - b[1]) * sc;
    g.drawImage(mm.cv, cx - ix * zoom, cy - iy * zoom, mm.cv.width * zoom, mm.cv.height * zoom);
    var tr = function (wx, wy) { return [cx + ((wx - b[0]) * sc - ix) * zoom, cy + ((wy - b[1]) * sc - iy) * zoom]; };
    // jams
    g.strokeStyle = 'rgba(255,40,40,0.9)'; g.lineWidth = 3;
    Z.map.edges.forEach(function (e) {
      if (e.jam < 2.5) return;
      var p = e.pts, a = tr(p[0], p[1]); g.beginPath(); g.moveTo(a[0], a[1]);
      for (var k = 2; k < p.length; k += 2) { a = tr(p[k], p[k + 1]); g.lineTo(a[0], a[1]); } g.stroke();
    });
    if (st.route) {
      var p = st.route.pts; g.strokeStyle = '#29b6f6'; g.lineWidth = 3.5; g.lineJoin = 'round'; g.beginPath();
      var a = tr(p[0], p[1]); g.moveTo(a[0], a[1]); for (var k = 2; k < p.length; k += 2) { a = tr(p[k], p[k + 1]); g.lineTo(a[0], a[1]); } g.stroke();
    }
    Z.map.hospitals.forEach(function (h) { var q = tr(h.x, h.y); g.fillStyle = h.er ? '#e53935' : '#ef9a9a'; g.fillRect(q[0] - 5, q[1] - 5, 10, 10); g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', q[0], q[1] + 0.5); });
    Z.map.stations.forEach(function (h) { var q = tr(h.x, h.y); g.fillStyle = '#1f9d55'; g.beginPath(); g.arc(q[0], q[1], 5, 0, 6.283); g.fill(); });
    if (st.target) {
      var t = tr(st.target.x, st.target.y), dx = t[0] - cx, dy = t[1] - cy, d = Math.hypot(dx, dy);
      if (d > r - 8) { t = [cx + dx / d * (r - 8), cy + dy / d * (r - 8)]; }
      g.fillStyle = st.target.color || '#ff3b3b'; g.beginPath(); g.arc(t[0], t[1], 6, 0, 6.283); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    }
    g.translate(cx, cy); g.rotate(P.h);
    g.fillStyle = '#ffeb3b'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(8, 0); g.lineTo(-6, -5); g.lineTo(-3, 0); g.lineTo(-6, 5); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText('N', cx, y + 10);
  }
  function edgeArrow(g, W, H0, s, tg) {
    var sp = Z.render.toScreen(tg.x, tg.y), x = sp[0], y = sp[1], m = 60 * s;
    if (x > m && x < W - m && y > m && y < H0 - m) return;
    var cx = W / 2, cy = H0 / 2, dx = x - cx, dy = y - cy, k = Math.min((W / 2 - m) / Math.abs(dx || 1e-6), (H0 / 2 - m) / Math.abs(dy || 1e-6));
    var ax = cx + dx * k, ay = cy + dy * k, ang = Math.atan2(dy, dx);
    g.save(); g.translate(ax, ay); g.rotate(ang);
    g.fillStyle = tg.color || '#ff3b3b'; g.strokeStyle = '#fff'; g.lineWidth = 3 * s;
    g.beginPath(); g.moveTo(24 * s, 0); g.lineTo(-12 * s, -16 * s); g.lineTo(-4 * s, 0); g.lineTo(-12 * s, 16 * s); g.closePath(); g.fill(); g.stroke();
    g.restore();
    if (tg.icon) txt(g, tg.icon, ax - Math.cos(ang) * 30 * s, ay - Math.sin(ang) * 30 * s, 20 * s, '#fff', 'center');
  }
})();
