// ============================================================================
//  sdk.js — CrazyGames SDK v3 wrapper with safe fallbacks.
//  Everything works without the SDK (file://, offline, other portals):
//  ads are skipped (rewarded ads grant the reward in dev mode) and saving
//  falls back to localStorage.
// ============================================================================
'use strict';
(function () {
  var S = Z.SDK = { sdk: null, env: 'none', ready: false, playing: false, adActive: false, lastMidgame: 0 };

  function call(fn) { try { return fn(); } catch (e) { console.warn('[SDK]', e); } }

  S.init = function () {
    return new Promise(function (resolve) {
      var cg = window.CrazyGames && window.CrazyGames.SDK;
      if (!cg) { resolve(); return; }
      var done = false, to = setTimeout(function () { if (!done) { done = true; resolve(); } }, 4000);
      Promise.resolve().then(function () { return cg.init(); }).then(function () {
        S.sdk = cg; S.env = cg.environment || 'crazygames'; S.ready = S.env !== 'disabled';
        if (S.ready) {
          call(function () {
            Z.Audio.setMuted(!!(cg.game.settings && cg.game.settings.muteAudio));
            cg.game.addSettingsChangeListener(function (st) { Z.Audio.setMuted(!!st.muteAudio); });
          });
        }
      }).catch(function (e) { console.warn('[SDK] init failed', e); }).then(function () {
        if (!done) { done = true; clearTimeout(to); resolve(); }
      });
    });
  };
  S.loadingStart = function () { if (S.ready) call(function () { S.sdk.game.loadingStart(); }); };
  S.loadingStop = function () { if (S.ready) call(function () { S.sdk.game.loadingStop(); }); };
  S.gameplayStart = function () { if (S.playing || S.adActive) return; S.playing = true; if (S.ready) call(function () { S.sdk.game.gameplayStart(); }); };
  S.gameplayStop = function () { if (!S.playing) return; S.playing = false; if (S.ready) call(function () { S.sdk.game.gameplayStop(); }); };
  S.happytime = function () { if (S.ready) call(function () { S.sdk.game.happytime(); }); };

  // type: 'midgame' | 'rewarded'. cb(success)
  function ad(type, cb) {
    if (!S.ready) { cb(type === 'rewarded' ? 'dev' : false); return; }
    var wasPlaying = S.playing, finished = false;
    function end(ok) {
      if (finished) return; finished = true;
      S.adActive = false; Z.Audio.setAdMuted(false);
      if (wasPlaying) S.gameplayStart();
      cb(ok);
    }
    S.gameplayStop();
    call(function () {
      S.sdk.ad.requestAd(type, {
        adStarted: function () { S.adActive = true; Z.Audio.setAdMuted(true); },
        adFinished: function () { end(true); },
        adError: function (e) { console.warn('[SDK] ad error', e); end(false); }
      });
    });
  }
  // Midgame ads only between chapters (caller decides) and at most every 3 min.
  S.midgame = function (cb) {
    var now = Date.now();
    if (now - S.lastMidgame < 180000) { cb(false); return; }
    S.lastMidgame = now;
    ad('midgame', cb);
  };
  S.rewarded = function (cb) { ad('rewarded', cb); };

  // ------------------------------------------------------------ data module
  S.getItem = function (k) {
    if (S.ready && S.sdk.data) { var v = call(function () { return S.sdk.data.getItem(k); }); if (v !== undefined && v !== null) return v; }
    try { return window.localStorage.getItem(k); } catch (e) { return null; }
  };
  S.setItem = function (k, v) {
    if (S.ready && S.sdk.data) call(function () { S.sdk.data.setItem(k, v); });
    try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ }
  };
})();
