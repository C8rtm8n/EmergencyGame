// Dispatch, patients and scoring. A call: drive to the scene -> short treatment
// minigame -> drive smoothly to the ER of the Fakultní nemocnice -> hand over.
// Each condition deteriorates at its own rate; hard braking, swerving, kerbs and crashes
// make it worse (childbirth and transfers are the most sensitive).
'use strict';
(function () {
  var TYPES = {
    cardiac: { icon: '❤️', rate: 0.55, tRate: 0.3, comfort: 1.0, start: [52, 66], game: 'cpr', w: 3 },
    stroke: { icon: '🧠', rate: 0.42, tRate: 0.26, comfort: 1.3, start: [58, 72], game: 'splint', w: 2 },
    breath: { icon: '🫁', rate: 0.34, tRate: 0.2, comfort: 1.0, start: [60, 75], game: 'breathe', w: 2 },
    fracture: { icon: '🦴', rate: 0.08, tRate: 0.05, comfort: 1.6, start: [70, 85], game: 'splint', w: 3 },
    cut: { icon: '🩹', rate: 0.2, tRate: 0.1, comfort: 0.8, start: [62, 78], game: 'bandage', w: 3 },
    fall: { icon: '🤕', rate: 0.12, tRate: 0.07, comfort: 1.3, start: [66, 82], game: 'bandage', w: 2 },
    birth: { icon: '👶', rate: 0.1, tRate: 0.08, comfort: 3.0, start: [80, 92], game: 'breathe', w: 2 },
    crash: { icon: '💥', rate: 0.3, tRate: 0.18, comfort: 1.3, start: [45, 80], game: 'triage', w: 2 },
    transfer: { icon: '🏥', rate: 0.12, tRate: 0.12, comfort: 2.2, start: [70, 80], game: null, w: 2 },
  };
  Z.CALL_TYPES = TYPES;
  var RANKS = [0, 1500, 4000, 9000, 18000];
  Z.rankOf = function (xp) { var r = 0; for (var i = 0; i < RANKS.length; i++) if (xp >= RANKS[i]) r = i; return r; };
  Z.rankNext = function (xp) { var r = Z.rankOf(xp); return r + 1 < RANKS.length ? RANKS[r + 1] : null; };
  var DAILY = ['daily_cardiac', 'daily_smooth', 'daily_score', 'daily_five', 'daily_village'];
  Z.dailyKey = function () {
    var d = new Date(), day = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    var h = 0; for (var i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) | 0;
    return { day: day, key: DAILY[Math.abs(h) % DAILY.length] };
  };

  var S; // shift state
  var MS = Z.missions = {
    get: function () { return S; },
    types: TYPES,
    startShift: function () {
      S = {
        score: 0, saved: 0, failed: 0, cleanDist: 0, bestClean: 0, smoothPaid: 0,
        mission: null, nextIn: 2.5, stats: { cardiac: 0, village: 0 }, sigIn: null, extended: false,
      };
      var d = Z.dailyKey(); if (Z.save.daily.day !== d.day) Z.save.daily = { day: d.day, done: 0, prog: 0 };
      S.daily = d.key;
    },
    update: update,
    jolt: function (amount, kind) {
      if (!S || !S.mission || S.mission.stage !== 2) return;
      var m = S.mission, h = amount * m.def.comfort * Z.player.comfortMul() * 0.9;
      m.cond -= h; m.harm += h;
      if (h > 0.4) { S.ouch = 0.8; }
    },
    collision: function (v) {
      if (!S) return;
      if (S.cleanDist > 60) Z.hud.toast('〰 ' + Math.round(S.cleanDist) + ' m', '#9ad');
      S.cleanDist = 0; S.smoothPaid = 0;
      if (v > 6) Z.hud.toast(Z.t('crash'), '#ff6a4a');
      if (S.mission && S.mission.stage === 2) { S.mission.cond -= v * 0.45 * S.mission.def.comfort * Z.player.comfortMul(); S.mission.clean = false; S.ouch = 1; }
    },
    action: action,
    canAct: function () { return S && S.canAct; },
    endShift: function () {
      var coins = Math.round(S.score / 5);
      Z.save.coins += coins; Z.save.xp += S.score; Z.save.shifts++; Z.save.saved += S.saved;
      var rec = S.score > Z.save.best; if (rec) Z.save.best = S.score;
      if (S.bestClean > Z.save.bestClean) Z.save.bestClean = Math.round(S.bestClean);
      if (S.mission && S.mission.wrecks) Z.traffic.removeWrecks('crash');
      Z.writeSave();
      return { score: S.score, saved: S.saved, bestClean: Math.round(S.bestClean), coins: coins, record: rec };
    },
  };

  function update(dt) {
    if (!S) return;
    var P = Z.player, M = Z.map;
    // smooth run: distance with siren on / patient aboard without collisions
    if ((P.siren || (S.mission && S.mission.stage === 2)) && P.speed > 3) {
      S.cleanDist += P.speed * dt;
      if (S.cleanDist > S.bestClean) S.bestClean = S.cleanDist;
      var tier = Math.floor(S.cleanDist / 400);
      if (tier > S.smoothPaid) { S.smoothPaid = tier; var b = 20 + tier * 10; S.score += b; Z.hud.toast(Z.t('smooth') + ' +' + b, '#5fe0a0'); Z.audio.blip('coin'); }
      if (S.daily === 'daily_smooth' && S.cleanDist >= 1500) daily();
    }
    if (S.ouch) S.ouch = Math.max(0, S.ouch - dt);
    checkRedLight(dt);
    // repair at a station
    S.atBase = false;
    for (var i = 0; i < M.stations.length; i++) {
      var st = M.stations[i];
      if (Math.hypot(P.x - st.bay.x, P.y - st.bay.y) < 12 && P.speed < 1.5) {
        S.atBase = true;
        if (P.hp < P.maxHp) { P.hp = Math.min(P.maxHp, P.hp + 30 * dt); if (P.hp >= P.maxHp) Z.hud.toast('🔧 ' + Z.t('repaired'), '#8f8'); }
      }
    }
    var m = S.mission;
    S.canAct = false;
    if (!m) {
      S.nextIn -= dt;
      if (S.nextIn <= 0) dispatch();
      return;
    }
    m.t += dt;
    // deterioration
    if (m.stage === 1) m.cond -= m.def.rate * 0.5 * dt;
    else if (m.stage === 2) m.cond -= m.def.tRate * m.rateMul * dt;
    if (m.cond <= 0) {
      Z.hud.toast('🚁 ' + Z.t('heli'), '#ffb74d'); Z.audio.blip('bad');
      finish(false); return;
    }
    var tx = m.stage === 1 ? m.x : m.hx, ty = m.stage === 1 ? m.y : m.hy;
    var d = Math.hypot(P.x - tx, P.y - ty);
    m.dist = d;
    if (d < (m.stage === 1 ? 18 : 12) && P.speed < 3) {
      S.canAct = true;
      if (Z.input.take('action')) action();
    }
  }
  function action() {
    var m = S && S.mission; if (!m || !S.canAct) return;
    if (m.stage === 1) {
      Z.player.vx = Z.player.vy = 0;
      var go = function (res) {
        m.cond = Math.min(100, m.cond + 6 + 18 * res); m.rateMul = 1 - 0.45 * res;
        m.stage = 2; m.t2 = 0; m.harm = 0; m.clean = true;
        var h = m.dest; m.hx = h.bay.x; m.hy = h.bay.y;
        Z.game.setTarget(m.hx, m.hy, '🏥', '#e23a3a');
        if (m.wrecks) setTimeout(function () { Z.traffic.removeWrecks('crash'); }, 12000);
        Z.hud.toast(res > 0.8 ? Z.t('perfect') : res > 0.5 ? Z.t('good') : Z.t('ok'), res > 0.5 ? '#6f6' : '#fd6');
      };
      if (m.type === 'crash') {
        Z.minigames.start('triage', { patients: m.patients }, function (res, pick) {
          var best = 0; m.patients.forEach(function (p, i) { if (p.cond < m.patients[best].cond) best = i; });
          m.triageOk = pick === best; m.cond = m.patients[pick].cond;
          Z.hud.toast(m.triageOk ? Z.t('triage_ok') : Z.t('triage_bad'), m.triageOk ? '#6f6' : '#fd6');
          Z.audio.blip(m.triageOk ? 'good' : 'bad');
          Z.minigames.start('bandage', {}, go);
        });
      } else if (m.def.game) Z.minigames.start(m.def.game, { baby: m.type === 'birth' }, go);
      else go(1);
    } else if (m.stage === 2) {
      Z.player.vx = Z.player.vy = 0;
      finish(true);
    }
  }
  function finish(ok) {
    var m = S.mission;
    if (ok) {
      var par = m.parT || 60;
      var pts = { base: 150, cond: Math.round(m.cond * 3), time: Z.clamp(Math.round((par - m.t) * 1.5), 0, 200), clean: m.clean ? 75 : 0, triage: m.triageOk ? 100 : 0 };
      var sum = pts.base + pts.cond + pts.time + pts.clean + pts.triage;
      var mul = (m.night ? 1.25 : 1) * (m.village ? 1.2 : 1);
      sum = Math.round(sum * mul);
      S.score += sum; S.saved++;
      if (m.type === 'cardiac') S.stats.cardiac++;
      if (m.village) S.stats.village++;
      Z.save.rec[m.type] = Math.max(Z.save.rec[m.type] || 0, sum);
      Z.hud.result(m, pts, sum, mul);
      Z.audio.blip('good');
      if ((S.daily === 'daily_cardiac' && S.stats.cardiac >= 2) || (S.daily === 'daily_five' && S.saved >= 5) || (S.daily === 'daily_village' && S.stats.village >= 1)) daily();
      if (S.daily === 'daily_score' && S.score >= 2500) daily();
    } else S.failed++;
    if (m.wrecks) Z.traffic.removeWrecks('crash');
    S.mission = null; S.canAct = false; S.nextIn = Z.rand(3, 6);
    Z.game.setTarget(null);
  }
  function daily() {
    if (Z.save.daily.done) return;
    Z.save.daily.done = 1; Z.save.coins += 300; Z.writeSave();
    Z.hud.toast('📅 ' + Z.t('daily') + ' ✔ +300 🪙', '#ffd54f'); Z.audio.blip('coin');
  }

  // ---------------------------------------------------------------- dispatch
  function pickType() {
    var tot = 0, k; for (k in TYPES) tot += TYPES[k].w;
    var r = Math.random() * tot; for (k in TYPES) { r -= TYPES[k].w; if (r <= 0) return k; }
    return 'cardiac';
  }
  function roadSpot(cx, cy, rmin, rmax, filter) {
    var M = Z.map, P = Z.player;
    for (var tries = 0; tries < 60; tries++) {
      var a = Math.random() * Math.PI * 2, d = Z.rand(rmin, rmax);
      var r = M.nearestRoad(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 60, filter);
      if (!r) continue;
      if (Math.hypot(r.x - P.x, r.y - P.y) < 300) continue;
      if (r.s < r.e.clrA + 6 || r.s > r.e.len - r.e.clrB - 6) continue;
      if (M.isWater(r.x, r.y)) continue;
      return r;
    }
    return null;
  }
  function dispatch() {
    var M = Z.map, P = Z.player, first = !S.dispatched, type = first ? Z.pick(['cardiac', 'cut', 'fall', 'fracture']) : pickType(), m = { type: type, def: TYPES[type], stage: 1, t: 0, rateMul: 1, harm: 0, clean: true };
    m.night = Z.game.isNight();
    m.dest = M.mainHospital;
    var spot = null, tmp = {};
    if (type === 'crash') {
      spot = roadSpot(P.x, P.y, 500, 2600, function (e) { return e.cls === 0 && e.len > 140; });
      if (spot) {
        var e = spot.e, dir = 1, s = Z.clamp(spot.s, 60, e.len - 50);
        Z.traffic.removeWrecks('crash');
        Z.traffic.addWreck(e, dir, s, 0, 'crash'); Z.traffic.addWreck(e, dir, s + 6.5, 1, 'crash');
        M.travelPoint(e, dir, s - 11, M.laneLat(e, 1), tmp);
        m.x = tmp.x; m.y = tmp.y; m.wrecks = true;
        m.patients = [0, 1, 2].map(function () { return { cond: Math.round(Z.rand(30, 85)), icon: Z.pick(['🤕', '🦵', '💫', '😵']) }; });
        m.place = 'D11';
      } else type = m.type = 'cut', m.def = TYPES.cut;
    }
    if (type === 'transfer') {
      var others = M.hospitals.filter(function (h) { return h !== M.mainHospital; });
      if (others.length) { var h = Z.pick(others); m.x = h.bay.x; m.y = h.bay.y; m.place = h.n; m.village = !!M.townAt(h.x, h.y) && M.townAt(h.x, h.y).n !== M.towns[0].n; }
      else { type = m.type = 'fall'; m.def = TYPES.fall; }
    }
    if (m.x === undefined) {
      var village = !first && Math.random() < 0.28 && M.towns.length > 1;
      var filt = function (e) { return e.cls >= 2 && e.cls !== 1; };
      if (village) {
        var t = Z.pick(M.towns.slice(1));
        spot = roadSpot(t.x, t.y, 0, t.r * 0.7, filt);
        if (spot && Math.hypot(spot.x - P.x, spot.y - P.y) > 800) m.village = true; else spot = null;
      }
      if (!spot) spot = roadSpot(P.x, P.y, 350, first ? 800 : 1300, filt);
      if (!spot) { S.nextIn = 1; return; }
      var side = spot.side || 1;
      M.pointAt(spot.e, spot.s, tmp);
      var off = spot.e.halfW + 1.2;
      m.x = tmp.x - tmp.ty * off * side; m.y = tmp.y + tmp.tx * off * side;
      m.place = M.placeName(m.x, m.y);
    }
    m.cond = Z.rand(m.def.start[0], m.def.start[1]);
    var dist = Math.hypot(m.x - P.x, m.y - P.y) + Math.hypot(m.x - m.dest.bay.x, m.y - m.dest.bay.y);
    m.parT = dist * 1.35 / 16 + 25;
    S.mission = m; S.dispatched = true;
    Z.game.setTarget(m.x, m.y, m.def.icon, '#ff3b3b');
    Z.hud.dispatch(m);
    Z.audio.blip('dispatch');
  }

  // ---------------------------------------------------------------- red light (without siren)
  function checkRedLight() {
    var P = Z.player, M = Z.map, inside = null;
    var r = M.nearestRoad(P.x, P.y, 30);
    if (r) {
      var cand = [M.nodes[r.e.a], M.nodes[r.e.b]];
      for (var i = 0; i < 2; i++) { var n = cand[i]; if (n.sig && Math.hypot(P.x - n.x, P.y - n.y) < n.r) inside = n; }
    }
    if (inside && S.sigIn !== inside && S.prevPos) {
      var bearing = Math.atan2(S.prevPos.y - inside.y, S.prevPos.x - inside.x);
      var st = Z.traffic.sigState(inside, Z.traffic.approachGroup(inside, bearing));
      if (st === 2 && !P.siren && P.speed > 3) { S.score = Math.max(0, S.score - 50); Z.hud.toast('🚦 ' + Z.t('red_light') + ' −50', '#ff5252'); Z.audio.blip('bad'); }
    }
    if (!inside || S.sigIn !== inside) S.prevPos = { x: P.x, y: P.y };
    S.sigIn = inside;
  }
})();
