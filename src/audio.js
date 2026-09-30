// All sound is synthesised with Web Audio – no audio files to download.
// Siren: Czech-style two-tone (hi-lo) or "wail"; engine hum; horn; crash/kerb noises; UI blips.
'use strict';
(function () {
  var ctx = null, master = null, sfx = null, duckGain = null, noiseBuf = null;
  var siren = null, engine = null, horn = null;
  var muted = false, ducked = false;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.8;
    duckGain = ctx.createGain(); duckGain.gain.value = 1;
    var comp = ctx.createDynamicsCompressor();
    master.connect(duckGain); duckGain.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 1; sfx.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolume();
    return true;
  }
  function applyVolume() { if (master) master.gain.setTargetAtTime(muted || !Z.save.sound ? 0 : 0.8, ctx.currentTime, 0.05); }

  // ---------------------------------------------------------------- siren
  function makeSiren() {
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'square'; o2.type = 'sawtooth';
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; f.Q.value = 0.7;
    var g = ctx.createGain(); g.gain.value = 0;
    var m2 = ctx.createGain(); m2.gain.value = 0.35;
    o1.connect(f); o2.connect(m2); m2.connect(f); f.connect(g); g.connect(sfx);
    o1.start(); o2.start();
    return { o1: o1, o2: o2, g: g, on: false, next: 0, phase: 0, vol: 0.16 };
  }
  function scheduleSiren() {
    if (!siren || !siren.on) return;
    var now = ctx.currentTime;
    var mode = Z.save.sirenMode | 0;
    while (siren.next < now + 0.25) {
      var t = Math.max(siren.next, now);
      if (mode === 0) { // two-tone hi-lo (≈ 440 / 587 Hz, 0.55 s each)
        var fr = siren.phase % 2 ? 440 : 587;
        siren.o1.frequency.setValueAtTime(fr, t); siren.o2.frequency.setValueAtTime(fr * 1.005, t);
        siren.next = t + 0.55;
      } else { // wail: slow sweep up and down
        var up = siren.phase % 2 === 0;
        siren.o1.frequency.setValueAtTime(up ? 650 : 1450, t);
        siren.o1.frequency.linearRampToValueAtTime(up ? 1450 : 650, t + 2.1);
        siren.o2.frequency.setValueAtTime(up ? 652 : 1455, t);
        siren.o2.frequency.linearRampToValueAtTime(up ? 1455 : 652, t + 2.1);
        siren.next = t + 2.1;
      }
      siren.phase++;
    }
  }

  Z.audio = {
    unlock: function () { ensure(); },
    setMuted: function (m) { muted = m; if (ctx) applyVolume(); },
    refreshVolume: function () { if (ctx) applyVolume(); },
    duck: function (d) { ducked = d; if (ctx) duckGain.gain.setTargetAtTime(d ? 0 : 1, ctx.currentTime, 0.05); },
    siren: function (on, vol) {
      if (!ensure()) return;
      if (!siren) siren = makeSiren();
      if (vol != null) siren.vol = vol;
      if (on && !siren.on) { siren.on = true; siren.next = ctx.currentTime; siren.phase = 0; scheduleSiren(); siren.o1.frequency.cancelScheduledValues(ctx.currentTime); }
      if (!on && siren.on) { siren.on = false; siren.o1.frequency.cancelScheduledValues(ctx.currentTime); siren.o2.frequency.cancelScheduledValues(ctx.currentTime); }
      siren.g.gain.setTargetAtTime(on ? siren.vol : 0, ctx.currentTime, 0.04);
    },
    sirenModeChanged: function () { if (siren && siren.on) { siren.o1.frequency.cancelScheduledValues(ctx.currentTime); siren.o2.frequency.cancelScheduledValues(ctx.currentTime); siren.next = ctx.currentTime; } },
    engine: function (speed, throttle, on) {
      if (!ctx) return;
      if (!engine) {
        var o = ctx.createOscillator(); o.type = 'sawtooth';
        var o2 = ctx.createOscillator(); o2.type = 'triangle';
        var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
        var g = ctx.createGain(); g.gain.value = 0;
        o.connect(f); o2.connect(f); f.connect(g); g.connect(sfx); o.start(); o2.start();
        engine = { o: o, o2: o2, f: f, g: g };
      }
      var gear = speed < 12 ? speed / 12 : speed < 26 ? (speed - 12) / 14 : speed < 40 ? (speed - 26) / 14 : (speed - 40) / 20;
      var rpm = 38 + gear * 55 + throttle * 12;
      var t = ctx.currentTime;
      engine.o.frequency.setTargetAtTime(rpm, t, 0.08);
      engine.o2.frequency.setTargetAtTime(rpm * 0.5, t, 0.08);
      engine.f.frequency.setTargetAtTime(300 + throttle * 500 + speed * 6, t, 0.1);
      engine.g.gain.setTargetAtTime(on ? 0.035 + throttle * 0.035 : 0, t, 0.1);
    },
    horn: function (on) {
      if (!ensure()) return;
      if (!horn) {
        var a = ctx.createOscillator(), b = ctx.createOscillator(); a.type = b.type = 'square';
        a.frequency.value = 392; b.frequency.value = 494;
        var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
        var g = ctx.createGain(); g.gain.value = 0;
        a.connect(f); b.connect(f); f.connect(g); g.connect(sfx); a.start(); b.start();
        horn = { g: g };
      }
      horn.g.gain.setTargetAtTime(on ? 0.09 : 0, ctx.currentTime, 0.02);
    },
    noise: function (dur, vol, freq, q) {
      if (!ctx) return;
      var s = ctx.createBufferSource(); s.buffer = noiseBuf;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 900; f.Q.value = q || 0.8;
      var g = ctx.createGain(), t = ctx.currentTime;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f); f.connect(g); g.connect(sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    },
    crash: function (strength) { Z.audio.noise(0.35 + strength * 0.3, Z.clamp(0.15 + strength * 0.5, 0.1, 0.8), 700 + strength * 900); Z.audio.tone(70, 0.2, 0.25 * strength, 'sine'); },
    bump: function () { Z.audio.tone(55, 0.12, 0.2, 'sine'); Z.audio.noise(0.08, 0.08, 300); },
    tone: function (freq, dur, vol, type, slideTo) {
      if (!ctx) return;
      var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(sfx); o.start(t); o.stop(t + dur + 0.05);
    },
    blip: function (k) {
      if (!ctx) return;
      if (k === 'good') { Z.audio.tone(660, 0.12, 0.12, 'triangle'); setTimeout(function () { Z.audio.tone(990, 0.16, 0.12, 'triangle'); }, 90); }
      else if (k === 'bad') Z.audio.tone(220, 0.25, 0.14, 'square', 140);
      else if (k === 'dispatch') { [880, 660, 880].forEach(function (f, i) { setTimeout(function () { Z.audio.tone(f, 0.12, 0.1, 'sine'); }, i * 140); }); }
      else if (k === 'coin') { Z.audio.tone(1200, 0.08, 0.08, 'triangle'); setTimeout(function () { Z.audio.tone(1600, 0.12, 0.08, 'triangle'); }, 70); }
      else if (k === 'beat') Z.audio.tone(120, 0.12, 0.25, 'sine', 60);
      else Z.audio.tone(760, 0.06, 0.08, 'triangle');
    },
    update: function () { if (ctx && siren) scheduleSiren(); },
    stopAll: function () { Z.audio.siren(false); Z.audio.horn(false); if (engine) engine.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); },
  };
})();
