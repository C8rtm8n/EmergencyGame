// Boot, main loop and game states (menu with attract mode, shift, pause, end).
'use strict';
(function () {
  var cv, stage, P, M, last = 0, fps = 60;
  var G = Z.game = {
    state: 'boot', safe: { l: 0, r: 0, t: 0, b: 0 }, time: 0, clock: 8, shiftT: 0, target: null, route: null, routeT: 0,
    zoom: 7, cam: { x: 0, y: 0 }, demo: null,
    setTarget: function (x, y, icon, color) { G.target = x == null ? null : { x: x, y: y, icon: icon, color: color }; G.route = null; G.routeT = 0; },
    shiftLeft: function () { return G.shiftT; },
    hour: function () { return ((G.clock % 24) + 24) % 24; },
    clockText: function () { var h = G.hour(), m = Math.floor((h % 1) * 60); return '🕐 ' + (h | 0) + ':' + ('0' + m).slice(-2); },
    isNight: function () { var h = G.hour(); return h >= 20.5 || h < 5.5; },
    night: function () { // 0 day .. 1 night, smooth dusk/dawn
      var h = G.hour();
      if (h >= 21 || h < 5) return 1;
      if (h >= 19 && h < 21) return (h - 19) / 2;
      if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
      return 0;
    },
  };

  // ---------------------------------------------------------------- boot
  window.addEventListener('load', function () {
    Z.loadSave();
    Z.setLang(Z.save.lang || Z.detectLang());
    stage = document.getElementById('stage'); cv = document.getElementById('game');
    Z.ui.init(document.getElementById('ui'));
    Z.ui.show('loading');
    Z.input.bindTouch(document.getElementById('touch'));
    if (Z.input.isTouchDevice()) document.body.classList.add('touch');
    setTimeout(boot, 30);
  });
  function boot() {
    var t0 = performance.now();
    M = Z.map = Z.buildMap(window.MAP_DATA);
    P = Z.player;
    Z.render.init(cv, M);
    Z.traffic.init(M);
    resize();
    Z.tiles.init(M, G.zoom);
    Z.tiles.buildMinimap(0.07);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && G.state === 'play') G.pause(); });
    cv.addEventListener('pointerdown', onPointer);
    cv.addEventListener('pointerup', function (e) { if (Z.minigames.active) Z.minigames.pointer(0, 0, false); });
    stage.addEventListener('pointerdown', function () { Z.audio.unlock(); }, { passive: true });
    if (Z.CONFIG.debug) console.log('map ready in', Math.round(performance.now() - t0), 'ms', M.edges.length, 'edges', M.nb, 'buildings');
    Z.poki.init().then(function () {
      Z.poki.loadingFinished();
      startAttract();
      Z.ui.show('menu');
      G.state = 'menu';
      if (/[?&]autoplay=1/.test(location.search)) G.play();
    });
    requestAnimationFrame(loop);
  }

  function resize() {
    // safe-area insets (notches) measured from CSS env()
    var probe = document.getElementById('safe');
    var cs = getComputedStyle(probe);
    G.safe = { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 };
    var vw = window.innerWidth, vh = window.innerHeight;
    var w = vw, h = vw * 9 / 16;
    if (h > vh) { h = vh; w = vh * 16 / 9; }
    stage.style.width = Math.floor(w) + 'px'; stage.style.height = Math.floor(h) + 'px';
    stage.style.left = Math.floor((vw - w) / 2) + 'px'; stage.style.top = Math.floor((vh - h) / 2) + 'px';
    // insets only matter where the stage touches the screen edge
    G.safe = { l: (vw - w) / 2 < G.safe.l ? G.safe.l : 0, r: (vw - w) / 2 < G.safe.r ? G.safe.r : 0, t: (vh - h) / 2 < G.safe.t ? G.safe.t : 0, b: (vh - h) / 2 < G.safe.b ? G.safe.b : 0 };
    var dpr = Math.min(window.devicePixelRatio || 1, Z.input.isTouchDevice() ? 1.5 : 2) * (G.quality || 1);
    var cw = Math.max(640, Math.min(1920, Math.round(w * dpr))), ch = Math.round(cw * 9 / 16);
    var s = cw / 1280;
    Z.render.resize(cw, ch, s);
    G.scale = s; G.cssScale = cw / w;
    document.documentElement.style.setProperty('--ui', (w / 1280).toFixed(3));
    stage.style.setProperty('--sl', G.safe.l + 'px'); stage.style.setProperty('--sr', G.safe.r + 'px'); stage.style.setProperty('--sb', G.safe.b + 'px'); stage.style.setProperty('--st', G.safe.t + 'px');
    if (Z.tiles.setRes) Z.tiles.setRes(Z.CONFIG.zoomNear * s);
    document.getElementById('rotate-t').textContent = Z.t('rotate');
    document.title = Z.t('title') + ': ' + Z.t('subtitle');
    document.body.classList.toggle('portrait', vh > vw && Z.input.isTouchDevice());
    // safe insets are CSS px; HUD works in canvas px / scale
    G.safe = { l: G.safe.l * G.cssScale / s, r: G.safe.r * G.cssScale / s, t: G.safe.t * G.cssScale / s, b: G.safe.b * G.cssScale / s };
  }

  function onPointer(e) {
    Z.audio.unlock();
    var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height;
    if (G.state !== 'play') return;
    if (Z.minigames.active) { Z.minigames.pointer(x, y, true, cv.width, cv.height); return; }
    var bs = Z.hud.buttons();
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (b.id === 'action') Z.missions.action();
        if (b.id === 'repair') G.rewardRepair();
        return;
      }
    }
  }

  // ---------------------------------------------------------------- attract mode (menu background)
  function startAttract() {
    Z.traffic.clear();
    var base = M.mainBase.bay;
    var r = M.nearestRoad(base.x, base.y, 200, function (e) { return e.cls >= 2 && e.cls <= 4 && e.len > 60; }) || M.nearestRoad(base.x, base.y, 500);
    var e = r.e, s = Math.min(Math.max(r.s, 20), e.len - 20);
    var tr = Z.traffic;
    G.demo = spawnDemo(e, s);
    G.cam.x = G.demo.x; G.cam.y = G.demo.y;
    tr.update(0.016, null, { x: G.cam.x, y: G.cam.y }, { initial: true });
    for (var i = 0; i < 20; i++) tr.update(0.05, demoEm(), { x: G.cam.x, y: G.cam.y }, { initial: true });
    G.clock = 17.5;
  }
  function spawnDemo(e, s) {
    var c = Z.traffic.addWreck(e, 1, s, 0, 'demo');
    c.wreck = false; c.amb = true; c.type = 'amb'; c.len = 5.8; c.wid = 2.2; c.color = '#f5d000'; c.drv = 1.2; c.v = 8; c.distracted = false;
    return c;
  }
  function demoEm() {
    var d = G.demo; if (!d) return null;
    return { x: d.x, y: d.y, vx: Math.cos(d.h) * d.v, vy: Math.sin(d.h) * d.v, h: d.h, siren: true, hornT: 0, len: d.len, wid: d.wid, range: 90 };
  }

  // ---------------------------------------------------------------- shift control
  G.play = function () {
    Z.audio.unlock();
    Z.ui.hide();
    var go = function () {
      Z.traffic.clear();
      G.demo = null;
      var base = M.mainBase.bay;
      // start in the kerbside lane next to the station, facing the legal direction
      var tp = M.pointAt(base.e, base.s, {}), side = base.side || 1, lat = base.e.halfW - base.e.W / 2;
      P.reset(tp.x - tp.ty * lat * side, tp.y + tp.tx * lat * side, base.h + (side > 0 ? 0 : Math.PI));
      G.cam.x = P.x; G.cam.y = P.y;
      G.shiftT = Z.CONFIG.shiftSeconds; G.extended = false;
      var starts = Z.CONFIG.shiftStarts; G.clock = starts[Z.save.shifts % starts.length];
      Z.missions.startShift();
      Z.hud.reset();
      Z.input.clear();
      Z.traffic.update(0.016, null, P, { initial: true });
      for (var i = 0; i < 25; i++) Z.traffic.update(0.05, null, P, { initial: true });
      G.setTarget(null);
      G.state = 'play';
      Z.poki.gameplayStart();
    };
    if (Z.save.shifts > 0) { G.state = 'ad'; Z.poki.commercialBreak().then(go); } else go();
  };
  G.pause = function () {
    if (G.state !== 'play') return;
    G.state = 'pause'; Z.audio.stopAll(); Z.poki.gameplayStop(); Z.ui.show('pause');
  };
  G.resume = function () { Z.ui.hide(); Z.input.clear(); G.state = 'play'; Z.poki.gameplayStart(); };
  G.timeUp = function () {
    Z.audio.stopAll(); Z.poki.gameplayStop();
    if (!G.extended) { G.state = 'extend'; Z.ui.show('extend'); }
    else G.finishShift();
  };
  G.extendShift = function () {
    Z.ui.hide(); G.state = 'ad';
    Z.poki.rewardedBreak().then(function (ok) {
      G.extended = true;
      if (ok) { G.shiftT += Z.CONFIG.extendSeconds; G.state = 'play'; Z.input.clear(); Z.poki.gameplayStart(); }
      else G.finishShift();
    });
  };
  G.finishShift = function () {
    Z.audio.stopAll(); Z.poki.gameplayStop();
    var r = Z.missions.endShift();
    G.state = 'end'; G.setTarget(null);
    Z.ui.show('end', r);
  };
  G.toMenu = function () { Z.ui.show('menu'); startAttract(); G.state = 'menu'; };
  G.rewardRepair = function () {
    if (G.state !== 'play') return;
    G.state = 'ad'; Z.audio.stopAll();
    Z.poki.rewardedBreak().then(function (ok) {
      if (ok) { P.hp = P.maxHp; Z.hud.toast('🔧 ' + Z.t('repaired'), '#8f8'); }
      G.state = 'play'; Z.input.clear(); Z.poki.gameplayStart();
    });
  };

  // ---------------------------------------------------------------- loop
  function loop(ts) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    if (dt <= 0) return;
    fps = fps * 0.95 + (1 / dt) * 0.05;
    adaptQuality(dt);
    G.time += dt;
    Z.audio.update();
    var I = Z.input;
    if (G.state === 'play') updatePlay(dt);
    else if (G.state === 'menu' || G.state === 'end' || G.state === 'boot') updateAttract(dt);
    if (I.take('mute')) { Z.save.sound = Z.save.sound ? 0 : 1; Z.writeSave(); Z.audio.refreshVolume(); }
    if (G.state === 'pause' && I.take('pause')) G.resume();
    var tOn = G.state === 'play';
    if (tOn !== G._touchOn) { G._touchOn = tOn; document.getElementById('touch').classList.toggle('on', tOn); }
    draw(dt);
  }

  // dynamic resolution: drop the canvas resolution when the device can't keep ~60 FPS
  var qT = 0, qCalm = 0;
  function adaptQuality(dt) {
    if (G.state !== 'play') return;
    qT += dt; qCalm += dt;
    if (qT < 3) return;
    qT = 0;
    var q = G.quality || 1;
    if (fps < 45 && q > 0.55) { G.quality = Math.max(0.55, q - 0.15); qCalm = 0; resize(); }
    else if (fps > 58 && q < 1 && qCalm > 15) { G.quality = Math.min(1, q + 0.1); qCalm = 0; resize(); }
  }

  function updateAttract(dt) {
    var d = G.demo;
    if (!d || Z.traffic.cars.indexOf(d) < 0) { if (M) startAttract(); return; }
    G.clock += dt * 0.02;
    Z.traffic.update(dt, demoEm(), { x: d.x, y: d.y });
    var vx = Math.cos(d.h) * d.v, vy = Math.sin(d.h) * d.v;
    camera(dt, d.x, d.y, vx, vy, d.v, 0.9);
  }

  function updatePlay(dt) {
    var I = Z.input;
    if (I.take('pause')) { G.pause(); return; }
    if (Z.minigames.active) { Z.minigames.update(dt); Z.audio.engine(0, 0, true); return; }
    G.shiftT -= dt;
    G.clock += dt * Z.CONFIG.gameMinutesPerSecond / 60; // hours
    // traffic density: rush hours busier, night quieter
    var h = G.hour();
    Z.traffic.density = (h >= 6.5 && h < 9) || (h >= 15 && h < 18) ? 1.55 : G.isNight() ? 0.55 : 1;
    // siren / horn
    if (I.take('siren')) { P.siren = !P.siren; }
    if (I.take('tone')) { Z.save.sirenMode = Z.save.sirenMode ? 0 : 1; Z.writeSave(); Z.audio.sirenModeChanged(); Z.hud.toast('🚨 ' + Z.t(Z.save.sirenMode ? 'tone_wail' : 'tone_hilo'), '#9cf'); }
    Z.audio.siren(P.siren, 0.14);
    Z.audio.horn(I.horn);
    if (I.horn) P.hornT = 0.3; else if (P.hornT > 0) P.hornT -= dt;
    // physics substeps
    var n = Math.ceil(dt / (1 / 60)), sdt = dt / n;
    for (var i = 0; i < n; i++) { P.step(sdt, I); Z.traffic.collidePlayer(P); }
    Z.audio.engine(P.speed, P.throttle, true);
    var u = Z.save.upg;
    var em = { x: P.x, y: P.y, vx: P.vx, vy: P.vy, h: P.h, siren: P.siren, hornT: P.hornT || 0, len: P.stats.len, wid: P.stats.wid, range: Z.CONFIG.sirenRange + u.siren * 25 };
    Z.traffic.update(dt, em, P);
    if (u.siren) Z.traffic.cars.forEach(function (c) { if (c.react > 0.3) c.react = Math.max(0.3, c.react - dt * 0.1 * u.siren); });
    Z.missions.update(dt);
    // route guidance
    G.routeT -= dt;
    if (G.target && G.routeT <= 0) { G.route = M.route(P, G.target); G.routeT = 1.2; }
    camera(dt, P.x, P.y, P.vx, P.vy, P.speed, Z.CONFIG.lookAhead);
    if (G.shiftT <= 0) G.timeUp();
  }

  function camera(dt, x, y, vx, vy, speed, look) {
    var s = G.scale || 1;
    var zt = Z.lerp(Z.CONFIG.zoomNear, Z.CONFIG.zoomFar, Z.clamp(speed / 42, 0, 1)) * s;
    G.zoom += (zt - G.zoom) * Math.min(1, dt * 1.5);
    var lx = Z.clamp(vx * look, -60, 60), ly = Z.clamp(vy * look, -40, 40);
    var k = Math.min(1, dt * 4);
    G.cam.x += (x + lx - G.cam.x) * k; G.cam.y += (y + ly - G.cam.y) * k;
  }

  function draw(dt) {
    if (!M) return;
    var v = Z.render.view; v.cx = G.cam.x; v.cy = G.cam.y; v.z = G.zoom;
    var playing = G.state === 'play' || G.state === 'pause' || G.state === 'extend' || G.state === 'ad';
    var st = {
      cars: Z.traffic.cars, player: playing ? P : null, route: playing ? G.route : null, target: playing ? G.target : null,
      night: G.night(), time: G.time, dt: dt, shake: playing ? (P.shake || 0) : 0,
      tileBudget: G.time < 1 ? 60 : 3,
      ahead: playing ? { x: Z.clamp(P.vx * 2.5, -140, 140), y: Z.clamp(P.vy * 2.5, -140, 140) } : null,
      bays: [{ x: M.mainHospital.bay.x, y: M.mainHospital.bay.y, h: M.mainHospital.bay.h, kind: 'er' }].concat(M.stations.map(function (s) { return { x: s.bay.x, y: s.bay.y, h: s.bay.h, kind: 'base' }; })),
    };
    Z.render.frame(st);
    var g = cv.getContext('2d');
    if (playing) Z.hud.draw(g, cv.width, cv.height, G.scale, st);
    if (Z.CONFIG.debug) { g.fillStyle = '#0f0'; g.font = '14px monospace'; g.textAlign = 'left'; g.fillText(Math.round(fps) + ' fps  cars ' + Z.traffic.cars.length, 10, cv.height - 10); }
  }
})();
