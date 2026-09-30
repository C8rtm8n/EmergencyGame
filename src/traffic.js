// AI traffic: cars follow the road graph in their lane (IDM car-following), obey
// junction priority / traffic lights / roundabouts, overtake on multi-lane roads and
// react to the ambulance siren: pull over on single-lane roads, form a rescue corridor
// (záchranářská ulička) on multi-lane roads and the D11, and hold cross traffic at
// junctions. A share of drivers wear headphones (🎧) and only react to the horn.
'use strict';
(function () {
  var M, cars = [], nextId = 1, time = 0;
  var hash = new Map(), HC = 20, byEdge = new Map(), activeNodes = [];
  var tmp = {}, tmp2 = {};
  var COLORS = ['#d9dde2', '#f4f4f2', '#23262b', '#3a4a6b', '#9e1b22', '#2f5d3a', '#7b8087', '#b8bcc2', '#1f4f8f', '#6b3a2a', '#c7a86a', '#4a4f56', '#8a1538', '#e0e3e6'];
  var CYCLE = 36;

  Z.traffic = {
    cars: cars,
    time: function () { return time; },
    init: function (map) { M = map; cars.length = 0; },
    clear: function () { cars.length = 0; M.nodes.forEach(function (n) { n.occ.length = 0; n.appr = []; n.apprPrev = []; }); },
    density: 1,
    sigState: sigState,
    approachGroup: approachGroup,
    addWreck: addWreck,
    removeWrecks: function (tag) { for (var i = cars.length - 1; i >= 0; i--) if (cars[i].wreck && (!tag || cars[i].tag === tag)) removeCar(i); },
    spawnAround: function (x, y, n, rmin, rmax) { for (var i = 0; i < n * 3 && n > 0; i++) if (spawnOne(x, y, rmin, rmax)) n--; },
    update: update,
    carsNear: function (x, y, r, cb) { forNear(x, y, r, cb); },
  };

  // ---------------------------------------------------------------- signals
  function approachGroup(n, bearing) {
    var d = Math.abs(Z.angDiff(bearing, n.axis)) % Math.PI; if (d > Math.PI / 2) d = Math.PI - d;
    return d < Math.PI / 4 ? 0 : 1;
  }
  function sigState(n, grp) { // 0 green 1 amber 2 red
    var t = (time + n.phase) % CYCLE;
    if (grp === 0) return t < 14 ? 0 : t < 17 ? 1 : 2;
    return t < 18.5 ? 2 : t < 32.5 ? 0 : t < 35.5 ? 1 : 2;
  }

  // ---------------------------------------------------------------- car creation
  function makeCar(e, dir, s, lane, opts) {
    opts = opts || {};
    var r = Math.random(), type = 'car', len = Z.rand(4.1, 4.7), wid = 1.8;
    if (!opts.type) {
      if (r < 0.1) { type = 'van'; len = 5.2; wid = 2.0; }
      else if (r < 0.17 && (!e.urban || e.cls <= 1)) { type = 'truck'; len = Z.rand(11, 16); wid = 2.5; }
      else if (r < 0.2 && e.urban && e.cls <= 4) { type = 'bus'; len = 12; wid = 2.5; }
    } else { type = opts.type; len = opts.len || len; wid = opts.wid || wid; }
    var c = {
      id: nextId++, e: e, dir: dir, s: s, lane: lane, lat: M.laneLat(e, lane), latOff: 0, v: opts.v != null ? opts.v : e.speed * 0.8,
      drv: Z.rand(0.86, 1.12) * (type === 'truck' ? 0.78 : type === 'bus' ? 0.85 : 1), len: len, wid: wid, type: type,
      color: type === 'bus' ? '#e8e8e8' : type === 'truck' ? Z.pick(['#e9e9e9', '#2c5aa0', '#b22', '#eee', '#446']) : Z.pick(COLORS),
      mode: 0, turn: null, next: null, x: 0, y: 0, h: 0, rx: 0, ry: 0, rh: 0,
      react: Z.rand(0.3, 1.5), alertT: 0, yielding: 0, relT: 0, distracted: Math.random() < Z.CONFIG.distractedShare,
      bumpT: 0, wreck: false, brake: false, waitT: 0, permit: null, blink: 0, acc: 0, lcT: 0, occEntry: null,
    };
    if (opts.amb) { c.amb = true; c.distracted = false; c.drv = 1.25; c.type = 'amb'; c.len = 5.8; c.wid = 2.2; c.color = '#f5d000'; }
    chooseNext(c);
    place(c); c.rx = c.x; c.ry = c.y; c.rh = c.h;
    cars.push(c);
    return c;
  }
  function removeCar(i) {
    var c = cars[i];
    if (c.occEntry) releaseOcc(c);
    cars[i] = cars[cars.length - 1]; cars.pop();
  }
  function addWreck(e, dir, s, lane, tag) {
    var c = makeCar(e, dir, s, lane, { v: 0 });
    c.wreck = true; c.tag = tag; c.v = 0; c.rh += Z.rand(-0.5, 0.5); c.distracted = false;
    return c;
  }
  function spawnOne(fx, fy, rmin, rmax) {
    var a = Math.random() * Math.PI * 2, d = Z.rand(rmin, rmax);
    var x = fx + Math.cos(a) * d, y = fy + Math.sin(a) * d;
    var r = M.nearestRoad(x, y, 40); if (!r) return false;
    var e = r.e;
    if (e.cls === 6 && Math.random() < 0.55) return false; // fewer cars in residential streets
    var dir = e.oneway ? 1 : (Math.random() < 0.5 ? 1 : -1);
    var s = dir > 0 ? r.s : e.len - r.s;
    if (s < M.clrStart(e, dir) + 3 || s > e.len - M.clrEnd(e, dir) - 3) return false;
    var lane = (Math.random() * e.lanes) | 0;
    var ok = true;
    M.travelPoint(e, dir, s, M.laneLat(e, lane), tmp);
    forNear(tmp.x, tmp.y, 14, function () { ok = false; });
    if (!ok) return false;
    var c = makeCar(e, dir, s, lane);
    addHash(c);
    // queued traffic behind wrecks spawns standing still
    if (e.jamHint) c.v = 0;
    return true;
  }

  // ---------------------------------------------------------------- hashing
  function hkey(i, j) { return i * 65536 + j; }
  function addHash(c) { var k = hkey(Math.floor(c.x / HC), Math.floor(c.y / HC)), a = hash.get(k); if (!a) hash.set(k, a = []); a.push(c); }
  function forNear(x, y, r, cb) {
    var i0 = Math.floor((x - r) / HC), i1 = Math.floor((x + r) / HC), j0 = Math.floor((y - r) / HC), j1 = Math.floor((y + r) / HC);
    for (var i = i0; i <= i1; i++) for (var j = j0; j <= j1; j++) {
      var a = hash.get(hkey(i, j)); if (!a) continue;
      for (var k = 0; k < a.length; k++) { var c = a[k]; if ((c.x - x) * (c.x - x) + (c.y - y) * (c.y - y) < r * r) cb(c); }
    }
  }

  // ---------------------------------------------------------------- routing choices
  function chooseNext(c) {
    var n = M.endNode(c.e, c.dir), opts = n.out, best = null, tot = 0, cand = [];
    var inB = M.arriveBearing(c.e, c.dir);
    for (var k = 0; k < opts.length; k++) {
      var o = opts[k];
      if (o.e === c.e && o.dir === -c.dir && opts.length > 1) continue;
      var outB = M.leaveBearing(o.e, o.dir);
      var turn = Math.abs(Z.angDiff(inB + Math.PI, outB)); // 0 = straight
      if (turn > 2.6 && opts.length > 1) continue;
      var w = Math.pow(7 - o.e.cls, 1.6) * (1.2 + Math.cos(turn)) + 0.15;
      if (c.e.cls === 0 && o.e.cls === 1) w *= 0.35; // most D11 traffic stays on the motorway
      cand.push([o, w]); tot += w;
    }
    if (!cand.length) { c.next = { e: c.e, dir: -c.dir }; return; }
    var r = Math.random() * tot;
    for (k = 0; k < cand.length; k++) { r -= cand[k][1]; if (r <= 0) { best = cand[k][0]; break; } }
    c.next = best || cand[0][0];
    c.nextTurn = Z.angDiff(inB + Math.PI, M.leaveBearing(c.next.e, c.next.dir));
  }

  // ---------------------------------------------------------------- position
  function place(c) {
    if (c.mode === 0) {
      M.travelPoint(c.e, c.dir, c.s, c.lat + c.latOff, tmp);
      c.x = tmp.x; c.y = tmp.y; c.h = Math.atan2(tmp.ty, tmp.tx);
    } else {
      var T = c.turn, u = T.u, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u;
      c.x = a * T.x0 + b * T.x1 + d * T.x2; c.y = a * T.y0 + b * T.y1 + d * T.y2;
      var dx = 2 * (1 - u) * (T.x1 - T.x0) + 2 * u * (T.x2 - T.x1), dy = 2 * (1 - u) * (T.y1 - T.y0) + 2 * u * (T.y2 - T.y1);
      if (dx * dx + dy * dy > 1e-6) c.h = Math.atan2(dy, dx);
    }
  }
  function beginTurn(c) {
    var nx = c.next, n = M.endNode(c.e, c.dir);
    var lane2 = Math.min(nx.e.lanes - 1, c.nextTurn > 0.5 ? nx.e.lanes - 1 : c.nextTurn < -0.5 ? 0 : Math.min(c.lane, nx.e.lanes - 1));
    var lat2 = M.laneLat(nx.e, lane2), s2 = M.clrStart(nx.e, nx.dir);
    M.travelPoint(c.e, c.dir, c.s, c.lat + c.latOff, tmp);
    M.travelPoint(nx.e, nx.dir, s2, lat2, tmp2);
    var x0 = tmp.x, y0 = tmp.y, t1x = tmp.tx, t1y = tmp.ty, x2 = tmp2.x, y2 = tmp2.y, t2x = tmp2.tx, t2y = tmp2.ty;
    var den = t1x * t2y - t1y * t2x, x1, y1, dist = Math.hypot(x2 - x0, y2 - y0);
    if (Math.abs(den) > 0.12) {
      var a = ((x2 - x0) * t2y - (y2 - y0) * t2x) / den;
      var b2 = ((x2 - x0) * t1y - (y2 - y0) * t1x) / den;
      if (a > 0 && b2 > 0 && a < dist * 2 && b2 < dist * 2) { x1 = x0 + t1x * a; y1 = y0 + t1y * a; }
    }
    if (x1 === undefined) { x1 = (x0 + x2) / 2; y1 = (y0 + y2) / 2; }
    var L = Math.max(1, (Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + dist) / 2);
    c.turn = { x0: x0, y0: y0, x1: x1, y1: y1, x2: x2, y2: y2, L: L, u: 0, e2: nx.e, dir2: nx.dir, lane2: lane2, s2: s2, node: n };
    c.mode = 1;
  }
  function endTurn(c) {
    var T = c.turn;
    c.e = T.e2; c.dir = T.dir2; c.s = T.s2; c.lane = T.lane2; c.lat = M.laneLat(c.e, c.lane); c.mode = 0; c.turn = null;
    releaseOcc(c); c.permit = null;
    chooseNext(c);
  }

  // ---------------------------------------------------------------- junction control
  function movementOf(c) {
    return { inA: M.arriveBearing(c.e, c.dir) - 0.15, outA: M.leaveBearing(c.next.e, c.next.dir) + 0.15, out: c.next.e.i * 2 + (c.next.dir > 0 ? 0 : 1), major: isMajor(c) };
  }
  function isMajor(c) {
    var n = M.endNode(c.e, c.dir);
    if (n.rb) return !!c.e.rb;
    return c.e.cls === n.best && n.nBest >= 2 && c.next.e.cls === n.best;
  }
  function between(a, x, b) { // is angle x strictly inside the ccw arc a->b
    var ab = (b - a + 4 * Math.PI) % (2 * Math.PI), ax = (x - a + 4 * Math.PI) % (2 * Math.PI);
    return ax > 0.01 && ax < ab - 0.01;
  }
  // Movements are chords on a circle round the junction. With right-hand traffic the
  // arriving lane of an arm sits at (bearing - d), the leaving lane at (bearing + d)
  // (y-down angles). Two movements conflict if they share an exit or their chords cross.
  function conflict(m1, m2) {
    if (m1.out === m2.out) return true;
    if (Math.abs(Z.angDiff(m1.inA, m2.inA)) < 0.05) return false;
    return between(m1.inA, m2.inA, m1.outA) !== between(m1.inA, m2.outA, m1.outA);
  }
  function releaseOcc(c) {
    if (!c.occEntry) return;
    var n = c.occEntry.node, i = n.occ.indexOf(c.occEntry); if (i >= 0) n.occ.splice(i, 1);
    c.occEntry = null;
  }
  function requestPermit(c, n, m) {
    if (c.amb) return true;
    if (n.emergency > time - 0.15) return false;
    if (n.sig) {
      var st = sigState(n, approachGroup(n, m.inA + 0.15));
      if (st === 2 || (st === 1 && c.v > 0 && distToStop(c) > c.v * 0.8)) return false;
    }
    var k;
    for (k = 0; k < n.occ.length; k++) { var o = n.occ[k]; if (o.car !== c && conflict(m, o.m)) return false; }
    if (!n.sig) {
      var ap = n.apprPrev || [];
      for (k = 0; k < ap.length; k++) {
        var a = ap[k]; if (a.car === c || a.car.permit === n) continue;
        if (!conflict(m, a.m)) continue;
        if (a.m.major && !m.major && a.eta < 3.2) return false;
        if (a.m.major === m.major && a.stopped && a.car.waitT > c.waitT + 0.3) return false; // fairness
      }
    }
    // exit space: don't block the junction
    var list = byEdge.get(c.next.e.i * 2 + (c.next.dir > 0 ? 0 : 1));
    if (list) for (k = 0; k < list.length; k++) if (list[k].s < M.clrStart(c.next.e, c.next.dir) + list[k].len + 2 && list[k].v < 2 && list[k].mode === 0) return false;
    return true;
  }
  function distToStop(c) { return c.e.len - M.clrEnd(c.e, c.dir) - c.s; }

  // ---------------------------------------------------------------- IDM
  function idm(v, v0, gap, vL, T, A) {
    var a = A * (1 - Math.pow(Math.max(0, v) / Math.max(0.1, v0), 4));
    if (gap < 1e8) {
      var ss = 2.2 + Math.max(0, v * T + v * (v - vL) / (2 * Math.sqrt(A * 3)));
      a -= A * (ss / Math.max(gap, 0.2)) * (ss / Math.max(gap, 0.2));
    }
    return a < -9 ? -9 : a;
  }

  // ---------------------------------------------------------------- main update
  // em: the emergency vehicle {x,y,vx,vy,h,siren,hornT,len,wid,range} (player or demo)
  function update(dt, em, focus, opts) {
    time += dt;
    opts = opts || {};
    // spawn / despawn around focus
    var R = Z.CONFIG.trafficRadius, target = Math.round(Z.CONFIG.trafficBase * Z.traffic.density);
    for (var i = cars.length - 1; i >= 0; i--) {
      var c = cars[i];
      if (c.amb) continue;
      var d2 = (c.x - focus.x) * (c.x - focus.x) + (c.y - focus.y) * (c.y - focus.y);
      if (d2 > (R + 80) * (R + 80) && !c.wreck) removeCar(i);
    }
    // rebuild hash & per-edge lists
    hash.clear(); byEdge.clear();
    for (i = 0; i < cars.length; i++) {
      c = cars[i]; addHash(c);
      if (c.mode === 0) { var k = c.e.i * 2 + (c.dir > 0 ? 0 : 1), l = byEdge.get(k); if (!l) byEdge.set(k, l = []); l.push(c); }
    }
    var spawnN = Math.min(4, target - cars.length);
    for (i = 0; i < spawnN * 3 && spawnN > 0; i++) if (spawnOne(focus.x, focus.y, opts.initial ? 25 : 210, R)) spawnN--;
    // node approach double-buffering
    for (i = 0; i < activeNodes.length; i++) { var n = activeNodes[i]; n.apprPrev = n.appr; n.appr = []; n.active = false; }
    activeNodes.length = 0;
    // emergency flags on junctions ahead of the siren
    if (em && em.siren) {
      var sp = Math.hypot(em.vx, em.vy);
      for (i = 0; i < M.nodes.length; i++) {
        n = M.nodes[i]; if (n.deg < 3) continue;
        var dx = n.x - em.x, dy = n.y - em.y, dd = dx * dx + dy * dy;
        if (dd > 90 * 90) continue;
        if (dd < 20 * 20 || (sp > 2 && dx * em.vx + dy * em.vy > 0)) n.emergency = time;
      }
    }
    // per-car update
    var ehx = em ? Math.cos(em.h) : 0, ehy = em ? Math.sin(em.h) : 0;
    for (i = 0; i < cars.length; i++) stepCar(cars[i], dt, em, ehx, ehy);
    // congestion estimate for routing (stopped cars per edge)
    if ((time * 2 | 0) !== ((time - dt) * 2 | 0)) {
      for (i = 0; i < M.edges.length; i++) M.edges[i].jam *= 0.5;
      for (i = 0; i < cars.length; i++) if (cars[i].v < 1.5 && cars[i].mode === 0 && !cars[i].yielding) cars[i].e.jam += 0.5;
    }
  }

  function stepCar(c, dt, em, ehx, ehy) {
    if (c.wreck) { c.v = 0; c.blink += dt; smooth(c, dt); return; }
    var hx = Math.cos(c.h), hy = Math.sin(c.h);
    if (c.bumpT > 0) { c.bumpT -= dt; c.v = Math.max(0, c.v - 12 * dt); c.brake = true; smooth(c, dt); return; }
    // ---------------- siren awareness
    var yieldKind = 0; // 1 pull over, 2 corridor, 3 oncoming, 4 creep at red
    var emDist = 1e9, emBehind = false;
    if (em && !c.amb) {
      var dx = c.x - em.x, dy = c.y - em.y; emDist = Math.hypot(dx, dy);
      if (em.hornT > 0 && emDist < 50 && dx * ehx + dy * ehy > 0) { if (c.distracted) { c.distracted = false; c.react = 0.35; c.alertT = 0; } }
      if (em.siren && emDist < em.range && !c.distracted) {
        var fwdOfEm = dx * ehx + dy * ehy;          // car ahead of the ambulance?
        var same = hx * ehx + hy * ehy;             // heading alignment
        var ahead = (em.x - c.x) * hx + (em.y - c.y) * hy; // ambulance ahead of car?
        var lat = Math.abs(-(em.x - c.x) * hy + (em.y - c.y) * hx);
        if (fwdOfEm > -6 && same > 0.3) { yieldKind = c.e.lanes >= 2 && c.mode === 0 ? 2 : 1; emBehind = true; }
        else if (ahead > 0 && same < -0.5 && lat < 10 && !c.e.oneway && c.e.lanes === 1) yieldKind = 3;
        else if (c.e.oneway && same < 0.3) yieldKind = 0; // other carriageway: ignore
      }
    }
    if (yieldKind) { c.alertT += dt; c.relT = 0; }
    else if (c.yielding) { c.relT += dt; if (c.relT > 1.0) { c.yielding = 0; c.alertT = 0; } }
    else c.alertT = Math.max(0, c.alertT - dt);
    if (yieldKind && c.alertT >= c.react) c.yielding = yieldKind;
    // ---------------- desired speed & lateral target
    var e = c.e, v0 = e.speed * c.drv, latTarget = 0;
    if (c.amb) v0 = Math.max(v0, e.speed * 1.3);
    if (c.mode === 1) {
      var ang = Math.abs(c.nextTurn || 0), R = c.turn.L / Math.max(0.2, ang);
      v0 = Math.min(v0, Math.max(4.5, Math.sqrt(3.4 * R)));
    }
    if (c.yielding === 1) { latTarget = 1.8; v0 = emDist < 70 ? 0 : 3; }
    else if (c.yielding === 2) { latTarget = c.lane === 0 ? -1.45 : 1.45; v0 = emDist < 45 ? 0 : Math.min(v0, 5); }
    else if (c.yielding === 3) { latTarget = 1.3; v0 = Math.min(v0, 3); }
    // ---------------- obstacles
    var gap = 1e9, vL = 0, T = e.cls <= 1 ? 1.0 : 1.3; c.why = ''; c.whyO = null;
    // same edge leader
    if (c.mode === 0) {
      var list = byEdge.get(e.i * 2 + (c.dir > 0 ? 0 : 1));
      var myLat = c.lat, firstInQueue = true;
      if (list) for (var k = 0; k < list.length; k++) {
        var o = list[k]; if (o === c || o.s <= c.s) continue;
        if (Math.abs(o.lat - myLat) > 2.1 && Math.abs(o.lat + o.latOff - (myLat + c.latOff)) > 2.1) continue;
        firstInQueue = false;
        var g = o.s - c.s - (o.len + c.len) / 2;
        if (g < gap) { gap = g; vL = o.v; c.why = 'lead'; }
      }
      // upcoming node: stop line / curve speed / next edge leader
      var dStop = distToStop(c);
      if (dStop < 60) {
        var n = M.endNode(e, c.dir);
        var mv = null;
        if (c.permit === n && c.v < 0.3) { c.permitT = (c.permitT || 0) + dt; if (c.permitT > 4) { releaseOcc(c); c.permit = null; } }
        if (n.deg >= 3 && c.permit !== n) {
          mv = movementOf(c);
          if (!n.active) { n.active = true; activeNodes.push(n); }
          n.appr.push({ car: c, m: mv, eta: dStop / Math.max(1, c.v), stopped: c.v < 0.5 && dStop < 3 });
          if (firstInQueue && dStop < Math.max(10, c.v * 1.6)) {
            if (requestPermit(c, n, mv)) {
              c.permit = n; c.permitT = 0; c.occEntry = { car: c, m: mv, node: n }; n.occ.push(c.occEntry);
            }
          }
          if (c.permit !== n) {
            // creeping forward at a red light to let the ambulance through
            var creep = em && em.siren && emBehind && emDist < 35 && c.yielding && dStop < 6;
            var stopGap = dStop + (creep ? 3.5 : 0) + 0.5;
            if (creep) latTarget = 1.8;
            if (stopGap < gap) { gap = stopGap; vL = 0; c.why = 'stop'; }
            if (c.v < 0.5) c.waitT += dt; else c.waitT = 0;
          }
        }
        // slow down for the turn curve
        var tang = Math.abs(c.nextTurn || 0);
        if (tang > 0.35) { var vturn = Math.max(4.5, Math.sqrt(3.4 * Math.max(4, n.r * 1.4) / tang * 1.3)); var vAllowed = Math.sqrt(vturn * vturn + 2 * 2.5 * Math.max(0, dStop)); v0 = Math.min(v0, vAllowed); }
        // leader on the next edge
        var l2 = byEdge.get(c.next.e.i * 2 + (c.next.dir > 0 ? 0 : 1));
        if (l2) for (k = 0; k < l2.length; k++) {
          var o2 = l2[k]; var g2 = dStop + M.clrEnd(e, c.dir) + o2.s - (o2.len + c.len) / 2;
          if (g2 < gap && g2 < 70) { gap = g2; vL = o2.v; c.why = 'next'; }
        }
      }
    }
    // geometric check (turning cars, other edges, the ambulance)
    // (only cars inside junctions, or on our target edge while we turn; cars waiting at
    // other stop lines are never in our way and would otherwise cause gridlock)
    forNear(c.x + hx * 12, c.y + hy * 12, 16, function (o) {
      if (o === c) return;
      if (o.mode === 0) { if (c.mode === 0 || o.e !== c.turn.e2 || o.dir !== c.turn.dir2) return; }
      var rx = o.x - c.x, ry = o.y - c.y, f = rx * hx + ry * hy; if (f <= 0) return;
      var lt = Math.abs(-rx * hy + ry * hx); if (lt > (o.wid + c.wid) / 2 + 0.3) return;
      var oh = Math.cos(o.h) * hx + Math.sin(o.h) * hy;
      var g3 = f - (o.len + c.len) / 2;
      if (g3 < gap) { gap = g3; vL = o.v * oh; c.why = 'geo'; c.whyO = o; }
    });
    if (em && !c.amb) {
      var rx = em.x - c.x, ry = em.y - c.y, f = rx * hx + ry * hy;
      if (f > 0 && f < 45) {
        var lt = Math.abs(-rx * hy + ry * hx);
        if (lt < (em.wid + c.wid) / 2 + 0.6) { var g4 = f - (em.len + c.len) / 2; if (g4 < gap) { gap = g4; vL = em.vx * hx + em.vy * hy; } }
      }
    }
    // ---------------- lane changes (overtaking / keep right)
    c.lcT -= dt;
    if (c.mode === 0 && e.lanes >= 2 && !c.yielding && c.lcT <= 0 && !c.amb) {
      if (gap < 35 && vL < v0 - 3 && c.lane > 0 && laneFree(c, c.lane - 1)) { c.lane--; c.lcT = 4; c.blink = 1.5; }
      else if (c.lane < e.lanes - 1 && gap > 60 && laneFree(c, c.lane + 1)) { c.lane++; c.lcT = 5; c.blink = 1.5; }
    }
    // ---------------- integrate
    var A = c.type === 'truck' ? 1.0 : c.type === 'bus' ? 1.2 : 1.9;
    var acc = idm(c.v, Math.max(0.1, v0), gap, vL, T, A);
    if (gap < 0.3) { c.v = 0; acc = 0; }
    c.v = Math.max(0, c.v + acc * dt);
    c.acc = acc; c.brake = acc < -1.2 || (c.v < 0.3 && gap < 5);
    // lateral: lane centre + yield offset
    var laneLat = M.laneLat(e, c.lane);
    c.lat += Z.clamp(laneLat - c.lat, -1.3 * dt, 1.3 * dt);
    c.latOff += Z.clamp(latTarget - c.latOff, -1.4 * dt, 1.4 * dt);
    if (c.blink > 0) c.blink -= dt;
    // advance
    if (c.mode === 0) {
      c.s += c.v * dt;
      var endS = e.len - M.clrEnd(e, c.dir);
      if (c.s >= endS) {
        c.s = endS;
        var nn = M.endNode(e, c.dir);
        if (nn.deg < 3 || c.permit === nn) beginTurn(c);
      }
    } else {
      c.turn.u += c.v * dt / c.turn.L;
      if (c.turn.u >= 1) endTurn(c);
    }
    place(c);
    smooth(c, dt);
  }
  function laneFree(c, lane) {
    var list = byEdge.get(c.e.i * 2 + (c.dir > 0 ? 0 : 1)), lat = M.laneLat(c.e, lane);
    if (!list) return true;
    for (var k = 0; k < list.length; k++) {
      var o = list[k]; if (o === c) continue;
      if (Math.abs(o.lat - lat) > 1.6) continue;
      var d = o.s - c.s; if (d > -18 - c.v * 0.6 && d < 25) return false;
    }
    return c.s < c.e.len - M.clrEnd(c.e, c.dir) - 25;
  }
  function smooth(c, dt) {
    var k = Math.min(1, dt * 10);
    c.rx += (c.x - c.rx) * k; c.ry += (c.y - c.ry) * k; c.rh += Z.angDiff(c.rh, c.h) * k;
  }

  // ---------------------------------------------------------------- ambulance vs cars
  var pc = [], cc = [], axs = new Float32Array(8), mtv = {};
  Z.traffic.collidePlayer = function (P) {
    forNear(P.x, P.y, 12, function (c) {
      Z.obbCorners(P.x, P.y, P.stats.len / 2, P.stats.wid / 2, Math.cos(P.h), Math.sin(P.h), pc);
      Z.obbCorners(c.rx, c.ry, c.len / 2, c.wid / 2, Math.cos(c.rh), Math.sin(c.rh), cc);
      axs[0] = Math.cos(P.h); axs[1] = Math.sin(P.h); axs[2] = -axs[1]; axs[3] = axs[0];
      axs[4] = Math.cos(c.rh); axs[5] = Math.sin(c.rh); axs[6] = -axs[5]; axs[7] = axs[4];
      if (!Z.sat(pc, cc, axs, mtv)) return;
      if ((P.x - c.rx) * mtv.x + (P.y - c.ry) * mtv.y < 0) { mtv.x = -mtv.x; mtv.y = -mtv.y; }
      P.x += mtv.x * (mtv.d + 0.02); P.y += mtv.y * (mtv.d + 0.02);
      var cvx = Math.cos(c.h) * c.v, cvy = Math.sin(c.h) * c.v;
      var vn = (P.vx - cvx) * mtv.x + (P.vy - cvy) * mtv.y;
      if (vn < 0) {
        P.impact(-vn, mtv.x, mtv.y);
        P.vx -= 1.3 * vn * mtv.x; P.vy -= 1.3 * vn * mtv.y; P.vx *= 0.8; P.vy *= 0.8;
        if (!c.wreck) { c.bumpT = 2.5; c.v = 0; }
      }
    });
  };
})();
