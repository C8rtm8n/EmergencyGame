// ============================================================================
//  save.js — progress + settings (CrazyGames data module, localStorage fallback)
//  levels[id] = { stars: 0..3 (0 = skipped), items: [index,...] }
// ============================================================================
'use strict';
(function () {
  var KEY = 'ztroskotanec_save_v1';
  var Save = Z.Save = {
    d: null,
    defaults: function () {
      return { levels: {}, seenIntro: false, memories: {}, chapterEnds: {},
        settings: { music: 0.7, sfx: 0.8, crt: false, lang: null } };
    },
    load: function () {
      var d = null;
      try { d = JSON.parse(Z.SDK.getItem(KEY) || 'null'); } catch (e) { d = null; }
      var def = Save.defaults();
      if (!d || typeof d !== 'object') d = def;
      Object.keys(def).forEach(function (k) { if (d[k] === undefined) d[k] = def[k]; });
      Object.keys(def.settings).forEach(function (k) { if (d.settings[k] === undefined) d.settings[k] = def.settings[k]; });
      Save.d = d;
      if (!d.settings.lang) d.settings.lang = /^(cs|sk)/i.test(navigator.language || '') ? 'cs' : 'en';
      Save.apply();
    },
    reset: function () { Z.SDK.setItem(KEY, ''); Save.load(); Save.write(); },
    write: function () { Z.SDK.setItem(KEY, JSON.stringify(Save.d)); },
    apply: function () {
      var s = Save.d.settings;
      Z.lang = s.lang;
      Z.Audio.setVolumes(s.music, s.sfx);
      Z.crt = !!s.crt;
    },
    level: function (id) { return Save.d.levels[id] || null; },
    // index of the furthest playable level
    unlocked: function () {
      var n = 0;
      for (var i = 0; i < Z.LEVELS.length; i++) { if (Save.d.levels[Z.LEVELS[i].id]) n = i + 1; else break; }
      return Math.min(n, Z.LEVELS.length - 1);
    },
    complete: function (id, stars, items) {
      var cur = Save.d.levels[id] || { stars: 0, items: [] };
      cur.stars = Math.max(cur.stars, stars);
      items.forEach(function (i) { if (cur.items.indexOf(i) < 0) cur.items.push(i); });
      Save.d.levels[id] = cur;
      Save.write();
    },
    hasItem: function (id, idx) { var l = Save.d.levels[id]; return !!(l && l.items.indexOf(idx) >= 0); },
    chapterItemsFound: function (ch) {
      var all = Z.chapterItems(ch), got = 0;
      all.forEach(function (k) { var p = k.split(':'); if (Save.hasItem(p[0], +p[1])) got++; });
      return { got: got, total: all.length };
    },
    pages: function () { // collected diary page numbers
      var out = [];
      Z.LEVELS.forEach(function (l) { (l.items || []).forEach(function (it, i) { if (it[2] === 'page' && Save.hasItem(l.id, i)) out.push(it[3]); }); });
      return out.sort(function (a, b) { return a - b; });
    },
    totalStars: function () { var s = 0; Object.keys(Save.d.levels).forEach(function (k) { s += Save.d.levels[k].stars; }); return s; }
  };
})();
