// Terrain + roads are pre-rendered into square tiles (LRU cache) so each frame only
// blits a handful of images. Buildings, vehicles and lights are drawn live on top.
'use strict';
(function () {
  var M, TM, TR, TP, cache = new Map(), pool = [], frameStamp = 0, idx;
  var AREA_COL = ['#5d9ccf', '#4d7d3c', null, '#a9cc7e', '#86bf66', '#7cba62', '#98ae86', '#c2c2b2', '#c4beb3', '#c9b995'];
  var FARM = ['#d6cd8c', '#c7c078', '#b3c56b', '#dabd78', '#a6c268', '#cfd299', '#c4ae72'];
  var BASE = '#9dc279';

  Z.tiles = {
    init: function (map, pxPerM) {
      M = map; TM = Z.CONFIG.tileM;
      Z.tiles.setRes(pxPerM);
      idx = { areas: new Z.Grid(TM), rivers: new Z.Grid(TM), rails: new Z.Grid(TM), edges: new Z.Grid(TM), bridges: new Z.Grid(TM), nodes: new Z.Grid(TM) };
      M.areas.forEach(function (a) { idx.areas.add(a.x0, a.y0, a.x1, a.y1, a); });
      M.rivers.forEach(function (a) { idx.rivers.add(a.x0, a.y0, a.x1, a.y1, a); });
      M.rails.forEach(function (a) { idx.rails.add(a.x0, a.y0, a.x1, a.y1, a); });
      M.bridges.forEach(function (a) { idx.bridges.add(a.x0, a.y0, a.x1, a.y1, a); });
      M.edges.forEach(function (e) { var h = e.halfW + 3; idx.edges.add(e.x0 - h, e.y0 - h, e.x1 + h, e.y1 + h, e); });
      M.nodes.forEach(function (n) { idx.nodes.add(n.x - n.r - 4, n.y - n.r - 4, n.x + n.r + 4, n.y + n.r + 4, n); });
    },
    setRes: function (pxPerM) {
      var r = Z.clamp(Math.ceil(pxPerM * 0.85), 4, 8);
      if (r === TR) return;
      TR = r; TP = TM * TR; cache.clear(); pool.length = 0;
    },
    // draw all tiles covering the view rect (world coords) with transform already set for world
    draw: function (g, x0, y0, x1, y1, budget) {
      frameStamp++;
      var i0 = Math.floor(x0 / TM), i1 = Math.floor(x1 / TM), j0 = Math.floor(y0 / TM), j1 = Math.floor(y1 / TM);
      var made = 0;
      for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
        var k = i * 100000 + j, t = cache.get(k);
        if (!t && made < budget) { t = render(i, j); cache.set(k, t); made++; }
        if (t) { t.used = frameStamp; g.drawImage(t.cv, i * TM, j * TM, TM + 0.02, TM + 0.02); }
        else { g.fillStyle = BASE; g.fillRect(i * TM, j * TM, TM, TM); }
      }
      if (cache.size > Z.CONFIG.maxTiles) evict();
      return made;
    },
    prefetch: function (x0, y0, x1, y1, budget) {
      var i0 = Math.floor(x0 / TM), i1 = Math.floor(x1 / TM), j0 = Math.floor(y0 / TM), j1 = Math.floor(y1 / TM), made = 0;
      for (var j = j0; j <= j1 && made < budget; j++) for (var i = i0; i <= i1 && made < budget; i++) {
        var k = i * 100000 + j; if (cache.has(k)) { cache.get(k).used = frameStamp; continue; }
        cache.set(k, render(i, j)); made++;
      }
    },
    minimap: null,
    buildMinimap: buildMinimap,
    clear: function () { cache.clear(); },
  };

  function evict() {
    var arr = []; cache.forEach(function (v, k) { arr.push([v.used, k]); });
    arr.sort(function (a, b) { return a[0] - b[0]; });
    var n = cache.size - Z.CONFIG.maxTiles + 8;
    for (var q = 0; q < n && q < arr.length; q++) { var t = cache.get(arr[q][1]); if (t.used === frameStamp) continue; pool.push(t.cv); cache.delete(arr[q][1]); }
  }

  function poly(g, p, close) {
    g.beginPath(); g.moveTo(p[0], p[1]);
    for (var k = 2; k < p.length; k += 2) g.lineTo(p[k], p[k + 1]);
    if (close) g.closePath();
  }
  function offsetLine(p, d) { // offset polyline (flat array) to the right by d
    var n = p.length / 2, o = new Float32Array(p.length);
    for (var k = 0; k < n; k++) {
      var ax = p[Math.max(0, k - 1) * 2], ay = p[Math.max(0, k - 1) * 2 + 1], bx = p[Math.min(n - 1, k + 1) * 2], by = p[Math.min(n - 1, k + 1) * 2 + 1];
      var dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      var m = 1;
      if (k > 0 && k < n - 1) { // miter scale
        var d1x = p[k * 2] - ax, d1y = p[k * 2 + 1] - ay, l1 = Math.hypot(d1x, d1y) || 1;
        var cosA = (d1x * dx + d1y * dy) / (l1 * L); m = 1 / Math.max(0.5, cosA);
      }
      o[k * 2] = p[k * 2] + nx * d * m; o[k * 2 + 1] = p[k * 2 + 1] + ny * d * m;
    }
    return o;
  }
  Z.offsetLine = offsetLine;
  function pip(x, y, p) {
    var c = false, n = p.length / 2;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var ax = p[i * 2], ay = p[i * 2 + 1], bx = p[j * 2], by = p[j * 2 + 1];
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) c = !c;
    }
    return c;
  }
  Z.pip = pip;
  function inBuilding(x, y, pad) {
    var g = M.bGrid, a = g.cell(Math.floor(x / g.c), Math.floor(y / g.c)); if (!a) return false;
    for (var k = 0; k < a.length; k++) {
      var i = a[k], dx = x - M.bx[i], dy = y - M.by[i], u = dx * M.bc[i] + dy * M.bs[i], v = -dx * M.bs[i] + dy * M.bc[i];
      if (Math.abs(u) < M.bw[i] / 2 + pad && Math.abs(v) < M.bd[i] / 2 + pad) return true;
    }
    return false;
  }

  function tree(g, x, y, r, dark, light) {
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(x + r * 0.35, y + r * 0.35, r, 0, 6.283); g.fill();
    g.fillStyle = dark; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    g.fillStyle = light; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.55, 0, 6.283); g.fill();
  }

  function render(ti, tj) {
    var cv = pool.pop() || document.createElement('canvas');
    if (cv.width !== TP) { cv.width = TP; cv.height = TP; }
    var g = cv.getContext('2d');
    var X0 = ti * TM, Y0 = tj * TM, X1 = X0 + TM, Y1 = Y0 + TM;
    g.setTransform(TR, 0, 0, TR, -X0 * TR, -Y0 * TR);
    g.fillStyle = BASE; g.fillRect(X0, Y0, TM, TM);
    // subtle ground noise
    for (var q = 0; q < 6; q++) {
      var hx = Z.hash2(ti * 7 + q, tj * 13 - q);
      g.fillStyle = hx > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)';
      g.beginPath(); g.arc(X0 + Z.hash2(ti, tj * 3 + q) * TM, Y0 + Z.hash2(ti * 5 + q, tj) * TM, 6 + hx * 14, 0, 6.283); g.fill();
    }
    var areas = idx.areas.cell(ti, tj) || [], treeAreas = [];
    for (var a = 0; a < areas.length; a++) {
      var A = areas[a];
      if (A.cat === 2) {
        g.fillStyle = FARM[A.v % FARM.length]; poly(g, A.pts, true); g.fill();
        g.save(); g.clip();
        var ang = (A.v * 0.9) % 3.14, ca = Math.cos(ang), sa = Math.sin(ang);
        g.strokeStyle = 'rgba(90,80,30,0.16)'; g.lineWidth = 1.1; g.beginPath();
        var cx = X0 + TM / 2, cy = Y0 + TM / 2;
        for (var s = -TM; s <= TM; s += 3.2) { g.moveTo(cx + ca * -TM - sa * s, cy + sa * -TM + ca * s); g.lineTo(cx + ca * TM - sa * s, cy + sa * TM + ca * s); }
        g.stroke(); g.restore();
      } else {
        g.fillStyle = AREA_COL[A.cat]; poly(g, A.pts, true); g.fill();
        if (A.cat === 0) { g.strokeStyle = '#4a86b6'; g.lineWidth = 1.5; g.stroke(); }
        if (A.cat === 1 || A.cat === 4 || A.cat === 6) treeAreas.push(A);
      }
    }
    // rivers
    var rv = idx.rivers.cell(ti, tj) || [];
    g.lineCap = g.lineJoin = 'round';
    for (a = 0; a < rv.length; a++) { g.strokeStyle = '#7a9a5a'; g.lineWidth = rv[a].w + 3; poly(g, rv[a].pts); g.stroke(); }
    for (a = 0; a < rv.length; a++) { g.strokeStyle = '#5a98cc'; g.lineWidth = rv[a].w; poly(g, rv[a].pts); g.stroke(); }
    for (a = 0; a < rv.length; a++) { g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = rv[a].w * 0.3; poly(g, offsetLine(rv[a].pts, -rv[a].w * 0.15)); g.stroke(); }
    // trees in forests / parks / cemeteries
    for (var ty = Y0 + 2; ty < Y1; ty += 6) for (var tx = X0 + 2; tx < X1; tx += 6) {
      var h1 = Z.hash2(tx * 3 | 0, ty * 7 | 0), h2 = Z.hash2(ty * 5 | 0, tx * 11 | 0);
      var px = tx + (h1 - 0.5) * 5, py = ty + (h2 - 0.5) * 5;
      for (a = 0; a < treeAreas.length; a++) {
        var TA = treeAreas[a];
        if (TA.cat !== 1 && h1 > 0.35) continue;
        if (pip(px, py, TA.pts)) { if (M.roadDist(px, py) > 1.5) tree(g, px, py, TA.cat === 1 ? 3.2 + h2 * 1.6 : 2.4 + h2 * 1.4, TA.cat === 1 ? '#3c6a31' : '#4f8a3c', TA.cat === 1 ? '#4d7f3c' : '#66a24b'); break; }
      }
    }
    // rails
    var rl = idx.rails.cell(ti, tj) || [];
    for (a = 0; a < rl.length; a++) {
      g.strokeStyle = '#8d8578'; g.lineWidth = 4.5; poly(g, rl[a].pts); g.stroke();
      g.strokeStyle = '#6d5a48'; g.lineWidth = 2.6; g.setLineDash([0.4, 0.8]); poly(g, rl[a].pts); g.stroke(); g.setLineDash([]);
      g.strokeStyle = '#555'; g.lineWidth = 0.25; poly(g, offsetLine(rl[a].pts, 0.72)); g.stroke(); poly(g, offsetLine(rl[a].pts, -0.72)); g.stroke();
    }
    // roads
    var es = (idx.edges.cell(ti, tj) || []).slice().sort(function (p, q) { return q.cls - p.cls; });
    var e, k;
    for (k = 0; k < es.length; k++) { // kerbs / sidewalks / shoulders
      e = es[k];
      if (e.urban && e.cls >= 2) { g.strokeStyle = '#c9c4ba'; g.lineWidth = e.width + 4.2; }
      else { g.strokeStyle = '#8e8a7b'; g.lineWidth = e.width + (e.cls <= 1 ? 3.2 : 1.4); }
      poly(g, e.pts); g.stroke();
    }
    for (k = 0; k < es.length; k++) { // kerb line
      e = es[k]; if (!(e.urban && e.cls >= 2)) continue;
      g.strokeStyle = '#8f8c86'; g.lineWidth = e.width + 0.6; poly(g, e.pts); g.stroke();
    }
    for (k = 0; k < es.length; k++) { e = es[k]; g.strokeStyle = e.cls <= 1 ? '#54575b' : e.cls === 6 ? '#696b6e' : '#5c5f63'; g.lineWidth = e.width; poly(g, e.pts); g.stroke(); }
    // junction caps (after asphalt, before markings)
    var ns = idx.nodes.cell(ti, tj) || [];
    for (k = 0; k < ns.length; k++) {
      var n = ns[k]; if (n.deg < 3) continue;
      var hw = 0; n.inc.forEach(function (it) { hw = Math.max(hw, it.e.halfW); });
      g.fillStyle = n.inc[0].e.cls <= 1 ? '#54575b' : '#5c5f63'; g.beginPath(); g.arc(n.x, n.y, hw + 0.3, 0, 6.283); g.fill();
    }
    for (k = 0; k < es.length; k++) markings(g, es[k]);
    for (k = 0; k < ns.length; k++) {
      n = ns[k]; if (n.deg < 3 || n.rb) continue;
      hw = 0; var bc = 9; n.inc.forEach(function (it) { hw = Math.max(hw, it.e.halfW); bc = Math.min(bc, it.e.cls); });
      g.fillStyle = n.inc[0].e.cls <= 1 ? '#54575b' : '#5c5f63'; g.beginPath(); g.arc(n.x, n.y, Math.max(0, n.r - 1.6), 0, 6.283); g.fill();
      if (n.sig || (bc <= 4 && n.inc[0].e.urban)) zebras(g, n);
      else stopLines(g, n);
    }
    // bridges (drawn on top: railings + deck)
    var br = idx.bridges.cell(ti, tj) || [];
    for (k = 0; k < br.length; k++) {
      var b = br[k];
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = b.w + 5; poly(g, offsetLine(b.pts, 1.2)); g.stroke();
      g.strokeStyle = '#9a968e'; g.lineWidth = b.w + 3.2; poly(g, b.pts); g.stroke();
      g.strokeStyle = '#5c5f63'; g.lineWidth = b.w; poly(g, b.pts); g.stroke();
      g.strokeStyle = '#e8e6e0'; g.lineWidth = 0.5; poly(g, offsetLine(b.pts, b.w / 2 + 1.3)); g.stroke(); poly(g, offsetLine(b.pts, -b.w / 2 - 1.3)); g.stroke();
      if (!b.ow && b.lanes === 1 && b.cls <= 5) { g.strokeStyle = '#eee'; g.lineWidth = 0.15; g.setLineDash([3, 5]); poly(g, b.pts); g.stroke(); g.setLineDash([]); }
    }
    // trees along village/house streets
    for (ty = Y0 + 3; ty < Y1; ty += 11) for (tx = X0 + 3; tx < X1; tx += 11) {
      h1 = Z.hash2(tx | 0, ty * 3 | 0); if (h1 > 0.42) continue;
      px = tx + (Z.hash2(ty | 0, tx | 0) - 0.5) * 9; py = ty + (Z.hash2(tx * 7 | 0, ty | 0) - 0.5) * 9;
      var town = M.townAt(px, py); if (!town) { if (h1 > 0.06) continue; }
      var rd = M.roadDist(px, py);
      if (rd < 2.2 || rd > 26 || M.isWater(px, py) || inBuilding(px, py, 2)) continue;
      tree(g, px, py, 2 + h1 * 4, '#4a8038', '#5f9a48');
    }
    return { cv: cv, used: frameStamp };
  }

  function markings(g, e) {
    var W = e.W, p = e.pts, white = '#eeeeea';
    g.lineCap = 'butt';
    if (e.oneway) {
      if (e.lanes >= 2) {
        g.strokeStyle = white; g.lineWidth = 0.15; g.setLineDash(e.cls <= 1 ? [4, 8] : [3, 6]);
        for (var l = 1; l < e.lanes; l++) { poly(g, offsetLine(p, -e.lanes * W / 2 + l * W)); g.stroke(); }
        g.setLineDash([]);
      }
      if (e.cls <= 2 || !e.urban) {
        g.strokeStyle = white; g.lineWidth = 0.2;
        poly(g, offsetLine(p, e.halfW - 0.35)); g.stroke(); poly(g, offsetLine(p, -e.halfW + 0.35)); g.stroke();
      }
      if (e.cls === 0) { // guard rails (svodidla) on both sides
        g.strokeStyle = '#b8bcc0'; g.lineWidth = 0.35;
        poly(g, offsetLine(p, e.halfW + 1.0)); g.stroke(); poly(g, offsetLine(p, -e.halfW - 0.7)); g.stroke();
        g.strokeStyle = '#6f7478'; g.lineWidth = 0.35; g.setLineDash([0.3, 3.7]);
        poly(g, offsetLine(p, e.halfW + 1.0)); g.stroke(); poly(g, offsetLine(p, -e.halfW - 0.7)); g.stroke(); g.setLineDash([]);
      }
    } else {
      if (e.lanes >= 2) {
        g.strokeStyle = white; g.lineWidth = 0.14;
        poly(g, offsetLine(p, 0.16)); g.stroke(); poly(g, offsetLine(p, -0.16)); g.stroke();
        g.setLineDash([3, 6]);
        for (l = 1; l < e.lanes; l++) { poly(g, offsetLine(p, l * W)); g.stroke(); poly(g, offsetLine(p, -l * W)); g.stroke(); }
        g.setLineDash([]);
      } else if (e.cls <= 5) {
        g.strokeStyle = white; g.lineWidth = 0.14; g.setLineDash([3, 6]); poly(g, p); g.stroke(); g.setLineDash([]);
      }
      if (!e.urban && e.cls <= 4) { g.strokeStyle = white; g.lineWidth = 0.18; poly(g, offsetLine(p, e.halfW - 0.3)); g.stroke(); poly(g, offsetLine(p, -e.halfW + 0.3)); g.stroke(); }
    }
    g.lineCap = 'round';
  }
  function approachFrame(n, it) {
    var e = it.e, len = Math.min(e.len * 0.5, n.r + 1.4), tmp = {};
    if (it.end === 0) { M.pointAt(e, len, tmp); } else { M.pointAt(e, e.len - len, tmp); tmp.tx = -tmp.tx; tmp.ty = -tmp.ty; }
    return tmp; // tx,ty points away from node
  }
  function zebras(g, n) {
    g.fillStyle = 'rgba(240,240,236,0.92)';
    n.inc.forEach(function (it) {
      var e = it.e; if (e.cls <= 1) return;
      var f = approachFrame(n, it), nx = -f.ty, ny = f.tx, w = e.halfW - 0.3;
      for (var s = -w; s < w; s += 1.0) {
        var cx = f.x + nx * (s + 0.25), cy = f.y + ny * (s + 0.25);
        g.save(); g.translate(cx, cy); g.rotate(Math.atan2(f.ty, f.tx)); g.fillRect(-1.3, -0.25, 2.6, 0.5); g.restore();
      }
    });
  }
  function stopLines(g, n) {
    g.strokeStyle = 'rgba(240,240,236,0.8)'; g.lineWidth = 0.35;
    n.inc.forEach(function (it) {
      var e = it.e; if (e.cls <= 1 || e.cls === n.best && n.nBest >= 2) return;
      var dir = it.end === 1 ? 1 : -1; if (e.oneway && dir < 0) return; // arriving direction only
      var f = approachFrame(n, it), nx = -f.ty, ny = f.tx;
      // arriving lanes are on the side of the approach: to the left of 'away from node' vector
      var w0 = e.oneway ? -e.halfW : 0, w1 = e.oneway ? e.halfW : e.halfW;
      g.setLineDash([0.5, 0.4]);
      g.beginPath(); g.moveTo(f.x - nx * w0, f.y - ny * w0); g.lineTo(f.x - nx * w1, f.y - ny * w1); g.stroke(); g.setLineDash([]);
    });
  }

  function buildMinimap(scale) {
    var b = M.bounds, w = Math.ceil((b[2] - b[0]) * scale), h = Math.ceil((b[3] - b[1]) * scale);
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    g.fillStyle = '#7fa566'; g.fillRect(0, 0, w, h);
    g.setTransform(scale, 0, 0, scale, -b[0] * scale, -b[1] * scale);
    M.areas.forEach(function (a) {
      var c = a.cat === 2 ? '#a9a46c' : a.cat === 1 ? '#3f6a35' : a.cat === 0 ? '#3e7fbf' : a.cat === 7 ? '#9b9c95' : a.cat === 8 ? '#a09a90' : '#79a860';
      g.fillStyle = c; poly(g, a.pts, true); g.fill();
    });
    M.towns.forEach(function (t) { g.fillStyle = 'rgba(210,205,195,0.35)'; g.beginPath(); g.arc(t.x, t.y, t.r * 0.8, 0, 6.283); g.fill(); });
    g.lineCap = g.lineJoin = 'round';
    M.rivers.forEach(function (r) { g.strokeStyle = '#3e7fbf'; g.lineWidth = Math.max(r.w, 12); poly(g, r.pts); g.stroke(); });
    var order = M.edges.slice().sort(function (p, q) { return q.cls - p.cls; });
    order.forEach(function (e) {
      g.strokeStyle = e.cls === 0 ? '#f28c28' : e.cls <= 2 ? '#f6c342' : e.cls <= 4 ? '#f3f0e6' : '#d8d6cf';
      g.lineWidth = e.cls === 0 ? 20 : e.cls <= 4 ? 13 : 8; poly(g, e.pts); g.stroke();
    });
    Z.tiles.minimap = { cv: cv, scale: scale };
    return cv;
  }
})();
