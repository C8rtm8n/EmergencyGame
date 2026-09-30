// ============================================================================
//  world.js — level simulation (pure logic, no drawing, no audio).
//  The same code runs in the browser and in tools/solve.js (Node) which
//  brute-forces every level to verify it is beatable and to suggest star limits.
//
//  Hero states:  idle (standing) | cling (on a trunk) | swing (on a vine)
//                fly | dead | win
//  Everything the renderer / audio needs to know is pushed to `world.events`.
// ============================================================================
'use strict';
(function () {
  var P = Z.P;

  function World(lv, opts) {
    this.lv = lv;
    this.opts = opts || {};
    this.w = lv.w; this.h = lv.h;
    this.build();
    this.reset();
  }
  var W = World.prototype;

  // ---------------------------------------------------------------- build
  // Level JSON uses compact arrays; expand them into objects.
  W.build = function () {
    var lv = this.lv, noActors = this.opts.noActors;
    function m(arr, f) { return (arr || []).map(f); }
    this.solids = m(lv.solids, function (a) { return { k: 'solid', x: a[0], y: a[1], w: a[2], h: a[3], t: a[4] || 'sand' }; });
    this.branches = m(lv.branches, function (a) { return { k: 'branch', x: a[0], y: a[1], w: a[2], rot: !!a[3], st: 0, tm: 0, dy: 0, vy: 0 }; });
    this.trunks = m(lv.trunks, function (a) { return { k: 'trunk', x: a[0], y: a[1], h: a[2], w: a[3] || 8, t: a[4] || 'tree' }; });
    this.vines = m(lv.vines, function (a) { return { k: 'vine', ax: a[0], ay: a[1], len: a[2], ang: 0, av: 0, ph: a[0] * 0.37, held: false }; });
    this.bouncers = m(lv.bouncers, function (a) { return { k: 'bouncer', x: a[0], y: a[1], w: a[2], t: a[3] || 'mush', p: a[4] || 320, sq: 0 }; });
    this.winds = m(lv.winds, function (a) { return { k: 'wind', x: a[0], y: a[1], w: a[2], h: a[3], fx: a[4], fy: a[5], t: a[6] || 'air' }; });
    this.hazards = m(lv.hazards, function (a) { return { k: 'hazard', x: a[0], y: a[1], w: a[2], h: a[3], t: a[4] || 'water' }; });
    this.plants = m(lv.plants, function (a) { return { k: 'plant', x: a[0], y: a[1], ph: a[0] * 0.13 }; });
    this.walkers = noActors ? [] : m(lv.walkers, function (a) { return { k: 'walker', x0: a[0], x1: a[1], y: a[2], t: a[3] || 'crab', sp: a[4] || 14, x: a[0], dir: 1 }; });
    this.crocs = m(lv.crocs, function (a) { return { k: 'croc', x: a[0], y: a[1], w: 24, tm: a[2] || 0, open: false }; });
    this.monkeys = noActors ? [] : m(lv.monkeys, function (a) { return { k: 'monkey', x: a[0], y: a[1], iv: a[2] || 2.6, cd: 1.5, thr: 0 }; });
    this.checkpoints = m(lv.checkpoints, function (a) { return { k: 'cp', x: a[0], y: a[1], lit: false }; });
    this.items = m(lv.items, function (a) { return { k: 'item', x: a[0], y: a[1], t: a[2], id: a[3], got: false }; });
    this.goal = { x: lv.goal[0], y: lv.goal[1] };
  };

  // Full restart of the level.
  W.reset = function () {
    var lv = this.lv;
    this.time = 0;
    this.jumps = lv.jumps;
    this.won = false;
    this.events = [];
    this.cp = { x: lv.start[0], y: lv.start[1] };
    this.checkpoints.forEach(function (c) { c.lit = false; });
    this.items.forEach(function (i) { i.got = false; });
    this.respawn();
  };

  // Back to the last checkpoint (hazard hit). Jumps are NOT refunded.
  W.respawn = function () {
    this.hero = { x: this.cp.x, y: this.cp.y, vx: 0, vy: 0, st: 'idle', on: null, face: 1,
      grace: 0, graceObj: null, swing: null, dead: 0, air: 0, maxH: 0, kind: '' };
    this.branches.forEach(function (b) { b.st = 0; b.tm = 0; b.dy = 0; b.vy = 0; });
    this.vines.forEach(function (v) { v.ang = 0; v.av = 0; v.held = false; });
    this.nuts = [];
    this.hero.on = this.supportAt(this.hero.x, this.hero.y);
  };

  W.ev = function (t, data) { var e = data || {}; e.t = t; this.events.push(e); };

  // Support object directly under feet (used at respawn).
  W.supportAt = function (x, y) {
    var i, s;
    for (i = 0; i < this.solids.length; i++) { s = this.solids[i]; if (Math.abs(s.y - y) < 2 && x > s.x - 3 && x < s.x + s.w + 3) return s; }
    for (i = 0; i < this.branches.length; i++) { s = this.branches[i]; if (Math.abs(s.y - y) < 2 && x > s.x && x < s.x + s.w) return s; }
    return null;
  };

  // ---------------------------------------------------------------- launching
  W.canLaunch = function () {
    var s = this.hero.st;
    return !this.won && this.jumps > 0 && (s === 'idle' || s === 'cling' || s === 'swing');
  };
  // Hands position while swinging.
  W.handPos = function () {
    var h = this.hero, v = h.swing.v, r = h.swing.r;
    return { x: v.ax + Math.sin(v.ang) * r, y: v.ay + Math.cos(v.ang) * r };
  };
  // Where a launch starts from (feet).
  W.launchOrigin = function () {
    var h = this.hero;
    if (h.st === 'swing') { var hp = this.handPos(); return { x: hp.x, y: hp.y + P.handUp }; }
    return { x: h.x, y: h.y };
  };
  // Final launch velocity for a drag velocity (vine momentum is added).
  W.launchVel = function (vx, vy) {
    var h = this.hero;
    if (h.st === 'swing') {
      var v = h.swing.v, r = h.swing.r, sp = v.av * r;
      var ox = Math.cos(v.ang) * sp, oy = -Math.sin(v.ang) * sp;
      var rx = ox + vx * P.swingMix, ry = oy + vy * P.swingMix, l = Math.sqrt(rx * rx + ry * ry);
      if (l > P.vmaxSwing) { rx *= P.vmaxSwing / l; ry *= P.vmaxSwing / l; }
      return { x: rx, y: ry };
    }
    return { x: vx, y: vy };
  };
  // A ground jump has to go up, otherwise it is refused (no banana lost).
  W.validLaunch = function (vx, vy) {
    var h = this.hero, v = this.launchVel(vx, vy);
    if (h.st === 'idle' && v.y > -12) return false;
    return true;
  };
  W.launch = function (vx, vy) {
    if (!this.canLaunch() || !this.validLaunch(vx, vy)) return false;
    var h = this.hero, v = this.launchVel(vx, vy);
    if (h.st === 'swing') {
      var o = this.launchOrigin();
      h.x = o.x; h.y = o.y;
      h.graceObj = h.swing.v; h.grace = 0.35;
      h.swing.v.held = false; h.swing.v.av *= 0.6; h.swing = null;
    } else if (h.st === 'cling') {
      h.graceObj = h.on; h.grace = 0.22;
    }
    h.vx = v.x; h.vy = v.y; h.st = 'fly'; h.on = null; h.air = 0; h.maxH = 0;
    h.startY = h.y; h.face = v.x >= 0 ? 1 : -1;
    this.jumps--;
    this.ev('launch', { power: Math.sqrt(v.x * v.x + v.y * v.y) / P.vmax });
    return true;
  };

  // Trajectory preview (ghost point, gravity + wind, stops at solids).
  W.predict = function (vx, vy, time, step) {
    var o = this.launchOrigin(), v = this.launchVel(vx, vy), pts = [];
    var x = o.x, y = o.y - 8, dx = v.x, dy = v.y, t = 0, dt = 1 / 120, next = 0;
    step = step || 0.035;
    while (t < time) {
      dy += P.g * dt;
      for (var i = 0; i < this.winds.length; i++) { var wd = this.winds[i]; if (x > wd.x && x < wd.x + wd.w && y > wd.y && y < wd.y + wd.h) { dx += wd.fx * dt; dy += wd.fy * dt; } }
      x += dx * dt; y += dy * dt; t += dt;
      if (this.solidAtPoint(x, y)) break;
      if (t >= next) { pts.push({ x: x, y: y, t: t / time }); next += step; }
    }
    return pts;
  };
  W.solidAtPoint = function (x, y) {
    for (var i = 0; i < this.solids.length; i++) { var s = this.solids[i]; if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return true; }
    return false;
  };

  // ---------------------------------------------------------------- step
  W.step = function (dt) {
    this.time += dt;
    var h = this.hero;
    if (h.grace > 0) { h.grace -= dt; if (h.grace <= 0) h.graceObj = null; }
    this.stepProps(dt);
    switch (h.st) {
      case 'fly': this.stepFly(dt); break;
      case 'swing': this.stepSwing(dt); break;
      case 'idle':
        if (h.on && h.on.k === 'branch' && h.on.st === 2) { h.st = 'fly'; h.vy = 0; h.vx = 0; h.on = null; h.startY = h.y; h.maxH = 0; }
        else if (h.on && h.on.k === 'croc' && h.on.open) this.kill('croc');
        else if (h.on && h.on.k === 'croc') h.y = h.on.y - 3;
        break;
      case 'dead':
        h.dead += dt;
        if (h.kind === 'water' || h.kind === 'lava' || h.kind === 'croc') { h.y += 14 * dt; }
        else { h.vy += P.g * dt; h.y += h.vy * dt; }
        if (h.dead > 1.25) { this.respawn(); this.ev('respawn'); }
        return;
      case 'win': return;
    }
    if (h.st !== 'dead' && !this.won) this.touches();
  };

  // Moving/animated props: vines, rotten branches, bouncers, actors.
  W.stepProps = function (dt) {
    var i, t = this.time, h = this.hero;
    for (i = 0; i < this.vines.length; i++) {
      var v = this.vines[i];
      if (v.held) continue;
      // free vine: pendulum with strong damping plus a light breeze
      v.av += (-P.g / (v.len * 0.8) * Math.sin(v.ang) + Math.sin(t * 0.9 + v.ph) * 0.35) * dt;
      v.av *= (1 - 1.2 * dt);
      v.ang += v.av * dt;
    }
    for (i = 0; i < this.branches.length; i++) {
      var b = this.branches[i];
      if (b.st === 1) { b.tm += dt; if (b.tm > 0.6) { b.st = 2; b.vy = 0; this.ev('break', { x: b.x + b.w / 2, y: b.y }); } }
      else if (b.st === 2 && b.dy < 400) { b.vy += P.g * dt; b.dy += b.vy * dt; }
    }
    for (i = 0; i < this.bouncers.length; i++) this.bouncers[i].sq *= Math.pow(0.02, dt);
    for (i = 0; i < this.walkers.length; i++) {
      var wk = this.walkers[i];
      wk.x += wk.dir * wk.sp * dt;
      if (wk.x > wk.x1) { wk.x = wk.x1; wk.dir = -1; } else if (wk.x < wk.x0) { wk.x = wk.x0; wk.dir = 1; }
    }
    for (i = 0; i < this.crocs.length; i++) {
      var c = this.crocs[i]; c.tm += dt;
      var was = c.open; c.open = (c.tm % 3.2) > 2.2;
      if (c.open && !was) this.ev('snap', { x: c.x, y: c.y });
    }
    // monkeys throw coconuts at the hero
    for (i = 0; i < this.monkeys.length; i++) {
      var mk = this.monkeys[i];
      if (mk.thr > 0) mk.thr -= dt;
      mk.cd -= dt;
      var dx = h.x - mk.x, dy = (h.y - 8) - (mk.y - 10);
      if (mk.cd <= 0 && Math.abs(dx) < 230 && Math.abs(dy) < 160 && h.st !== 'dead' && !this.won) {
        mk.cd = mk.iv; mk.thr = 0.35; mk.face = dx >= 0 ? 1 : -1;
        var T = Z.clamp(Math.sqrt(dx * dx + dy * dy) / 150, 0.55, 1.35);
        this.nuts.push({ x: mk.x, y: mk.y - 12, vx: dx / T, vy: dy / T - 0.5 * P.g * T, r: 0 });
        this.ev('throw', { x: mk.x, y: mk.y });
      }
    }
    for (i = this.nuts.length - 1; i >= 0; i--) {
      var n = this.nuts[i];
      n.vy += P.g * dt; n.x += n.vx * dt; n.y += n.vy * dt; n.r += dt * 10;
      if (this.solidAtPoint(n.x, n.y) || n.y > this.h + 20) { this.nuts.splice(i, 1); this.ev('nut', { x: n.x, y: n.y }); }
    }
  };

  // ---------------------------------------------------------------- flying
  W.stepFly = function (dt) {
    var h = this.hero, hw = P.heroW / 2, hh = P.heroH, i, s;
    h.air += dt;
    h.vy += P.g * dt;
    for (i = 0; i < this.winds.length; i++) {
      var wd = this.winds[i];
      if (Z.overlap(h.x - hw, h.y - hh, hw * 2, hh, wd.x, wd.y, wd.w, wd.h)) { h.vx += wd.fx * dt; h.vy += wd.fy * dt; }
    }
    if (h.vy > P.maxFall) h.vy = P.maxFall;
    h.maxH = Math.max(h.maxH, (h.startY || h.y) - h.y);

    // --- horizontal move + walls
    var nx = h.x + h.vx * dt;
    for (i = 0; i < this.solids.length; i++) {
      s = this.solids[i];
      if (nx + hw > s.x && nx - hw < s.x + s.w && h.y > s.y + 0.01 && h.y - hh < s.y + s.h) {
        nx = h.vx > 0 ? s.x - hw : s.x + s.w + hw;
        if (Math.abs(h.vx) > 30) this.ev('bump', { x: nx, y: h.y - 8 });
        h.vx = -h.vx * 0.3;
      }
    }
    if (nx < hw) { nx = hw; h.vx = Math.abs(h.vx) * 0.3; }
    if (nx > this.w - hw) { nx = this.w - hw; h.vx = -Math.abs(h.vx) * 0.3; }
    h.x = nx;

    // --- trunks: land on top or cling to the side
    for (i = 0; i < this.trunks.length; i++) {
      var tr = this.trunks[i];
      if (h.graceObj === tr) continue;
      if (Z.overlap(h.x - hw, h.y - hh, hw * 2, hh, tr.x, tr.y, tr.w, tr.h)) {
        if (h.y <= tr.y + 5 && h.vy >= 0) { this.land(tr, tr.y); return; }
        var side = (h.x < tr.x + tr.w / 2) ? -1 : 1;
        h.st = 'cling'; h.on = tr; h.vx = 0; h.vy = 0; h.face = -side;
        h.x = side < 0 ? tr.x - 5 : tr.x + tr.w + 5;
        h.y = Z.clamp(h.y, tr.y + 8, tr.y + tr.h);
        this.ev('cling', { x: h.x, y: h.y });
        return;
      }
    }

    // --- vertical move
    var py = h.y, ny = h.y + h.vy * dt;
    if (h.vy >= 0) {
      var best = null, bestY = 1e9, fx0 = h.x - hw, fx1 = h.x + hw;
      for (i = 0; i < this.solids.length; i++) {
        s = this.solids[i];
        if (py <= s.y + 0.01 && ny >= s.y && fx1 > s.x && fx0 < s.x + s.w && s.y < bestY) { best = s; bestY = s.y; }
      }
      for (i = 0; i < this.branches.length; i++) {
        s = this.branches[i];
        if (s.st === 2) continue;
        if (py <= s.y + 0.01 && ny >= s.y && h.x + 2 > s.x && h.x - 2 < s.x + s.w && s.y < bestY) { best = s; bestY = s.y; }
      }
      for (i = 0; i < this.bouncers.length; i++) {
        s = this.bouncers[i];
        if (py <= s.y + 0.01 && ny >= s.y && h.x + 3 > s.x && h.x - 3 < s.x + s.w && s.y < bestY) { best = s; bestY = s.y; }
      }
      for (i = 0; i < this.crocs.length; i++) {
        s = this.crocs[i]; var cy = s.y - 3;
        if (py <= cy + 0.01 && ny >= cy && h.x + 2 > s.x && h.x - 2 < s.x + s.w && cy < bestY) { best = s; bestY = cy; }
      }
      if (best) {
        if (best.k === 'bouncer') {
          h.y = bestY; h.vy = -Math.max(best.p, h.vy * 0.85); best.sq = 1;
          h.startY = h.y; h.maxH = 0;
          this.ev('bounce', { x: h.x, y: h.y, t: best.t });
        } else this.land(best, bestY);
      } else h.y = ny;
    } else {
      for (i = 0; i < this.solids.length; i++) {
        s = this.solids[i];
        var top = s.y + s.h;
        if (py - hh >= top - 0.01 && ny - hh < top && h.x + hw > s.x && h.x - hw < s.x + s.w) {
          ny = top + hh; h.vy = 0; this.ev('bump', { x: h.x, y: top });
        }
      }
      h.y = ny;
    }
    if (h.st === 'fly') this.checkVines();
    if (h.y > this.h + 30) this.kill('fall');
  };

  W.land = function (obj, y) {
    var h = this.hero, speed = h.vy;
    h.y = y; h.vx = 0; h.vy = 0; h.on = obj;
    h.st = this.won ? 'win' : 'idle';
    this.ev('land', { x: h.x, y: y, kind: obj.k, t: obj.t, speed: speed, maxH: h.maxH });
    if (obj.k === 'branch' && obj.rot && obj.st === 0) { obj.st = 1; obj.tm = 0; this.ev('crack', { x: h.x, y: y }); }
    if (obj.k === 'croc' && obj.open) this.kill('croc');
  };

  // ---------------------------------------------------------------- vines
  W.checkVines = function () {
    var h = this.hero;
    for (var i = 0; i < this.vines.length; i++) {
      var v = this.vines[i];
      if (h.graceObj === v) continue;
      var sx = Math.sin(v.ang), cy = Math.cos(v.ang);
      // test hands and chest against the rope segment
      for (var k = 0; k < 2; k++) {
        var px = h.x, py = h.y - (k ? 10 : P.handUp - 2);
        var dx = px - v.ax, dy = py - v.ay;
        var along = dx * sx + dy * cy, perp = dx * cy - dy * sx;
        if (along > 6 && along < v.len + 3 && Math.abs(perp) < 5.5) {
          var r = Z.clamp(along, 12, v.len);
          h.st = 'swing'; h.swing = { v: v, r: r }; v.held = true;
          v.av = Z.clamp((h.vx * cy - h.vy * sx) / r, -4.5, 4.5);
          h.vx = 0; h.vy = 0;
          this.stepSwing(0);
          this.ev('vine', { x: h.x, y: h.y });
          return;
        }
      }
    }
  };
  W.stepSwing = function (dt) {
    var h = this.hero, v = h.swing.v, r = h.swing.r;
    v.av += (-P.g / (r + 8) * Math.sin(v.ang)) * dt;
    v.av *= (1 - 0.12 * dt);
    v.ang += v.av * dt;
    if (v.ang > 2.3) { v.ang = 2.3; v.av = -Math.abs(v.av) * 0.3; }
    if (v.ang < -2.3) { v.ang = -2.3; v.av = Math.abs(v.av) * 0.3; }
    var hp = this.handPos();
    h.x = hp.x + Math.sin(v.ang) * P.handUp;
    h.y = hp.y + Math.cos(v.ang) * P.handUp;
    if (Math.abs(v.av) > 0.2) h.face = v.av > 0 ? 1 : -1;
  };

  // ---------------------------------------------------------------- touches
  W.touches = function () {
    var h = this.hero, i, bx = h.x - 3, by = h.y - 13, bw = 6, bh = 12;
    if (h.st === 'swing') { var hp = this.handPos(); bx = (hp.x + h.x) / 2 - 3; by = (hp.y + h.y) / 2 - 6; }
    for (i = 0; i < this.hazards.length; i++) {
      var z = this.hazards[i];
      if (Z.overlap(bx, by, bw, bh, z.x, z.y + (z.t === 'water' || z.t === 'lava' ? 3 : 1), z.w, z.h)) { this.kill(z.t); return; }
    }
    for (i = 0; i < this.plants.length; i++) {
      var p = this.plants[i];
      if (Z.overlap(bx, by, bw, bh, p.x - 5, p.y - 20, 10, 12)) { this.kill('plant'); return; }
    }
    for (i = 0; i < this.walkers.length; i++) {
      var w = this.walkers[i];
      if (Z.overlap(bx, by, bw, bh, w.x - 5, w.y - 6, 10, 6)) { this.kill(w.t); return; }
    }
    for (i = 0; i < this.nuts.length; i++) {
      var n = this.nuts[i];
      if (Z.overlap(bx, by, bw, bh, n.x - 3, n.y - 3, 6, 6)) { this.nuts.splice(i, 1); this.kill('nut'); return; }
    }
    var cx = h.x, cy = h.y - 8;
    for (i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      if (!it.got && Math.abs(it.x - cx) < 9 && Math.abs(it.y - cy) < 11) { it.got = true; this.ev('item', { item: it }); }
    }
    for (i = 0; i < this.checkpoints.length; i++) {
      var c = this.checkpoints[i];
      if (!c.lit && Math.abs(c.x - h.x) < 12 && Math.abs(c.y - h.y) < 18) {
        this.checkpoints.forEach(function (o) { o.lit = false; });
        c.lit = true; this.cp = { x: c.x, y: c.y }; this.ev('checkpoint', { x: c.x, y: c.y });
      }
    }
    var g = this.goal;
    if (Math.abs(g.x - h.x) < 10 && h.y > g.y - 30 && h.y <= g.y + 2) {
      this.won = true;
      if (h.st === 'idle' || h.st === 'cling') h.st = 'win';
      this.ev('win');
    }
  };

  W.kill = function (kind) {
    var h = this.hero;
    if (h.st === 'dead' || this.won) return;
    if (h.swing) { h.swing.v.held = false; h.swing = null; }
    h.st = 'dead'; h.dead = 0; h.kind = kind; h.vx = 0;
    h.vy = (kind === 'water' || kind === 'lava' || kind === 'croc') ? 0 : -150;
    h.on = null;
    this.ev('die', { kind: kind, x: h.x, y: h.y });
  };

  // ---------------------------------------------------------------- solver helpers
  W.snapshot = function () {
    var h = this.hero;
    return { x: h.x, y: h.y, st: h.st, on: h.on, face: h.face, swing: h.swing ? { v: h.swing.v, r: h.swing.r, ang: h.swing.v.ang, av: h.swing.v.av } : null };
  };
  W.restore = function (s) {
    var h = this.hero;
    this.vines.forEach(function (v) { v.held = false; v.ang = 0; v.av = 0; });
    h.x = s.x; h.y = s.y; h.st = s.st; h.on = s.on; h.face = s.face; h.vx = 0; h.vy = 0;
    h.grace = 0; h.graceObj = null; h.dead = 0; h.air = 0;
    h.swing = null;
    if (s.swing) { h.swing = { v: s.swing.v, r: s.swing.r }; s.swing.v.ang = s.swing.ang; s.swing.v.av = s.swing.av; s.swing.v.held = true; }
    this.branches.forEach(function (b) { b.st = 0; b.tm = 0; b.dy = 0; });
    this.won = false; this.jumps = 99; this.events.length = 0; this.nuts = [];
  };

  Z.World = World;
})();
