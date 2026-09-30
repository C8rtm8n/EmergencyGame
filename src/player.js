// The ambulance: arcade top-down car physics, collisions with buildings / water / map
// edge, kerb detection and "jolt" reporting (hard braking, swerving, impacts, kerbs),
// which the mission code turns into patient discomfort.
'use strict';
(function () {
  Z.VEHICLES = {
    van: { vmax: 47, acc: 7.0, brake: 15, grip: 8.0, comfort: 0, hp: 100, off: 0.55, len: 5.8, wid: 2.2, rank: 0, price: 0 },
    suv: { vmax: 51, acc: 8.8, brake: 16, grip: 8.8, comfort: -1, hp: 90, off: 0.8, len: 4.9, wid: 2.0, rank: 1, price: 1200 },
    box: { vmax: 45, acc: 6.4, brake: 14, grip: 7.6, comfort: 2, hp: 150, off: 0.5, len: 6.6, wid: 2.35, rank: 2, price: 2500 },
    rs: { vmax: 55, acc: 10, brake: 17, grip: 9.4, comfort: 1, hp: 120, off: 0.6, len: 5.4, wid: 2.1, rank: 3, price: 5000 },
  };
  Z.UPGRADES = { engine: [300, 800, 1800], susp: [250, 700, 1500], siren: [200, 600, 1300] };

  var P = Z.player = {
    x: 0, y: 0, h: 0, vx: 0, vy: 0, yaw: 0, steer: 0, hp: 100, maxHp: 100,
    siren: false, horn: false, onRoad: true, offT: 0, throttle: 0, brakeL: 0, speed: 0, vf: 0,
    stats: null, lastImpact: 0, beacon: 0, reverse: false,
    reset: function (x, y, h) {
      var v = Z.VEHICLES[Z.save.vehicle] || Z.VEHICLES.van, u = Z.save.upg;
      P.stats = {
        vmax: v.vmax + u.engine * 3, acc: v.acc + u.engine * 0.9, brake: v.brake, grip: v.grip, off: v.off,
        comfort: v.comfort + u.susp, len: v.len, wid: v.wid, hp: v.hp,
      };
      P.x = x; P.y = y; P.h = h; P.vx = P.vy = P.yaw = P.steer = 0; P.maxHp = P.hp = v.hp;
      P.siren = false; P.horn = false; P.onRoad = true; P.speed = 0; P.vf = 0; P.prevVf = 0;
    },
    comfortMul: function () { return Z.clamp(1 - 0.16 * P.stats.comfort, 0.35, 1.3); },
    // input: {up, down, left, right}
    step: function (dt, inp) {
      var S = P.stats, M = Z.map;
      var fx = Math.cos(P.h), fy = Math.sin(P.h), rx = -fy, ry = fx;
      var vf = P.vx * fx + P.vy * fy, vr = P.vx * rx + P.vy * ry;
      var dmg = P.hp / P.maxHp, dmgMul = dmg < 0.3 ? 0.75 : 1;
      var vmax = S.vmax * dmgMul * (P.onRoad ? 1 : S.off);
      var acc = 0;
      P.throttle = 0; P.brakeL = 0;
      if (inp.up) {
        if (vf < -0.5) { acc = S.brake; P.brakeL = 1; }
        else { acc = S.acc * Math.max(0, 1 - Math.pow(Math.max(0, vf) / vmax, 2.2)) * (vf < 8 ? 1.25 : 1); P.throttle = 1; }
      } else if (inp.down) {
        if (vf > 0.5) { acc = -S.brake; P.brakeL = 1; }
        else { acc = vf > -9 ? -5 : 0; P.throttle = 0.5; }
      }
      // rolling + aero drag, extra drag off road
      var drag = 0.35 * Math.sign(vf) + 0.0011 * vf * Math.abs(vf) * (38 / S.vmax) + (P.onRoad ? 0 : 0.9 * vf);
      if (!inp.up && !inp.down) drag += 1.2 * Math.sign(vf) * Math.min(1, Math.abs(vf));
      var nvf = vf + (acc - drag) * dt;
      if (!inp.up && !inp.down && Math.abs(nvf) < 0.25) nvf = 0;
      if (vf > 0 && nvf < 0 && !inp.down) nvf = 0;
      if (vf < 0 && nvf > 0 && !inp.up) nvf = 0;
      if (nvf > vmax + 1) nvf -= (nvf - vmax) * 2 * dt;
      // steering
      var target = (inp.left ? -1 : 0) + (inp.right ? 1 : 0);
      P.steer += (target - P.steer) * Math.min(1, dt * (target === 0 ? 10 : 6));
      var maxSteer = 0.62 / (1 + Math.abs(nvf) * Math.abs(nvf) / 420);
      var wheel = S.len * 0.6;
      P.yaw = nvf * Math.tan(P.steer * maxSteer) / wheel;
      P.h += P.yaw * dt;
      // lateral grip (slight drift at high speed)
      var grip = S.grip * (P.onRoad ? 1 : 0.7);
      vr *= Math.exp(-grip * dt);
      fx = Math.cos(P.h); fy = Math.sin(P.h); rx = -fy; ry = fx;
      P.vx = fx * nvf + rx * vr; P.vy = fy * nvf + ry * vr;
      var ox = P.x, oy = P.y;
      P.x += P.vx * dt; P.y += P.vy * dt;
      // jolts: longitudinal and lateral acceleration
      var along = (nvf - vf) / dt, alat = Math.abs(nvf * P.yaw);
      P.speed = Math.hypot(P.vx, P.vy); P.vf = nvf;
      if (along < -9.5) Z.missions && Z.missions.jolt((-along - 9.5) * 0.35 * dt, 'brake');
      if (alat > 8) Z.missions && Z.missions.jolt((alat - 8) * 0.3 * dt, 'swerve');
      // surface: road / off-road / kerbs
      var rd = M.roadDist(P.x, P.y), was = P.onRoad;
      P.onRoad = rd < 0.4;
      if (was !== P.onRoad && P.speed > 5) {
        Z.audio.bump(); P.shake = Math.min(1, P.speed / 25);
        Z.missions && Z.missions.jolt(1.2 + P.speed * 0.08, 'kerb');
      }
      // water: acts as a wall
      if (M.isWater(P.x + fx * S.len * 0.45, P.y + fy * S.len * 0.45) || M.isWater(P.x, P.y)) {
        P.x = ox; P.y = oy;
        impact(P.speed * 0.6, -fx, -fy);
        P.vx *= -0.2; P.vy *= -0.2;
      }
      // map bounds
      var b = M.bounds;
      if (P.x < b[0] || P.x > b[2] || P.y < b[1] || P.y > b[3]) { P.x = ox; P.y = oy; P.vx = P.vy = 0; }
      collideBuildings();
      P.beacon += dt;
      if (P.shake) P.shake = Math.max(0, P.shake - dt * 3);
      P.lastImpact += dt;
    },
    corners: function (out) { return obbCorners(P.x, P.y, P.stats.len / 2, P.stats.wid / 2, Math.cos(P.h), Math.sin(P.h), out); },
    impact: function (v, nx, ny) { impact(v, nx, ny); },
  };

  function impact(v, nx, ny) {
    if (v < 2.5) return;
    var s = Z.clamp((v - 2.5) / 20, 0, 1);
    if (P.lastImpact > 0.35) {
      Z.audio.crash(s);
      P.hp = Math.max(0, P.hp - v * 0.9);
      P.shake = Math.min(1.2, 0.3 + s);
      Z.missions && Z.missions.collision(v);
    }
    P.lastImpact = 0;
  }

  function obbCorners(cx, cy, hl, hw, c, s, out) {
    out = out || [];
    out[0] = cx + c * hl - s * hw; out[1] = cy + s * hl + c * hw;
    out[2] = cx + c * hl + s * hw; out[3] = cy + s * hl - c * hw;
    out[4] = cx - c * hl + s * hw; out[5] = cy - s * hl - c * hw;
    out[6] = cx - c * hl - s * hw; out[7] = cy - s * hl + c * hw;
    return out;
  }
  Z.obbCorners = obbCorners;
  // SAT between two OBBs given as corner arrays + axes; returns MTV {x,y,d} pushing A out of B
  var ax = new Float32Array(8);
  function sat(ca, cb, axes, mtv) {
    var best = 1e9, bx = 0, by = 0;
    for (var k = 0; k < axes.length; k += 2) {
      var x = axes[k], y = axes[k + 1];
      var a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
      for (var i = 0; i < 8; i += 2) {
        var p = ca[i] * x + ca[i + 1] * y; if (p < a0) a0 = p; if (p > a1) a1 = p;
        var q = cb[i] * x + cb[i + 1] * y; if (q < b0) b0 = q; if (q > b1) b1 = q;
      }
      var o1 = a1 - b0, o2 = b1 - a0;
      if (o1 <= 0 || o2 <= 0) return false;
      if (o1 < best) { best = o1; bx = -x; by = -y; }
      if (o2 < best) { best = o2; bx = x; by = y; }
    }
    mtv.x = bx; mtv.y = by; mtv.d = best;
    return true;
  }
  Z.sat = sat;
  var pc = [], bc = [], mtv = {};
  function collideBuildings() {
    var M = Z.map, g = M.bGrid, r = P.stats.len;
    var i0 = Math.floor((P.x - r) / g.c), i1 = Math.floor((P.x + r) / g.c), j0 = Math.floor((P.y - r) / g.c), j1 = Math.floor((P.y + r) / g.c);
    for (var i = i0; i <= i1; i++) for (var j = j0; j <= j1; j++) {
      var a = g.cell(i, j); if (!a) continue;
      for (var k = 0; k < a.length; k++) {
        var b = a[k];
        var dx = M.bx[b] - P.x, dy = M.by[b] - P.y, rr = (M.bw[b] + M.bd[b]) / 2 + r;
        if (dx * dx + dy * dy > rr * rr) continue;
        obbCorners(P.x, P.y, P.stats.len / 2, P.stats.wid / 2, Math.cos(P.h), Math.sin(P.h), pc);
        obbCorners(M.bx[b], M.by[b], M.bw[b] / 2, M.bd[b] / 2, M.bc[b], M.bs[b], bc);
        ax[0] = Math.cos(P.h); ax[1] = Math.sin(P.h); ax[2] = -ax[1]; ax[3] = ax[0];
        ax[4] = M.bc[b]; ax[5] = M.bs[b]; ax[6] = -M.bs[b]; ax[7] = M.bc[b];
        if (!sat(pc, bc, ax, mtv)) continue;
        // make sure MTV points from building to player
        if ((P.x - M.bx[b]) * mtv.x + (P.y - M.by[b]) * mtv.y < 0) { mtv.x = -mtv.x; mtv.y = -mtv.y; }
        P.x += mtv.x * (mtv.d + 0.01); P.y += mtv.y * (mtv.d + 0.01);
        var vn = P.vx * mtv.x + P.vy * mtv.y;
        if (vn < 0) {
          impact(-vn, mtv.x, mtv.y);
          P.vx -= 1.25 * vn * mtv.x; P.vy -= 1.25 * vn * mtv.y;
          P.vx *= 0.85; P.vy *= 0.85;
        }
      }
    }
  }
})();
