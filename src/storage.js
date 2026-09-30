// Persistent save. localStorage is used only inside try/catch so the game runs in
// private mode / with storage blocked (progress then simply lasts for the session).
'use strict';
(function () {
  var KEY = 'zachranka155.v1';
  var DEF = {
    lang: null, sound: 1, music: 1, sirenMode: 0,
    xp: 0, coins: 0, shifts: 0, best: 0, bestClean: 0, saved: 0,
    upg: { engine: 0, susp: 0, siren: 0 },
    owned: ['van'], vehicle: 'van',
    rec: {},                 // best score per call type
    daily: { day: '', done: 0, prog: 0 },
    tutorial: 1,
  };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(a, b) { for (var k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); else a[k] = b[k]; } return a; }

  Z.save = clone(DEF);
  Z.loadSave = function () {
    try {
      var s = window.localStorage.getItem(KEY);
      if (s) Z.save = merge(clone(DEF), JSON.parse(s));
    } catch (e) { /* storage unavailable: keep defaults */ }
    return Z.save;
  };
  Z.writeSave = function () {
    try { window.localStorage.setItem(KEY, JSON.stringify(Z.save)); } catch (e) { /* ignore */ }
  };
  Z.resetSave = function () { Z.save = clone(DEF); Z.writeSave(); };
})();
