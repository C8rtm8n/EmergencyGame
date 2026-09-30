// World rendering: pre-rendered tiles, live pseudo-3D buildings (roofs shifted away from
// the camera like GTA 1), vehicles, traffic lights, route guidance, and a night light map.
'use strict';
(function () {
  var cv, g, W, H, scale = 1, M, light, lg, lampSprite, coneSprite, glowSprite;
  var view = { cx: 0, cy: 0, z: 7, camH: 150 };
  var WALLS = [
    ['#e8d9b0', '#e6c7a8', '#d9e0c8', '#f0e2c6', '#e7cfc0', '#d8c9a0', '#efe6d0', '#dcc6b0'],
    ['#efe9dc', '#e4dccb', '#f2eee5', '#d8cfbf', '#ece2cf', '#e9e4da', '#ddd3c2', '#f1ebe0'],
    ['#dcdad2', '#cfd6d8', '#e3dcc8', '#c9cfc9', '#d9d4c4', '#d2d8dc', '#e0ddd0', '#cdd3cf'],
    ['#c8c4bb', '#bfc3c5', '#cfc9bd', '#b9bdb8', '#c8c4bb', '#bfc3c5', '#cfc9bd', '#b9bdb8'],
    ['#f0e8d6', '#e8dcc2', '#efe3cf', '#e2d6bc', '#f3ecdf', '#e9dfca', '#e4d4b8', '#efe6d2'],
    ['#efe8d8'], ['#f3f1ea'], ['#f2f2f0'], ['#e8e2d0'],
  ];
  var ROOFS = [
    ['#a8442e', '#b5543a', '#9a3f2c', '#8c3a2a', '#b0503a', '#a04632', '#94412e', '#b85c40'],
    ['#8e3b2c', '#6d4a3a', '#4d4f55', '#a0523a', '#5a3d33', '#7a3a2e', '#585c62', '#99472f'],
    ['#9a9c9e', '#8e9294', '#a3a39c', '#96999b', '#a0a2a4', '#8a8e90', '#9fa09a', '#939698'],
    ['#a7aaad', '#b9b5aa', '#8f9ba3', '#a9aba5', '#b3b0a6', '#9aa3a8', '#a7aaad', '#b9b5aa'],
    ['#9a4632', '#7d3c2c', '#a95a3c', '#6a4536', '#8f3f2e', '#5d5f63', '#a34d35', '#83412f'],
    ['#5f6468'], ['#3d4a44'], ['#d5d9dc'], ['#b3b7ba'],
  ];
  var PITCHED = [1, 1, 0, 0, 1, 1, 0, 0, 0];

  Z.render = {
    view: view,
    init: function (canvas, map) {
      cv = canvas; g = cv.getContext('2d'); M = map;
      light = document.createElement('canvas'); lg = light.getContext('2d');
      lampSprite = radial(64, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
      glowSprite = radial(64, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);
      coneSprite = (function () {
        var c = document.createElement('canvas'); c.width = 128; c.height = 64; var q = c.getContext('2d');
        var gr = q.createLinearGradient(0, 32, 128, 32); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        q.fillStyle = gr; q.beginPath(); q.moveTo(0, 26); q.lineTo(128, 0); q.lineTo(128, 64); q.lineTo(0, 38); q.closePath(); q.fill();
        return c;
      })();
    },
    resize: function (w, h, s) {
      W = cv.width = w; H = cv.height = h; scale = s;
      light.width = Math.ceil(w / 2); light.height = Math.ceil(h / 2);
    },
    size: function () { return { W: W, H: H, scale: scale }; },
    toScreen: function (x, y) { return [(x - view.cx) * view.z + W / 2, (y - view.cy) * view.z + H / 2]; },
    frame: frame,
    drawCar: drawCar,
  };

  function radial(n, stops) {
    var c = document.createElement('canvas'); c.width = c.height = n; var q = c.getContext('2d');
    var gr = q.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    q.fillStyle = gr; q.fillRect(0, 0, n, n); return c;
  }
  function worldT() { g.setTransform(view.z, 0, 0, view.z, W / 2 - view.cx * view.z, H / 2 - view.cy * view.z); }

  // state: {player, cars, route, target, bays, night(0..1), time, shake, demo}
  function frame(st) {
    var z = view.z, hw = W / 2 / z, hh = H / 2 / z;
    var sx = 0, sy = 0;
    if (st.shake) { sx = (Math.random() - 0.5) * st.shake * 0.8; sy = (Math.random() - 0.5) * st.shake * 0.8; }
    view.cx += sx; view.cy += sy;
    var x0 = view.cx - hw, y0 = view.cy - hh, x1 = view.cx + hw, y1 = view.cy + hh;
    view.camH = 1100 / (z / scale);
    worldT();
    Z.tiles.draw(g, x0, y0, x1, y1, st.tileBudget || 3);
    // bays and markings on the road
    if (st.bays) st.bays.forEach(function (b) { drawBay(b, st.time); });
    if (st.route) drawRoute(st.route, st.time);
    drawSignals(x0, y0, x1, y1);
    // vehicles (shadows first)
    var cars = st.cars, vis = [];
    for (var i = 0; i < cars.length; i++) { var c = cars[i]; if (c.rx > x0 - 20 && c.rx < x1 + 20 && c.ry > y0 - 20 && c.ry < y1 + 20) vis.push(c); }
    g.fillStyle = 'rgba(0,0,0,0.22)';
    vis.forEach(function (c) { shadow(c.rx, c.ry, c.rh, c.len, c.wid); });
    if (st.player) shadow(st.player.x, st.player.y, st.player.h, st.player.stats.len, st.player.stats.wid);
    vis.forEach(function (c) {
      drawCar(g, c.rx, c.ry, c.rh, c.len, c.wid, c.color, c.type, { brake: c.brake, blink: c.blink > 0 ? (c.lane > 0 ? 1 : 1) : 0, hazard: c.wreck, siren: c.amb, t: st.time, night: st.night, wreck: c.wreck });
    });
    if (st.player) { var P = st.player; drawCar(g, P.x, P.y, P.h, P.stats.len, P.stats.wid, '#f5d000', 'amb', { brake: P.brakeL > 0, siren: P.siren, t: st.time, night: st.night, veh: Z.save.vehicle }); }
    if (st.target) drawTarget(st.target, st.time);
    // headphone icons over distracted drivers when siren is on
    if (st.player && st.player.siren) vis.forEach(function (c) {
      if (!c.distracted) return;
      var d = Math.hypot(c.rx - st.player.x, c.ry - st.player.y); if (d > 90) return;
      g.save(); g.translate(c.rx, c.ry - 2.8); g.scale(1 / z * scale, 1 / z * scale);
      g.font = '22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(0, 0, 16, 0, 6.283); g.fill();
      g.fillText('🎧', 0, 1); g.restore();
    });
    // buildings (far to near)
    drawBuildings(x0, y0, x1, y1, st.night);
    // night light map
    if (st.night > 0.02) drawNight(st, vis, x0, y0, x1, y1);
    view.cx -= sx; view.cy -= sy;
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  function shadow(x, y, h, len, wid) {
    g.save(); g.translate(x + 0.5, y + 0.7); g.rotate(h); g.fillRect(-len / 2, -wid / 2, len, wid); g.restore();
  }
  function rr(q, x, y, w, h, r) { q.beginPath(); q.moveTo(x + r, y); q.lineTo(x + w - r, y); q.quadraticCurveTo(x + w, y, x + w, y + r); q.lineTo(x + w, y + h - r); q.quadraticCurveTo(x + w, y + h, x + w - r, y + h); q.lineTo(x + r, y + h); q.quadraticCurveTo(x, y + h, x, y + h - r); q.lineTo(x, y + r); q.quadraticCurveTo(x, y, x + r, y); q.closePath(); }
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, gg = n >> 8 & 255, b = n & 255;
    r = Math.min(255, r * f) | 0; gg = Math.min(255, gg * f) | 0; b = Math.min(255, b * f) | 0;
    return 'rgb(' + r + ',' + gg + ',' + b + ')';
  }
  Z.shade = shade;

  // generic European-looking cars, vans, trucks, buses and the ambulance (no brands)
  function drawCar(q, x, y, h, len, wid, color, type, o) {
    o = o || {};
    q.save(); q.translate(x, y); q.rotate(h);
    var L = len / 2, Wd = wid / 2;
    if (type === 'truck') {
      q.fillStyle = shade(color, 0.85); rr(q, -L, -Wd, len - 2.6, wid, 0.3); q.fill();
      q.fillStyle = 'rgba(0,0,0,0.12)'; for (var k = -L + 1; k < L - 3; k += 1.2) q.fillRect(k, -Wd + 0.1, 0.1, wid - 0.2);
      q.fillStyle = '#3b3f45'; rr(q, L - 2.5, -Wd + 0.05, 2.5, wid - 0.1, 0.4); q.fill();
      q.fillStyle = '#9fc1d8'; q.fillRect(L - 0.9, -Wd + 0.25, 0.55, wid - 0.5);
    } else if (type === 'bus') {
      q.fillStyle = '#e8e8e6'; rr(q, -L, -Wd, len, wid, 0.5); q.fill();
      q.fillStyle = '#2e6db4'; q.fillRect(-L + 0.2, -Wd, len - 0.4, 0.25); q.fillRect(-L + 0.2, Wd - 0.25, len - 0.4, 0.25);
      q.fillStyle = '#c9ced3'; for (k = -L + 1.5; k < L - 1.5; k += 2.8) q.fillRect(k, -0.8, 1.6, 1.6);
      q.fillStyle = '#6b8ea8'; q.fillRect(L - 0.8, -Wd + 0.2, 0.6, wid - 0.4);
    } else if (type === 'amb') {
      // Czech ZZS: yellow body with green reflective (battenburg) side bands, no logos
      var veh = o.veh || 'van';
      q.fillStyle = '#f5d000'; rr(q, -L, -Wd, len, wid, 0.45); q.fill();
      var cab = veh === 'suv' || veh === 'rs' ? 1.6 : 1.3;
      for (k = -L + 0.3, i = 0; k < L - cab - 0.2; k += 0.62, i++) {
        q.fillStyle = i % 2 ? '#1a9e4b' : '#f7e84a';
        q.fillRect(k, -Wd, 0.62, 0.3); q.fillRect(k, Wd - 0.3, 0.62, 0.3);
      }
      q.fillStyle = '#fff7c2'; q.fillRect(-L + 0.4, -Wd + 0.45, len - cab - 0.9, wid - 0.9); // roof
      q.fillStyle = '#1a9e4b'; q.fillRect(-L + 0.4, -0.12, len - cab - 0.9, 0.24);
      q.fillStyle = '#2d3e4e'; rr(q, L - cab, -Wd + 0.2, 0.75, wid - 0.4, 0.2); q.fill(); // windscreen
      q.fillStyle = '#f5d000'; q.fillRect(L - cab + 0.75, -Wd + 0.25, cab - 0.95, wid - 0.5);
      // light bar
      var on = o.siren, ph = o.t * 6.5 % 2 < 1;
      q.fillStyle = on && ph ? '#4aa3ff' : '#1d4f9a'; q.fillRect(L - cab - 0.35, -Wd + 0.2, 0.35, Wd - 0.25);
      q.fillStyle = on && !ph ? '#4aa3ff' : '#1d4f9a'; q.fillRect(L - cab - 0.35, 0.05, 0.35, Wd - 0.25);
      q.fillStyle = on && !ph ? '#6db8ff' : '#244a7a'; q.fillRect(-L + 0.1, -Wd + 0.3, 0.25, 0.5); q.fillRect(-L + 0.1, Wd - 0.8, 0.25, 0.5);
    } else {
      var van = type === 'van';
      q.fillStyle = color; rr(q, -L, -Wd, len, wid, van ? 0.35 : 0.6); q.fill();
      q.fillStyle = shade(color, 1.18); rr(q, -L + (van ? 0.3 : 1.05), -Wd + 0.22, len - (van ? 1.5 : 2.2), wid - 0.44, 0.35); q.fill(); // roof
      q.fillStyle = '#23303b'; rr(q, L - (van ? 1.25 : 1.35), -Wd + 0.2, van ? 0.55 : 0.6, wid - 0.4, 0.2); q.fill(); // windscreen
      if (!van) { q.fillStyle = '#2b3844'; q.fillRect(-L + 0.55, -Wd + 0.28, 0.45, wid - 0.56); }
    }
    // lights
    if (o.brake || o.night) { q.fillStyle = o.brake ? '#ff2a2a' : '#8a1010'; q.fillRect(-L - 0.05, -Wd + 0.1, 0.18, 0.45); q.fillRect(-L - 0.05, Wd - 0.55, 0.18, 0.45); }
    if (o.night) { q.fillStyle = '#fffbe0'; q.fillRect(L - 0.12, -Wd + 0.12, 0.14, 0.45); q.fillRect(L - 0.12, Wd - 0.57, 0.14, 0.45); }
    if (o.hazard && (o.t * 2.5 % 1) < 0.5) { q.fillStyle = '#ffae00'; q.fillRect(-L, -Wd, 0.35, 0.35); q.fillRect(-L, Wd - 0.35, 0.35, 0.35); q.fillRect(L - 0.35, -Wd, 0.35, 0.35); q.fillRect(L - 0.35, Wd - 0.35, 0.35, 0.35); }
    if (o.wreck) { q.strokeStyle = 'rgba(40,40,40,0.6)'; q.lineWidth = 0.15; q.beginPath(); q.moveTo(L - 0.5, -Wd); q.lineTo(L - 1.2, 0); q.lineTo(L - 0.4, Wd); q.stroke(); }
    q.restore();
  }
  var i;

  function drawBay(b, t) {
    g.save(); g.translate(b.x, b.y); g.rotate(b.h);
    var er = b.kind === 'er';
    g.fillStyle = er ? 'rgba(230,40,40,0.18)' : 'rgba(30,160,80,0.2)'; g.fillRect(-4.5, -1.6, 9, 3.2);
    g.strokeStyle = er ? '#e23a3a' : '#1f9d55'; g.lineWidth = 0.3; g.setLineDash([0.8, 0.5]); g.strokeRect(-4.5, -1.6, 9, 3.2); g.setLineDash([]);
    g.rotate(-b.h);
    g.fillStyle = er ? '#e23a3a' : '#1f9d55'; g.font = 'bold 2.4px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(er ? 'H' : '155', 0, 0.1);
    g.restore();
  }
  function drawRoute(r, t) {
    var p = r.pts; if (!p || p.length < 4) return;
    g.lineCap = g.lineJoin = 'round';
    g.strokeStyle = 'rgba(40,170,255,0.30)'; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(p[0], p[1]); for (var k = 2; k < p.length; k += 2) g.lineTo(p[k], p[k + 1]); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.5; g.setLineDash([1.2, 3.2]); g.lineDashOffset = -t * 8; g.stroke(); g.setLineDash([]);
  }
  function drawTarget(tg, t) {
    var r = 5 + Math.sin(t * 4) * 1.2;
    g.strokeStyle = tg.color || '#ff3b3b'; g.lineWidth = 0.6;
    g.beginPath(); g.arc(tg.x, tg.y, r, 0, 6.283); g.stroke();
    g.globalAlpha = 0.25; g.beginPath(); g.arc(tg.x, tg.y, r + 3, 0, 6.283); g.stroke(); g.globalAlpha = 1;
    if (tg.icon) {
      g.save(); g.translate(tg.x, tg.y - 6 - Math.sin(t * 3) * 0.6); var s = 1 / view.z * scale; g.scale(s, s);
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.arc(0, 0, 22, 0, 6.283); g.fill();
      g.strokeStyle = tg.color || '#ff3b3b'; g.lineWidth = 3; g.stroke();
      g.font = '26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tg.icon, 0, 2);
      g.restore();
    }
  }
  var tmpP = {};
  function drawSignals(x0, y0, x1, y1) {
    var nodes = M.nodes;
    for (var k = 0; k < nodes.length; k++) {
      var n = nodes[k]; if (!n.sig || n.x < x0 - 30 || n.x > x1 + 30 || n.y < y0 - 30 || n.y > y1 + 30) continue;
      for (var j = 0; j < n.inc.length; j++) {
        var it = n.inc[j], e = it.e, dir = it.end === 1 ? 1 : -1;
        if (e.oneway && dir < 0) continue;
        var s = e.len - M.clrEnd(e, dir) + 0.5;
        M.travelPoint(e, dir, s, e.oneway ? e.halfW + 0.9 : e.halfW + 0.9, tmpP);
        var st = Z.traffic.sigState(n, Z.traffic.approachGroup(n, M.arriveBearing(e, dir)));
        g.save(); g.translate(tmpP.x, tmpP.y); g.rotate(Math.atan2(tmpP.ty, tmpP.tx));
        g.fillStyle = '#222'; rr(g, -0.5, -0.35, 1.9, 0.7, 0.2); g.fill();
        var cols = ['#27e060', '#ffb400', '#ff3030'];
        for (var q = 0; q < 3; q++) { g.fillStyle = q === 2 - st ? cols[st] : '#444'; g.beginPath(); g.arc(-0.15 + (2 - q) * 0.55, 0, 0.2, 0, 6.283); g.fill(); }
        g.restore();
      }
    }
  }

  // ------------------------------------------------------------ buildings
  var bl = [];
  function drawBuildings(x0, y0, x1, y1, night) {
    var G = M.bGrid, pad = 40;
    var i0 = Math.floor((x0 - pad) / G.c), i1 = Math.floor((x1 + pad) / G.c), j0 = Math.floor((y0 - pad) / G.c), j1 = Math.floor((y1 + pad) / G.c);
    var st = ++G.stamp; bl.length = 0;
    if (!M._bstamp) M._bstamp = new Uint32Array(M.nb);
    for (var i = i0; i <= i1; i++) for (var j = j0; j <= j1; j++) {
      var a = G.cell(i, j); if (!a) continue;
      for (var k = 0; k < a.length; k++) { var b = a[k]; if (M._bstamp[b] === st) continue; M._bstamp[b] = st; bl.push(b); }
    }
    var cx = view.cx, cy = view.cy;
    bl.sort(function (p, q) { return ((M.bx[q] - cx) * (M.bx[q] - cx) + (M.by[q] - cy) * (M.by[q] - cy)) - ((M.bx[p] - cx) * (M.bx[p] - cx) + (M.by[p] - cy) * (M.by[p] - cy)); });
    var H0 = view.camH, c = [], r = [];
    for (var n = 0; n < bl.length; n++) {
      b = bl[n];
      var h = M.bh[b], f = h / Math.max(20, H0 - h), stl = M.bst[b];
      Z.obbCorners(M.bx[b], M.by[b], M.bw[b] / 2, M.bd[b] / 2, M.bc[b], M.bs[b], c);
      for (var q = 0; q < 8; q += 2) { r[q] = c[q] + (c[q] - cx) * f; r[q + 1] = c[q + 1] + (c[q + 1] - cy) * f; }
      var wall = WALLS[stl][M.bcol[b] % WALLS[stl].length], roof = ROOFS[stl][M.bcol[b] % ROOFS[stl].length];
      // walls facing the camera
      for (q = 0; q < 4; q++) {
        var a0 = q * 2, a1 = ((q + 1) % 4) * 2;
        var ex = c[a1] - c[a0], ey = c[a1 + 1] - c[a0 + 1], nx = -ey, ny = ex; // outward normal
        var mx = (c[a0] + c[a1]) / 2, my = (c[a0 + 1] + c[a1 + 1]) / 2;
        if (nx * (cx - mx) + ny * (cy - my) <= 0) continue;
        var L = Math.hypot(nx, ny) || 1, lit = 0.72 + 0.22 * ((nx / L) * -0.6 + (ny / L) * -0.8);
        g.fillStyle = shade(wall, lit);
        g.beginPath(); g.moveTo(c[a0], c[a0 + 1]); g.lineTo(c[a1], c[a1 + 1]); g.lineTo(r[a1], r[a1 + 1]); g.lineTo(r[a0], r[a0 + 1]); g.closePath(); g.fill();
        if (h > 6 && stl !== 3) windows(c, r, a0, a1, h, night, stl);
      }
      // roof
      g.fillStyle = roof;
      g.beginPath(); g.moveTo(r[0], r[1]); g.lineTo(r[2], r[3]); g.lineTo(r[4], r[5]); g.lineTo(r[6], r[7]); g.closePath(); g.fill();
      if (PITCHED[stl]) { // gable: darker half + ridge along the long side
        var mx0 = (r[0] + r[6]) / 2, my0 = (r[1] + r[7]) / 2, mx1 = (r[2] + r[4]) / 2, my1 = (r[3] + r[5]) / 2;
        g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.moveTo(mx0, my0); g.lineTo(mx1, my1); g.lineTo(r[4], r[5]); g.lineTo(r[6], r[7]); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.18; g.beginPath(); g.moveTo(mx0, my0); g.lineTo(mx1, my1); g.stroke();
      } else if (stl === 6) { // tower: pyramid roof with gallery
        var tcx = (r[0] + r[4]) / 2, tcy = (r[1] + r[5]) / 2, f2 = (h + 8) / Math.max(20, H0 - h - 8);
        var px = M.bx[b] + (M.bx[b] - cx) * f2, py = M.by[b] + (M.by[b] - cy) * f2;
        g.fillStyle = '#e9e6dc'; g.fillRect(tcx - 0.6, tcy - 0.6, 1.2, 1.2);
        for (q = 0; q < 4; q++) { var a2 = q * 2, b2 = ((q + 1) % 4) * 2; g.fillStyle = q % 2 ? '#2f3a35' : '#46554d'; g.beginPath(); g.moveTo(r[a2], r[a2 + 1]); g.lineTo(r[b2], r[b2 + 1]); g.lineTo(px, py); g.closePath(); g.fill(); }
      } else if (stl === 7) { // hospital: helipad on the biggest roof
        if (b === helipad()) { var hx = (r[0] + r[4]) / 2, hy = (r[1] + r[5]) / 2; g.strokeStyle = '#e8e8e8'; g.lineWidth = 0.5; g.beginPath(); g.arc(hx, hy, 5, 0, 6.283); g.stroke(); g.fillStyle = '#e8e8e8'; g.font = 'bold 6px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', hx, hy + 0.3); }
      } else {
        g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 0.25;
        g.beginPath(); g.moveTo(r[0], r[1]); g.lineTo(r[2], r[3]); g.lineTo(r[4], r[5]); g.lineTo(r[6], r[7]); g.closePath(); g.stroke();
        if (stl === 2 && M.bw[b] > 20) { g.fillStyle = 'rgba(0,0,0,0.12)'; var ux = (r[2] - r[0]), uy = (r[3] - r[1]); for (var t = 0.2; t < 0.9; t += 0.3) g.fillRect(r[0] + ux * t + (r[6] - r[0]) * 0.35, r[1] + uy * t + (r[7] - r[1]) * 0.35, 1.6, 1.6); }
        if (stl === 3) { g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.2; for (t = 0.1; t < 1; t += 0.12) { g.beginPath(); g.moveTo(r[0] + (r[2] - r[0]) * t, r[1] + (r[3] - r[1]) * t); g.lineTo(r[6] + (r[4] - r[6]) * t, r[7] + (r[5] - r[7]) * t); g.stroke(); } }
      }
      if (stl === 5) { // church: tower at one end
        var th = h + 14, ft = th / Math.max(20, H0 - th), ang = Math.atan2(M.bs[b], M.bc[b]);
        var tx = M.bx[b] + M.bc[b] * (M.bw[b] / 2 - 2.5), ty = M.by[b] + M.bs[b] * (M.bw[b] / 2 - 2.5);
        var tc = []; Z.obbCorners(tx, ty, 2.5, 2.5, M.bc[b], M.bs[b], tc);
        var tr = []; for (q = 0; q < 8; q += 2) { tr[q] = tc[q] + (tc[q] - cx) * ft; tr[q + 1] = tc[q + 1] + (tc[q + 1] - cy) * ft; }
        for (q = 0; q < 4; q++) { a0 = q * 2; a1 = ((q + 1) % 4) * 2; g.fillStyle = shade('#efe8d8', 0.75 + q * 0.07); g.beginPath(); g.moveTo(tc[a0], tc[a0 + 1]); g.lineTo(tc[a1], tc[a1 + 1]); g.lineTo(tr[a1], tr[a1 + 1]); g.lineTo(tr[a0], tr[a0 + 1]); g.closePath(); g.fill(); }
        var sp = (th + 6) / Math.max(20, H0 - th - 6), spx = tx + (tx - cx) * sp, spy = ty + (ty - cy) * sp;
        for (q = 0; q < 4; q++) { a0 = q * 2; a1 = ((q + 1) % 4) * 2; g.fillStyle = q % 2 ? '#3f5c4c' : '#56765f'; g.beginPath(); g.moveTo(tr[a0], tr[a0 + 1]); g.lineTo(tr[a1], tr[a1 + 1]); g.lineTo(spx, spy); g.closePath(); g.fill(); }
        void ang;
      }
    }
  }
  function helipad() {
    if (M._heli === undefined) { M._heli = -1; var best = 0; for (var i = 0; i < M.nb; i++) if (M.bst[i] === 7 && M.bw[i] * M.bd[i] > best) { best = M.bw[i] * M.bd[i]; M._heli = i; } }
    return M._heli;
  }
  function windows(c, r, a0, a1, h, night, stl) {
    var floors = Math.max(1, Math.round(h / 3.1)), len = Math.hypot(c[a1] - c[a0], c[a1 + 1] - c[a0 + 1]);
    var cols = Math.max(1, Math.floor(len / 3.2));
    if (floors * cols > 60) { cols = Math.max(1, Math.floor(60 / floors)); }
    g.fillStyle = night > 0.3 ? 'rgba(255,214,120,0.85)' : 'rgba(60,80,100,0.35)';
    for (var fl = 0; fl < floors; fl++) {
      var t0 = (fl + 0.35) / floors, t1 = (fl + 0.75) / floors;
      for (var k = 0; k < cols; k++) {
        if (night > 0.3 && Z.hash2(a0 * 31 + k * 7 + (c[0] | 0), fl * 13 + (c[1] | 0)) > 0.55) continue;
        var u0 = (k + 0.25) / cols, u1 = (k + 0.75) / cols;
        var p = function (u, t) { var bx = c[a0] + (c[a1] - c[a0]) * u, by = c[a0 + 1] + (c[a1 + 1] - c[a0 + 1]) * u, rx = r[a0] + (r[a1] - r[a0]) * u, ry = r[a0 + 1] + (r[a1 + 1] - r[a0 + 1]) * u; return [bx + (rx - bx) * t, by + (ry - by) * t]; };
        var A = p(u0, t0), B = p(u1, t0), C = p(u1, t1), D = p(u0, t1);
        g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(C[0], C[1]); g.lineTo(D[0], D[1]); g.closePath(); g.fill();
      }
    }
  }

  // ------------------------------------------------------------ night
  function drawNight(st, vis, x0, y0, x1, y1) {
    var n = st.night, lw = light.width, lh = light.height, s = view.z / 2;
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, lw, lh);
    lg.fillStyle = 'rgba(6,10,32,' + (0.78 * n).toFixed(3) + ')'; lg.fillRect(0, 0, lw, lh);
    lg.globalCompositeOperation = 'destination-out';
    lg.setTransform(s, 0, 0, s, lw / 2 - view.cx * s, lh / 2 - view.cy * s);
    var G = M.lampGrid, i0 = Math.floor(x0 / G.c) - 1, i1 = Math.floor(x1 / G.c) + 1, j0 = Math.floor(y0 / G.c) - 1, j1 = Math.floor(y1 / G.c) + 1;
    var lamps = [];
    lg.globalAlpha = 0.75;
    for (var i = i0; i <= i1; i++) for (var j = j0; j <= j1; j++) {
      var a = G.cell(i, j); if (!a) continue;
      for (var k = 0; k < a.length; k++) { var L = a[k]; lg.drawImage(lampSprite, L.x - 13, L.y - 13, 26, 26); lamps.push(L); }
    }
    lg.globalAlpha = 0.9;
    var P = st.player;
    function cone(x, y, h, len) { lg.save(); lg.translate(x, y); lg.rotate(h); lg.drawImage(coneSprite, 0, -len * 0.3, len, len * 0.6); lg.restore(); }
    vis.forEach(function (c) { if (!c.wreck) cone(c.rx + Math.cos(c.rh) * c.len / 2, c.ry + Math.sin(c.rh) * c.len / 2, c.rh, 22); });
    if (P) { cone(P.x + Math.cos(P.h) * P.stats.len / 2, P.y + Math.sin(P.h) * P.stats.len / 2, P.h, 30); lg.drawImage(glowSprite, P.x - 8, P.y - 8, 16, 16); }
    lg.globalAlpha = 1;
    lg.globalCompositeOperation = 'source-over';
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(light, 0, 0, W, H);
    // additive glows
    worldT();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5 * n;
    lamps.forEach(function (L) { g.drawImage(glowSprite, L.x - 2.2, L.y - 2.2, 4.4, 4.4); });
    g.globalAlpha = 0.6 * n;
    vis.forEach(function (c) {
      var bx = c.rx - Math.cos(c.rh) * c.len / 2, by = c.ry - Math.sin(c.rh) * c.len / 2;
      if (c.brake) { g.drawImage(glowSprite, bx - 2, by - 2, 4, 4); }
    });
    function beacon(x, y, h, t) {
      var ph = t * 6.5 % 2 < 1, ox = -Math.sin(h), oy = Math.cos(h);
      g.globalAlpha = 0.9 * n;
      g.drawImage(tint('#3a8bff'), x + ox * (ph ? -1 : 1) - 7, y + oy * (ph ? -1 : 1) - 7, 14, 14);
    }
    if (P && P.siren) beacon(P.x, P.y, P.h, st.time);
    vis.forEach(function (c) { if (c.amb) beacon(c.rx, c.ry, c.rh, st.time); if (c.wreck && (st.time * 2.5 % 1) < 0.5) { g.globalAlpha = 0.7 * n; g.drawImage(tint('#ffae00'), c.rx - 5, c.ry - 5, 10, 10); } });
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  var tints = {};
  function tint(col) {
    if (tints[col]) return tints[col];
    var c = document.createElement('canvas'); c.width = c.height = 64; var q = c.getContext('2d');
    q.drawImage(glowSprite, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = col; q.fillRect(0, 0, 64, 64);
    return (tints[col] = c);
  }
})();
