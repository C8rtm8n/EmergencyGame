// Thin wrapper around the Poki SDK. Toggle with Z.CONFIG.poki (true / false / 'auto').
// When disabled or blocked (ad blockers), every call is a no-op and ad breaks resolve
// immediately (rewarded breaks resolve to `true` only in debug so features stay testable).
'use strict';
(function () {
  var sdk = null, ready = false, playing = false;
  function wanted() {
    var c = Z.CONFIG.poki;
    if (c === true || /[?&]poki=1/.test(location.search)) return true;
    if (c === false) return false;
    return /poki/.test(location.hostname) || /poki/.test(document.referrer || '');
  }
  Z.poki = {
    enabled: false,
    init: function () {
      return new Promise(function (resolve) {
        if (!wanted()) return resolve(false);
        var s = document.createElement('script');
        s.src = Z.CONFIG.pokiSdkUrl;
        s.onload = function () {
          if (!window.PokiSDK) return resolve(false);
          sdk = window.PokiSDK;
          sdk.init().then(function () { ready = true; Z.poki.enabled = true; resolve(true); })
            .catch(function () { ready = true; Z.poki.enabled = true; resolve(true); }); // adblock: continue
          if (Z.CONFIG.debug && sdk.setDebug) sdk.setDebug(true);
        };
        s.onerror = function () { resolve(false); };
        document.head.appendChild(s);
      });
    },
    loadingFinished: function () { if (ready && sdk.gameLoadingFinished) sdk.gameLoadingFinished(); },
    gameplayStart: function () { if (playing) return; playing = true; if (ready) sdk.gameplayStart(); },
    gameplayStop: function () { if (!playing) return; playing = false; if (ready) sdk.gameplayStop(); },
    // Interstitial between shifts.
    commercialBreak: function () {
      Z.poki.gameplayStop();
      if (!ready) return Promise.resolve();
      Z.audio && Z.audio.duck(true);
      return sdk.commercialBreak().catch(function () {}).then(function () { Z.audio && Z.audio.duck(false); });
    },
    // Rewarded ad: resolves true when the reward should be granted.
    rewardedBreak: function () {
      Z.poki.gameplayStop();
      if (!ready) return Promise.resolve(!!Z.CONFIG.debug || !Z.poki.enabled);
      Z.audio && Z.audio.duck(true);
      return sdk.rewardedBreak().then(function (ok) { Z.audio && Z.audio.duck(false); return !!ok; })
        .catch(function () { Z.audio && Z.audio.duck(false); return false; });
    },
  };
})();
