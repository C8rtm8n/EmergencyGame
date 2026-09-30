// Runtime map: decodes window.MAP_DATA into a road graph with lanes, spatial indexes,
// buildings, a water mask and an A* router.
'use strict';
(function () {
  var LANE_W = [3.75, 3.75, 3.5, 3.5, 3.4, 3.2, 3.0];
  var SPEED = [[36, 36], [19, 19], [17, 25], [14, 22], [14, 21], [12, 19], [9.5, 15]]; // m/s [urban, rural]
  Z.LANE_W = LANE_W;

  function Grid(cell) { this.c = cell; this.m = new Map(); this.stamp = 1; }
  Grid.prototype.key = function (i, j) { return i * 65536 + j; };
  Grid.prototype.add = function (x0, y0, x1, y1, v) {
    var c = this.c;
    for (var i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (var j = Math.floor(y0 / c); j <= Math.floor(y1 / c); j++) {
      var k = this.key(i, j), a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(v);
    }
  };
  Grid.prototype.cell = function (i, j) { return this.m.get(this.key(i, j)); };
  Z.Grid = Grid;

  function unflat(f, scale) { var o = new Float32Array(f.length); for (var i = 0; i < f.length; i++) o[i] = f[i] / (scale || 10); return o; }

  var M_ = Z.mapProto = {};
  Z.buildMap = function (D) {
    var M = Object.create(M_);
    M.edges = []; M.nodes = []; M.bounds = D.bounds;
    // ------------------------------------------------ nodes
    for (var i = 0; i < D.nodes.length; i += 2) M.nodes.push({ i: i / 2, x: D.nodes[i] / 10, y: D.nodes[i + 1] / 10, inc: [], out: [], sig: 0, rb: 0, r: 4, deg: 0 });
    D.sig.forEach(function (i) { M.nodes[i].sig = 1; });
    // ------------------------------------------------ edges
    D.edges.forEach(function (E, idx) {
      var a = M.nodes[E[0]], b = M.nodes[E[1]], mid = unflat(E[5]);
      var pts = new Float32Array(mid.length + 4);
      pts[0] = a.x; pts[1] = a.y; pts.set(mid, 2); pts[pts.length - 2] = b.x; pts[pts.length - 1] = b.y;
      var n = pts.length / 2, cum = new Float32Array(n), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (var k = 0; k < n; k++) {
        if (k) cum[k] = cum[k - 1] + Math.hypot(pts[k * 2] - pts[k * 2 - 2], pts[k * 2 + 1] - pts[k * 2 - 1]);
        x0 = Math.min(x0, pts[k * 2]); x1 = Math.max(x1, pts[k * 2]); y0 = Math.min(y0, pts[k * 2 + 1]); y1 = Math.max(y1, pts[k * 2 + 1]);
      }
      var cls = E[2], lanes = E[3], fl = E[4], oneway = fl & 1, W = LANE_W[cls];
      var e = {
        i: idx, a: E[0], b: E[1], cls: cls, lanes: lanes, oneway: oneway, rb: (fl & 2) ? 1 : 0, urban: (fl & 4) ? 1 : 0,
        pts: pts, cum: cum, n: n, len: cum[n - 1], W: W,
        width: (oneway ? lanes : lanes * 2) * W, speed: SPEED[cls][(fl & 4) ? 0 : 1],
        x0: x0, y0: y0, x1: x1, y1: y1, clrA: 3, clrB: 3, jam: 0,
      };
      e.halfW = e.width / 2;
      M.edges.push(e);
      a.inc.push({ e: e, end: 0 }); b.inc.push({ e: e, end: 1 });
      a.out.push({ e: e, dir: 1 });
      if (!oneway) b.out.push({ e: e, dir: -1 });
      if (e.rb) { a.rb = 1; b.rb = 1; }
    });
    // ------------------------------------------------ node clearances, signal axis, best class
    M.nodes.forEach(function (n) {
      n.deg = n.inc.length;
      var best = 9, hw = 0;
      n.inc.forEach(function (it) { best = Math.min(best, it.e.cls); hw = Math.max(hw, it.e.halfW); });
      n.best = best;
      n.nBest = n.inc.filter(function (it) { return it.e.cls === best; }).length;
      n.r = n.deg >= 3 ? hw + 2.0 : 1.5;
      if (n.rb) n.r = Math.max(2.5, hw * 0.6);
      var ax = null;
      n.inc.forEach(function (it) { if (it.e.cls === best && ax === null) ax = M.bearingFrom(n, it); });
      n.axis = ax || 0;
      n.phase = Math.random() * 40;
      n.occ = []; n.appr = []; n.emergency = 0;
    });
    M.edges.forEach(function (e) {
      var ra = M.nodes[e.a].r, rb = M.nodes[e.b].r;
      var k = Math.min(1, e.len * 0.8 / (ra + rb));
      e.clrA = ra * k; e.clrB = rb * k;
    });
    // ------------------------------------------------ spatial index of road segments
    M.segGrid = new Grid(32);
    M.edges.forEach(function (e) {
      for (var k = 0; k + 1 < e.n; k++) {
        var ax = e.pts[k * 2], ay = e.pts[k * 2 + 1], bx = e.pts[k * 2 + 2], by = e.pts[k * 2 + 3], h = e.halfW + 2;
        M.segGrid.add(Math.min(ax, bx) - h, Math.min(ay, by) - h, Math.max(ax, bx) + h, Math.max(ay, by) + h, { e: e, k: k });
      }
    });
    // ------------------------------------------------ buildings
    var B = D.buildings, nb = B.length / 8;
    M.nb = nb;
    M.bx = new Float32Array(nb); M.by = new Float32Array(nb); M.bw = new Float32Array(nb); M.bd = new Float32Array(nb);
    M.bc = new Float32Array(nb); M.bs = new Float32Array(nb); M.bh = new Float32Array(nb); M.bst = new Uint8Array(nb); M.bcol = new Uint8Array(nb);
    M.bGrid = new Grid(48);
    for (i = 0; i < nb; i++) {
      var o = i * 8, ang = B[o + 4] / 1000;
      M.bx[i] = B[o] / 10; M.by[i] = B[o + 1] / 10; M.bw[i] = B[o + 2] / 10; M.bd[i] = B[o + 3] / 10;
      M.bc[i] = Math.cos(ang); M.bs[i] = Math.sin(ang); M.bh[i] = B[o + 5] / 10; M.bst[i] = B[o + 6]; M.bcol[i] = B[o + 7];
      var r = Math.hypot(M.bw[i], M.bd[i]) / 2;
      M.bGrid.add(M.bx[i] - r, M.by[i] - r, M.bx[i] + r, M.by[i] + r, i);
    }
    // ------------------------------------------------ other layers
    M.areas = D.areas.map(function (a) { return { cat: a[0], v: a[1], pts: unflat(a[2]) }; });
    M.areas.forEach(function (a) { bboxOf(a); });
    M.rivers = D.rivers.map(function (r) { var o = { w: r[0] / 10, pts: unflat(r[1]) }; bboxOf(o, o.w); return o; });
    M.rails = D.rails.map(function (r) { var o = { pts: unflat(r) }; bboxOf(o, 3); return o; });
    M.bridges = D.bridges.map(function (b) { var o = { cls: b[0], lanes: b[1], ow: b[2], pts: unflat(b[3]) }; o.w = (o.ow ? o.lanes : o.lanes * 2) * LANE_W[o.cls]; bboxOf(o, o.w); return o; });
    M.places = D.places.map(function (p) { return { n: p.n, x: p.x / 10, y: p.y / 10, t: p.t }; });
    M.towns = D.towns.map(function (t) { return { n: t.n, x: t.x / 10, y: t.y / 10, r: t.r / 10 }; });
    M.hospitals = D.hospitals.map(function (h) { return { n: h.n, x: h.x / 10, y: h.y / 10, er: h.er, ex: h.ex / 10, ey: h.ey / 10 }; });
    M.stations = D.stations.map(function (s) { return { n: s.n, x: s.x / 10, y: s.y / 10, main: s.main }; });
    // bays: stopping points on the road next to hospitals and stations
    M.hospitals.forEach(function (h) { h.bay = M.bayNear(h.ex, h.ey); });
    M.stations.forEach(function (s) { s.bay = M.bayNear(s.x, s.y); });
    M.mainHospital = M.hospitals.filter(function (h) { return h.er; })[0] || M.hospitals[0];
    M.mainBase = M.stations.filter(function (s) { return s.main; })[0] || M.stations[0];
    // ------------------------------------------------ street lamps (urban roads)
    M.lamps = []; M.lampGrid = new Grid(64);
    M.edges.forEach(function (e) {
      if (!e.urban && e.cls > 1) return;
      if (e.cls === 6 && Math.random() < 0.5) return;
      var step = e.cls <= 3 ? 28 : 36, side = 1, tmp = {};
      for (var s = e.clrA + 6; s < e.len - e.clrB - 4; s += step) {
        M.pointAt(e, s, tmp);
        var off = e.halfW + (e.cls === 0 ? 1.8 : 1.2);
        var L = { x: tmp.x - tmp.ty * off * side, y: tmp.y + tmp.tx * off * side };
        M.lamps.push(L); M.lampGrid.add(L.x, L.y, L.x, L.y, L);
        if (e.cls > 1) side = -side;
      }
    });
    buildWaterMask(M, D);
    return M;

    function bboxOf(o, pad) {
      pad = (pad || 0) / 2 + 1;
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, p = o.pts;
      for (var k = 0; k < p.length; k += 2) { x0 = Math.min(x0, p[k]); x1 = Math.max(x1, p[k]); y0 = Math.min(y0, p[k + 1]); y1 = Math.max(y1, p[k + 1]); }
      o.x0 = x0 - pad; o.y0 = y0 - pad; o.x1 = x1 + pad; o.y1 = y1 + pad;
    }
  };

  // ================================================================ geometry on edges
  // forward-parameter point on an edge
  M_.pointAt = function (e, s, out) {
    var cum = e.cum, n = e.n, pts = e.pts;
    if (s <= 0) { out.x = pts[0]; out.y = pts[1]; seg(0); return out; }
    if (s >= e.len) { out.x = pts[n * 2 - 2]; out.y = pts[n * 2 - 1]; seg(n - 2); return out; }
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    var L = cum[hi] - cum[lo], t = L > 0 ? (s - cum[lo]) / L : 0;
    out.x = pts[lo * 2] + (pts[hi * 2] - pts[lo * 2]) * t;
    out.y = pts[lo * 2 + 1] + (pts[hi * 2 + 1] - pts[lo * 2 + 1]) * t;
    seg(lo);
    return out;
    function seg(k) { var dx = pts[k * 2 + 2] - pts[k * 2], dy = pts[k * 2 + 3] - pts[k * 2 + 1], l = Math.hypot(dx, dy) || 1; out.tx = dx / l; out.ty = dy / l; }
  };
  // travel-direction point with lateral offset (positive = right of travel)
  M_.travelPoint = function (e, dir, s, lat, out) {
    if (dir > 0) this.pointAt(e, s, out); else { this.pointAt(e, e.len - s, out); out.tx = -out.tx; out.ty = -out.ty; }
    out.x += -out.ty * lat; out.y += out.tx * lat;
    return out;
  };
  M_.laneLat = function (e, lane) {
    return e.oneway ? (lane + 0.5) * e.W - e.lanes * e.W / 2 : (lane + 0.5) * e.W;
  };
  M_.bearingFrom = function (n, it) { // bearing of the edge leaving node n
    var e = it.e, p = e.pts, k;
    if (it.end === 0) { k = Math.min(1, e.n - 1); return Math.atan2(p[k * 2 + 1] - p[1], p[k * 2] - p[0]); }
    k = e.n - 2; return Math.atan2(p[k * 2 + 1] - p[e.n * 2 - 1], p[k * 2] - p[e.n * 2 - 2]);
  };
  // bearing from node when leaving along (e, dir); for arrival use the node at the end of travel
  M_.leaveBearing = function (e, dir) {
    var p = e.pts, n = e.n;
    var ax, ay, bx, by, s = Math.min(8, e.len * 0.5), tmp = {};
    if (dir > 0) { ax = p[0]; ay = p[1]; this.pointAt(e, s, tmp); } else { ax = p[n * 2 - 2]; ay = p[n * 2 - 1]; this.pointAt(e, e.len - s, tmp); }
    return Math.atan2(tmp.y - ay, tmp.x - ax);
  };
  M_.arriveBearing = function (e, dir) { // bearing from end node back along the edge (where the car comes from)
    return this.leaveBearing(e, -dir);
  };
  M_.endNode = function (e, dir) { return this.nodes[dir > 0 ? e.b : e.a]; };
  M_.startNode = function (e, dir) { return this.nodes[dir > 0 ? e.a : e.b]; };
  M_.clrEnd = function (e, dir) { return dir > 0 ? e.clrB : e.clrA; };
  M_.clrStart = function (e, dir) { return dir > 0 ? e.clrA : e.clrB; };

  // ================================================================ spatial queries
  var _q = { stamp: 1 };
  M_.nearestRoad = function (x, y, maxD, filter) {
    var g = this.segGrid, c = g.c, best = null, bd = maxD || 60, st = ++_q.stamp;
    var r = Math.ceil(bd / c);
    var ci = Math.floor(x / c), cj = Math.floor(y / c);
    for (var i = ci - r; i <= ci + r; i++) for (var j = cj - r; j <= cj + r; j++) {
      var a = g.cell(i, j); if (!a) continue;
      for (var k = 0; k < a.length; k++) {
        var it = a[k]; if (it._s === st) continue; it._s = st;
        if (filter && !filter(it.e)) continue;
        var e = it.e, p = e.pts, o = it.k * 2;
        var ax = p[o], ay = p[o + 1], dx = p[o + 2] - ax, dy = p[o + 3] - ay, L2 = dx * dx + dy * dy;
        var t = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        var px = ax + dx * t, py = ay + dy * t, d = Math.hypot(x - px, y - py);
        if (d < bd) { bd = d; best = { e: e, s: e.cum[it.k] + Math.sqrt(L2) * t, d: d, x: px, y: py, side: (dx * (y - ay) - dy * (x - ax)) > 0 ? 1 : -1 }; }
      }
    }
    return best;
  };
  // returns distance outside the paved road (<=0 means on the road)
  M_.roadDist = function (x, y) {
    var g = this.segGrid, c = g.c, ci = Math.floor(x / c), cj = Math.floor(y / c), best = 99;
    for (var i = ci - 1; i <= ci + 1; i++) for (var j = cj - 1; j <= cj + 1; j++) {
      var a = g.cell(i, j); if (!a) continue;
      for (var k = 0; k < a.length; k++) {
        var e = a[k].e, p = e.pts, o = a[k].k * 2;
        var ax = p[o], ay = p[o + 1], dx = p[o + 2] - ax, dy = p[o + 3] - ay, L2 = dx * dx + dy * dy;
        var t = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        var d = Math.hypot(x - ax - dx * t, y - ay - dy * t) - e.halfW;
        if (d < best) best = d;
      }
    }
    // junction discs
    return best;
  };
  M_.bayNear = function (x, y) {
    var r = this.nearestRoad(x, y, 400, function (e) { return e.cls >= 2; }) || this.nearestRoad(x, y, 2000);
    if (!r) return { x: x, y: y, e: null, s: 0, h: 0 };
    var tmp = this.pointAt(r.e, r.s, {});
    var off = r.e.halfW + 1.8, side = r.side;
    // bay: kerbside parking box on the side facing the building
    return { x: tmp.x - tmp.ty * off * side, y: tmp.y + tmp.tx * off * side, rx: r.x, ry: r.y, e: r.e, s: r.s, h: Math.atan2(tmp.ty, tmp.tx), side: side };
  };
  M_.placeName = function (x, y) {
    var best = null, bd = 1e18;
    for (var i = 0; i < this.places.length; i++) {
      var p = this.places[i], d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (p.t === 0) d *= 4; // prefer quarters over the whole city
      if (d < bd) { bd = d; best = p; }
    }
    return best ? best.n : '';
  };
  M_.townAt = function (x, y) {
    for (var i = 0; i < this.towns.length; i++) { var t = this.towns[i]; if (Math.hypot(t.x - x, t.y - y) < t.r) return t; }
    return null;
  };
  M_.isWater = function (x, y) {
    var w = this.water; if (!w) return false;
    var i = ((x - w.x0) / w.res) | 0, j = ((y - w.y0) / w.res) | 0;
    if (i < 0 || j < 0 || i >= w.w || j >= w.h) return false;
    return w.d[j * w.w + i] === 1;
  };

  function buildWaterMask(M, D) {
    var res = 3, x0 = M.bounds[0], y0 = M.bounds[1], w = Math.ceil((M.bounds[2] - x0) / res), h = Math.ceil((M.bounds[3] - y0) / res);
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.setTransform(1 / res, 0, 0, 1 / res, -x0 / res, -y0 / res);
    g.fillStyle = g.strokeStyle = '#fff'; g.lineCap = g.lineJoin = 'round';
    M.areas.forEach(function (a) { if (a.cat !== 0) return; path(g, a.pts, true); g.fill(); });
    M.rivers.forEach(function (r) { g.lineWidth = r.w; path(g, r.pts, false); g.stroke(); });
    g.strokeStyle = '#000';
    M.edges.forEach(function (e) { g.lineWidth = e.width + 2; path(g, e.pts, false); g.stroke(); });
    M.bridges.forEach(function (b) { g.lineWidth = b.w + 2; path(g, b.pts, false); g.stroke(); });
    var img = g.getImageData(0, 0, w, h).data, d = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++) d[i] = img[i * 4] > 127 ? 1 : 0;
    M.water = { x0: x0, y0: y0, res: res, w: w, h: h, d: d };
  }
  function path(g, p, close) {
    g.beginPath(); g.moveTo(p[0], p[1]);
    for (var k = 2; k < p.length; k += 2) g.lineTo(p[k], p[k + 1]);
    if (close) g.closePath();
  }
  Z.pathFlat = path;

  // ================================================================ routing (A*)
  function Heap() { this.a = []; }
  Heap.prototype.push = function (v, p) { var a = this.a; a.push([p, v]); var i = a.length - 1; while (i > 0) { var q = (i - 1) >> 1; if (a[q][0] <= a[i][0]) break; var t = a[q]; a[q] = a[i]; a[i] = t; i = q; } };
  Heap.prototype.pop = function () {
    var a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; var i = 0; for (;;) { var l = i * 2 + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; var t = a[m]; a[m] = a[i]; a[i] = t; i = m; } }
    return top[1];
  };
  // from/to: {x,y}. Returns {pts:[x,y,...], len} following roads. The ambulance may drive
  // against one-way streets, but that costs extra.
  M_.route = function (from, to, opts) {
    opts = opts || {};
    var A = this.nearestRoad(from.x, from.y, 300), Bq = this.nearestRoad(to.x, to.y, 400, function (e) { return e.cls >= 1 || true; });
    if (!A || !Bq) return null;
    var nodes = this.nodes, N = nodes.length;
    var g = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-2), prevE = new Array(N);
    var H = new Heap(), self = this;
    var vmax = 45;
    var h = function (n) { return Math.hypot(nodes[n].x - to.x, nodes[n].y - to.y) / vmax; };
    var cost = function (e, dir) {
      var c = e.len / e.speed;
      if (e.oneway && dir < 0) c *= 4;
      c += e.jam * 6;
      return c;
    };
    // start: along A.e to its two end nodes
    var ea = A.e;
    g[ea.a] = A.s / ea.speed * (ea.oneway ? 4 : 1); prev[ea.a] = -1; prevE[ea.a] = null; H.push(ea.a, g[ea.a] + h(ea.a));
    g[ea.b] = (ea.len - A.s) / ea.speed; prev[ea.b] = -1; prevE[ea.b] = null; H.push(ea.b, g[ea.b] + h(ea.b));
    var eb = Bq.e, goalA = eb.a, goalB = eb.b, found = -1, iter = 0;
    var goalCostA = Bq.s / eb.speed, goalCostB = (eb.len - Bq.s) / eb.speed * (eb.oneway ? 4 : 1);
    var bestGoal = Infinity, bestEnd = -1;
    if (ea === eb) { bestGoal = Math.abs(A.s - Bq.s) / ea.speed; bestEnd = -3; }
    while (H.a.length && iter++ < 60000) {
      var u = H.pop();
      if (g[u] + h(u) >= bestGoal) break;
      if (u === goalA && g[u] + goalCostA < bestGoal) { bestGoal = g[u] + goalCostA; bestEnd = goalA; }
      if (u === goalB && g[u] + goalCostB < bestGoal) { bestGoal = g[u] + goalCostB; bestEnd = goalB; }
      var inc = nodes[u].inc;
      for (var k = 0; k < inc.length; k++) {
        var e = inc[k].e, dir = inc[k].end === 0 ? 1 : -1, v = dir > 0 ? e.b : e.a;
        var c = g[u] + cost(e, dir);
        if (c < g[v]) { g[v] = c; prev[v] = u; prevE[v] = { e: e, dir: dir }; H.push(v, c + h(v)); }
      }
    }
    if (bestEnd === -1) return null;
    var out = [from.x, from.y], tmp = {};
    if (bestEnd === -3) { appendEdgeSpan(this, out, ea, A.s, Bq.s); out.push(to.x, to.y); return finish(out); }
    // reconstruct node chain
    var chain = [], n = bestEnd;
    while (n >= 0 && prev[n] !== -1) { chain.push(prevE[n]); n = prev[n]; }
    chain.reverse();
    var startNode = n;
    // from player position to start node along ea
    appendEdgeSpan(this, out, ea, A.s, startNode === ea.a ? 0 : ea.len);
    for (var i = 0; i < chain.length; i++) {
      var c2 = chain[i];
      if (c2.dir > 0) appendEdgeSpan(this, out, c2.e, 0, c2.e.len); else appendEdgeSpan(this, out, c2.e, c2.e.len, 0);
    }
    appendEdgeSpan(this, out, eb, bestEnd === eb.a ? 0 : eb.len, Bq.s);
    out.push(to.x, to.y);
    return finish(out);
    function finish(o) {
      var L = 0; for (var q = 2; q < o.length; q += 2) L += Math.hypot(o[q] - o[q - 2], o[q + 1] - o[q - 1]);
      return { pts: o, len: L, eta: bestGoal };
    }
  };
  function appendEdgeSpan(M, out, e, s0, s1) {
    var tmp = {}, p = e.pts, cum = e.cum;
    M.pointAt(e, s0, tmp); out.push(tmp.x, tmp.y);
    if (s1 > s0) { for (var k = 0; k < e.n; k++) if (cum[k] > s0 && cum[k] < s1) out.push(p[k * 2], p[k * 2 + 1]); }
    else { for (var k2 = e.n - 1; k2 >= 0; k2--) if (cum[k2] < s0 && cum[k2] > s1) out.push(p[k2 * 2], p[k2 * 2 + 1]); }
    M.pointAt(e, s1, tmp); out.push(tmp.x, tmp.y);
  }
})();
