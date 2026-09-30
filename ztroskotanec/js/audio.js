// ============================================================================
//  audio.js — everything is synthesised with the Web Audio API (no files).
//  * chiptune music sequencer: square lead, triangle bass, 8-bit "marimba",
//    bongos / shaker percussion
//  * 8-bit jungle ambience: waves, birds, crickets, waterfall, rain + thunder
//  * sound effects
//  Separate music / effects volume, plus a global mute used by the SDK / ads.
// ============================================================================
'use strict';
(function () {
  var A = Z.Audio = {
    ctx: null, master: null, music: null, sfx: null, amb: null, noiseBuf: null,
    musicVol: 0.7, sfxVol: 0.8, muted: false, adMuted: false,
    song: null, songName: '', step: 0, nextTime: 0, timer: null, ambKind: '', ambTimer: 0, loops: []
  };

  // ------------------------------------------------------------ setup
  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended' && !A.suspended) A.ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { A.ctx = new AC(); } catch (e) { return; }
    var c = A.ctx;
    A.master = c.createGain(); A.master.connect(c.destination);
    A.music = c.createGain(); A.music.connect(A.master);
    A.sfx = c.createGain(); A.sfx.connect(A.master);
    A.amb = c.createGain(); A.amb.connect(A.sfx); A.amb.gain.value = 0.55;
    var len = c.sampleRate, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noiseBuf = buf;
    A.applyVolumes();
    A.timer = setInterval(A.tick, 25);
    if (A.pendingSong) { var s = A.pendingSong; A.pendingSong = null; A.playSong(s); }
    if (A.pendingAmb) { var a = A.pendingAmb; A.pendingAmb = null; A.setAmbient(a); }
  };
  A.applyVolumes = function () {
    if (!A.ctx) return;
    var t = A.ctx.currentTime, off = A.muted || A.adMuted;
    A.master.gain.setTargetAtTime(off ? 0 : 1, t, 0.05);
    A.music.gain.setTargetAtTime(A.musicVol * 0.55, t, 0.05);
    A.sfx.gain.setTargetAtTime(A.sfxVol, t, 0.05);
  };
  A.setVolumes = function (m, s) { A.musicVol = m; A.sfxVol = s; A.applyVolumes(); };
  A.setMuted = function (m) { A.muted = !!m; A.applyVolumes(); };
  A.setAdMuted = function (m) { A.adMuted = !!m; A.applyVolumes(); };
  A.suspend = function () { A.suspended = true; if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); };
  A.resume = function () { A.suspended = false; if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };

  // ------------------------------------------------------------ primitives
  // tone({type,f,f2,d,v,a,delay,dest,vib})
  A.tone = function (o) {
    if (!A.ctx) return;
    var c = A.ctx, t = c.currentTime + (o.delay || 0) + (o.at ? o.at - c.currentTime : 0);
    if (o.at) t = o.at;
    var osc = c.createOscillator(), g = c.createGain(), d = o.d || 0.1, v = o.v || 0.2;
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.slide || d));
    if (o.vib) { var l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vibF || 6; lg.gain.value = o.vib; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + d + 0.05); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.a || 0.005));
    if (o.hold) g.gain.setValueAtTime(v, t + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g);
    if (o.filter) { var f = c.createBiquadFilter(); f.type = o.filter; f.frequency.value = o.ff || 1000; f.Q.value = o.q || 1; g.connect(f); f.connect(o.dest || A.sfx); }
    else g.connect(o.dest || A.sfx);
    osc.start(t); osc.stop(t + d + 0.02);
  };
  // noise({d,v,type,f,f2,q,a,delay,dest})
  A.noise = function (o) {
    if (!A.ctx) return;
    var c = A.ctx, t = o.at || (c.currentTime + (o.delay || 0));
    var src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), d = o.d || 0.1;
    src.buffer = A.noiseBuf; src.loop = true;
    f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f || 1000, t); f.Q.value = o.q || 1;
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.v || 0.2, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(o.dest || A.sfx);
    src.start(t, Math.random() * 0.5); src.stop(t + d + 0.05);
  };
  function nf(n) { // note name -> frequency, e.g. 'C#5'
    var m = /^([A-G])(#|b)?(-?\d)$/.exec(n); if (!m) return 0;
    var semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (semi + (parseInt(m[3], 10) + 1) * 12 - 69) / 12);
  }
  A.nf = nf;

  // ------------------------------------------------------------ sound effects
  var FX = {
    click: function () { A.tone({ f: 880, f2: 660, d: 0.05, v: 0.12 }); },
    launch: function (p) {
      p = p || 0.5;
      A.noise({ type: 'bandpass', f: 500, f2: 2500, d: 0.25, v: 0.25 * (0.5 + p), q: 2 });
      A.tone({ f: 180 + p * 80, f2: 520 + p * 300, d: 0.14, v: 0.12 });
    },
    land: function () { A.noise({ f: 400, f2: 100, d: 0.12, v: 0.35 }); A.tone({ type: 'sine', f: 140, f2: 60, d: 0.1, v: 0.3 }); },
    leaves: function () { for (var i = 0; i < 4; i++) A.noise({ type: 'bandpass', f: 3000 + i * 400, d: 0.07, v: 0.12, delay: i * 0.035, q: 3 }); },
    sand: function () { A.noise({ type: 'highpass', f: 1500, d: 0.12, v: 0.12 }); A.tone({ type: 'sine', f: 120, f2: 60, d: 0.08, v: 0.2 }); },
    wood: function () { A.tone({ type: 'square', f: 220, f2: 110, d: 0.07, v: 0.12 }); A.noise({ f: 800, d: 0.05, v: 0.2 }); },
    cling: function () { A.tone({ type: 'square', f: 160, f2: 90, d: 0.06, v: 0.14 }); A.noise({ type: 'bandpass', f: 1200, d: 0.08, v: 0.2 }); },
    vine: function () { A.tone({ type: 'triangle', f: 330, f2: 180, d: 0.18, v: 0.25, vib: 12, vibF: 18 }); A.noise({ type: 'bandpass', f: 2500, d: 0.1, v: 0.1 }); },
    bounce: function () { A.tone({ type: 'square', f: 140, f2: 620, d: 0.22, v: 0.14 }); A.tone({ type: 'sine', f: 90, f2: 300, d: 0.2, v: 0.25 }); },
    crack: function () { for (var i = 0; i < 3; i++) A.noise({ type: 'highpass', f: 2000, d: 0.03, v: 0.25, delay: i * 0.06 }); },
    break: function () { A.noise({ type: 'bandpass', f: 1500, f2: 300, d: 0.35, v: 0.35 }); A.tone({ f: 200, f2: 60, d: 0.3, v: 0.1 }); },
    splash: function () { A.noise({ f: 2500, f2: 300, d: 0.6, v: 0.4 }); A.tone({ type: 'sine', f: 600, f2: 120, d: 0.25, v: 0.15 }); },
    hurt: function () { A.tone({ f: 520, f2: 90, d: 0.45, v: 0.16, vib: 30, vibF: 20 }); },
    sizzle: function () { A.noise({ type: 'highpass', f: 3000, d: 0.6, v: 0.25 }); A.tone({ f: 300, f2: 60, d: 0.5, v: 0.1 }); },
    collect: function () { ['C6', 'E6', 'G6', 'C7'].forEach(function (n, i) { A.tone({ f: nf(n), d: 0.09, v: 0.12, delay: i * 0.055 }); }); },
    page: function () { A.noise({ type: 'bandpass', f: 4000, d: 0.15, v: 0.15, q: 2 }); ['G5', 'C6', 'E6', 'G6', 'C7'].forEach(function (n, i) { A.tone({ type: 'triangle', f: nf(n), d: 0.18, v: 0.2, delay: 0.1 + i * 0.07 }); }); },
    checkpoint: function () { A.noise({ f: 600, f2: 3000, d: 0.4, v: 0.25 }); ['E5', 'A5'].forEach(function (n, i) { A.tone({ type: 'triangle', f: nf(n), d: 0.2, v: 0.2, delay: 0.1 + i * 0.1 }); }); },
    star: function (i) { A.tone({ f: nf(['E6', 'G6', 'C7'][i || 0]), d: 0.25, v: 0.14 }); A.tone({ type: 'triangle', f: nf(['E5', 'G5', 'C6'][i || 0]), d: 0.3, v: 0.2 }); },
    fanfare: function () {
      var seq = [['G4', 0, 0.12], ['C5', 0.12, 0.12], ['E5', 0.24, 0.12], ['G5', 0.36, 0.24], ['E5', 0.6, 0.12], ['G5', 0.72, 0.6]];
      seq.forEach(function (s) { A.tone({ f: nf(s[0]), d: s[2] + 0.05, v: 0.13, delay: s[1], hold: s[2] * 0.7 }); A.tone({ type: 'triangle', f: nf(s[0]) / 2, d: s[2], v: 0.2, delay: s[1] }); });
      [0, 0.36, 0.72].forEach(function (t) { A.noise({ type: 'highpass', f: 5000, d: 0.05, v: 0.15, delay: t }); });
    },
    fail: function () { ['E4', 'D#4', 'D4', 'C#4'].forEach(function (n, i) { A.tone({ f: nf(n), d: 0.25, v: 0.12, delay: i * 0.22, vib: 6 }); }); },
    // "AaaAAaa!" — sawtooth through a vowel formant with a Tarzan-like pitch contour
    yell: function () {
      if (!A.ctx) return;
      var c = A.ctx, t = c.currentTime, o = c.createOscillator(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth';
      var pts = [[0, 330], [0.12, 440], [0.3, 390], [0.42, 520], [0.6, 470], [0.75, 560], [0.95, 400]];
      o.frequency.setValueAtTime(pts[0][1], t);
      pts.forEach(function (p) { o.frequency.linearRampToValueAtTime(p[1], t + p[0]); });
      var l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 9; lg.gain.value = 14; l.connect(lg); lg.connect(o.frequency);
      f1.type = 'bandpass'; f1.frequency.value = 850; f1.Q.value = 5;
      f2.type = 'bandpass'; f2.frequency.value = 1250; f2.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.05); g.gain.setValueAtTime(0.5, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(A.sfx);
      o.start(t); l.start(t); o.stop(t + 1.05); l.stop(t + 1.05);
    },
    throw: function () { A.noise({ type: 'bandpass', f: 800, f2: 2000, d: 0.2, v: 0.15 }); A.tone({ type: 'square', f: 700, f2: 900, d: 0.08, v: 0.06 }); },
    nut: function () { A.tone({ type: 'square', f: 300, f2: 120, d: 0.06, v: 0.12 }); A.noise({ f: 1200, d: 0.08, v: 0.2 }); },
    snap: function () { A.tone({ type: 'square', f: 90, f2: 60, d: 0.1, v: 0.18 }); A.noise({ type: 'highpass', f: 1800, d: 0.04, v: 0.2 }); },
    thunder: function () { A.noise({ f: 700, f2: 60, d: 2.2, v: 0.6, a: 0.02 }); A.noise({ type: 'highpass', f: 2000, d: 0.15, v: 0.4 }); },
    crash: function () { A.noise({ f: 1500, f2: 80, d: 1.4, v: 0.6 }); for (var i = 0; i < 6; i++) A.tone({ type: 'square', f: 120 + i * 40, f2: 40, d: 0.3, v: 0.08, delay: i * 0.08 }); },
    wave: function () { A.noise({ f: 350, f2: 900, d: 1.6, v: 0.18, a: 0.6 }); },
    gull: function () { for (var i = 0; i < 3; i++) A.tone({ type: 'triangle', f: 1400, f2: 900, d: 0.14, v: 0.06, delay: i * 0.18, dest: A.amb }); },
    fire: function () { A.noise({ f: 800, f2: 200, d: 1.2, v: 0.2, a: 0.1 }); },
    horn: function () { A.tone({ type: 'sawtooth', f: 110, d: 1.4, v: 0.12, a: 0.1, hold: 1.1, filter: 'lowpass', ff: 600 }); A.tone({ type: 'sawtooth', f: 138.6, d: 1.4, v: 0.08, a: 0.1, hold: 1.1, filter: 'lowpass', ff: 600 }); }
  };
  A.play = function (name, arg) { if (A.ctx && FX[name]) try { FX[name](arg); } catch (e) { /* ignore */ } };

  // Rising "rubber band" tone while aiming. power in [0,1].
  A.stretch = function (p) {
    if (!A.ctx) return;
    var c = A.ctx, t = c.currentTime;
    if (!A.str) {
      var o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = 'square'; f.type = 'lowpass'; f.frequency.value = 1400;
      g.gain.value = 0.0001; o.connect(f); f.connect(g); g.connect(A.sfx); o.start();
      A.str = { o: o, g: g };
    }
    A.str.o.frequency.setTargetAtTime(160 + p * 520, t, 0.03);
    A.str.g.gain.setTargetAtTime(0.018 + p * 0.03, t, 0.03);
  };
  A.stretchStop = function () {
    if (!A.str) return;
    var s = A.str; A.str = null;
    s.g.gain.setTargetAtTime(0.0001, A.ctx.currentTime, 0.02);
    s.o.stop(A.ctx.currentTime + 0.15);
  };

  // ------------------------------------------------------------ music
  // Tracks are strings of 8th-note steps: note | '.' rest | '-' hold previous.
  // Drums: k kick, s snare, h hat, x shaker, b bongo hi, c bongo lo.
  var SONGS = {
    title: {
      bpm: 84,
      lead: 'E5 - - - D5 C5 - - C5 - - - A4 - - - G4 - - - C5 - E5 - D5 - - - - - . . E5 - - - G5 - E5 - F5 - - - E5 - C5 - B4 - - - D5 - C5 B4 G#4 - - - - - . .',
      bass: 'A2 - - - E3 - - - F2 - - - C3 - - - C3 - - - G2 - - - G2 - - - D3 - - - A2 - - - E3 - - - F2 - - - C3 - - - E2 - - - B2 - - - E2 - - - G#2 - - -',
      mar: 'A4 C5 E5 C5 A4 C5 E5 C5 F4 A4 C5 A4 F4 A4 C5 A4 C4 E4 G4 E4 C4 E4 G4 E4 G4 B4 D5 B4 G4 B4 D5 B4 A4 C5 E5 C5 A4 C5 E5 C5 F4 A4 C5 A4 F4 A4 C5 A4 E4 G#4 B4 G#4 E4 G#4 B4 G#4 E4 G#4 B4 G#4 E4 G#4 B4 G#4',
      drum: 'k . x . c . x . k . x . c . x b'
    },
    jungle: {
      bpm: 118,
      lead: 'A4 - D5 - E5 - F5 - G5 - - - F5 E5 D5 - E5 - - - A4 - - - B4 - D5 - - - . . C5 - - - A4 - C5 - E5 - - - D5 - C5 - D5 - - - - - . . C#5 - - - E5 - - -',
      bass: 'D2 . D3 . A2 . D3 C3 G2 . G3 . D3 . G3 F3 D2 . D3 . A2 . D3 C3 G2 . G3 . D3 . G3 F3 F2 . F3 . C3 . F3 . C3 . C3 . G2 . C3 . D2 . D3 . A2 . D3 . A2 . A3 . E3 . C#3 .',
      mar: 'D5 . F5 A5 . F5 D5 . B4 . D5 G5 . D5 B4 . D5 . F5 A5 . F5 D5 . B4 . D5 G5 . D5 B4 . A4 . C5 F5 . C5 A4 . G4 . C5 E5 . C5 G4 . D5 . F5 A5 . F5 D5 . A4 . C#5 E5 . C#5 A4 .',
      drum: 'k . b c k b c b k . b c k b c x'
    },
    rescue: {
      bpm: 96,
      lead: 'E5 - G5 - C6 - - - B5 - G5 - D5 - - - C5 - E5 - A5 - - - G5 - - - - - . . F5 - A5 - C6 - - - B5 - G5 - E5 - D5 - C5 - - - - - - - - - . .',
      bass: 'C3 - G2 - C3 - G2 - G2 - D3 - G2 - D3 - A2 - E3 - A2 - E3 - F2 - C3 - F2 - C3 - F2 - C3 - F2 - C3 - G2 - D3 - G2 - D3 - C3 - G2 - C3 - - -',
      mar: 'C5 E5 G5 E5 C5 E5 G5 E5 B4 D5 G5 D5 B4 D5 G5 D5 A4 C5 E5 C5 A4 C5 E5 C5 F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4 G4 B4 D5 B4 G4 B4 D5 B4 C5 E5 G5 E5 C5 E5 G5 E5 C5 E5 G5 E5 C5 . . .',
      drum: 'k . x . s . x . k . x k s . x x'
    },
    storm: {
      bpm: 70,
      lead: '',
      bass: 'A1 - - - - - - - G1 - - - - - - - F1 - - - - - - - E1 - - - - - - -',
      mar: 'A3 . . . E4 . . . G3 . . . D4 . . . F3 . . . C4 . . . E3 . . . G#3 . . .',
      drum: 'k . . . . . . . k . . . . . k .'
    }
  };
  function parse(s) { return s ? s.split(/\s+/).filter(Boolean) : []; }
  A.playSong = function (name, transpose) {
    if (A.songName === name + (transpose || 0) && A.song) return;
    if (!A.ctx) { A.pendingSong = name; return; }
    var d = SONGS[name]; if (!d) { A.song = null; A.songName = ''; return; }
    A.song = { bpm: d.bpm, lead: parse(d.lead), bass: parse(d.bass), mar: parse(d.mar), drum: parse(d.drum), tr: Math.pow(2, (transpose || 0) / 12) };
    A.songName = name + (transpose || 0); A.step = 0; A.nextTime = A.ctx.currentTime + 0.1;
  };
  A.stopSong = function () { A.song = null; A.songName = ''; };
  function holdLen(track, i) { var n = 1; while (track.length && track[(i + n) % track.length] === '-' && n < 16) n++; return n; }
  function schedStep(s, i, t, stepDur) {
    var tr = s.tr, tok, n;
    if (s.lead.length) { tok = s.lead[i % s.lead.length]; if (tok !== '.' && tok !== '-') { n = holdLen(s.lead, i % s.lead.length); A.tone({ at: t, f: nf(tok) * tr, d: stepDur * n * 0.95, v: 0.07, hold: stepDur * n * 0.6, vib: n > 2 ? 4 : 0, vibF: 5, dest: A.music }); } }
    if (s.bass.length) { tok = s.bass[i % s.bass.length]; if (tok !== '.' && tok !== '-') { n = holdLen(s.bass, i % s.bass.length); A.tone({ at: t, type: 'triangle', f: nf(tok) * tr, d: stepDur * n * 0.9, v: 0.22, hold: stepDur * n * 0.5, dest: A.music }); } }
    if (s.mar.length) { tok = s.mar[i % s.mar.length]; if (tok !== '.' && tok !== '-') { var f = nf(tok) * tr; A.tone({ at: t, type: 'triangle', f: f, d: 0.28, v: 0.12, dest: A.music }); A.tone({ at: t, type: 'sine', f: f * 4, d: 0.05, v: 0.03, dest: A.music }); } }
    if (s.drum.length) {
      tok = s.drum[i % s.drum.length];
      if (tok === 'k') A.tone({ at: t, type: 'sine', f: 150, f2: 45, d: 0.16, v: 0.4, dest: A.music });
      else if (tok === 's') A.noise({ at: t, type: 'highpass', f: 1500, d: 0.12, v: 0.2, dest: A.music });
      else if (tok === 'h') A.noise({ at: t, type: 'highpass', f: 7000, d: 0.03, v: 0.1, dest: A.music });
      else if (tok === 'x') A.noise({ at: t, type: 'bandpass', f: 6000, d: 0.05, v: 0.1, q: 2, dest: A.music });
      else if (tok === 'b') A.tone({ at: t, type: 'sine', f: 420, f2: 280, d: 0.09, v: 0.22, dest: A.music });
      else if (tok === 'c') A.tone({ at: t, type: 'sine', f: 260, f2: 170, d: 0.12, v: 0.25, dest: A.music });
    }
  }

  // ------------------------------------------------------------ ambience
  // kinds: beach | jungle | dusk | river | storm | volcano | ''
  A.setAmbient = function (kind) {
    if (!A.ctx) { A.pendingAmb = kind; return; }
    if (kind === A.ambKind) return;
    A.ambKind = kind;
    A.loops.forEach(function (l) { try { l.g.gain.setTargetAtTime(0.0001, A.ctx.currentTime, 0.3); l.s.stop(A.ctx.currentTime + 1.5); } catch (e) { /* ignore */ } });
    A.loops = [];
    function loop(type, f, v, q) {
      var c = A.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      s.buffer = A.noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q || 0.7;
      g.gain.value = 0.0001; g.gain.setTargetAtTime(v, c.currentTime, 0.8);
      s.connect(fl); fl.connect(g); g.connect(A.amb); s.start();
      A.loops.push({ s: s, g: g, f: fl });
    }
    if (kind === 'river') loop('lowpass', 900, 0.08);
    if (kind === 'storm') { loop('highpass', 3000, 0.12); loop('bandpass', 400, 0.12, 0.8); }
    if (kind === 'volcano') loop('lowpass', 120, 0.25);
  };
  function ambientTick(dt) {
    var k = A.ambKind; if (!k) return;
    A.ambTimer -= dt; if (A.ambTimer > 0) return;
    var r = Math.random();
    if (k === 'beach') { if (r < 0.55) FX.wave(); else if (r < 0.8) FX.gull(); else bird(); A.ambTimer = 1.4 + Math.random() * 2; }
    else if (k === 'jungle' || k === 'river') { if (r < 0.7) bird(); else parrot(); A.ambTimer = 0.8 + Math.random() * 2.2; }
    else if (k === 'dusk') { cricket(); if (r < 0.3) bird(); A.ambTimer = 0.9 + Math.random(); }
    else if (k === 'storm') { A.ambTimer = 2 + Math.random() * 3; }
    else A.ambTimer = 2;
  }
  function bird() {
    var base = 1800 + Math.random() * 1400, n = 2 + (Math.random() * 4 | 0);
    for (var i = 0; i < n; i++) A.tone({ type: 'sine', f: base, f2: base * (Math.random() < 0.5 ? 1.4 : 0.7), d: 0.07, v: 0.05, delay: i * 0.1, dest: A.amb });
  }
  function parrot() { A.tone({ type: 'square', f: 900, f2: 1500, d: 0.12, v: 0.03, dest: A.amb, filter: 'bandpass', ff: 1400 }); A.tone({ type: 'square', f: 1400, f2: 800, d: 0.15, v: 0.03, delay: 0.14, dest: A.amb, filter: 'bandpass', ff: 1400 }); }
  function cricket() { for (var i = 0; i < 6; i++) A.tone({ type: 'square', f: 4200, d: 0.025, v: 0.015, delay: i * 0.05, dest: A.amb }); }

  // ------------------------------------------------------------ scheduler
  var lastT = 0;
  A.tick = function () {
    if (!A.ctx || A.ctx.state !== 'running') return;
    var now = A.ctx.currentTime;
    ambientTick(lastT ? now - lastT : 0); lastT = now;
    var s = A.song; if (!s) return;
    var stepDur = 60 / s.bpm / 2;
    if (A.nextTime < now - 0.2) A.nextTime = now + 0.05;
    while (A.nextTime < now + 0.12) { schedStep(s, A.step, A.nextTime, stepDur); A.step++; A.nextTime += stepDur; }
  };
})();
