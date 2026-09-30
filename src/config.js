// Global namespace + tunables. Everything in the game hangs off window.Z.
'use strict';
var Z = window.Z = window.Z || {};

Z.CONFIG = {
  // Poki SDK: 'auto' enables it when the page runs on Poki (or ?poki=1), true forces it on,
  // false disables it completely (no SDK script is loaded, all ad calls resolve immediately).
  poki: 'auto',
  pokiSdkUrl: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js',
  debug: /[?&]debug=1/.test(location.search),

  shiftSeconds: 300,          // one shift = 5 minutes
  extendSeconds: 60,          // rewarded "extend shift"
  gameMinutesPerSecond: 1.2,  // in-game clock speed (5 min shift = 6 h of game time)
  shiftStarts: [7, 15, 20.5], // shift start hours, cycled (day, afternoon rush, night)

  // camera / rendering
  zoomNear: 7.2,              // px per metre at 1280px width, standing still
  zoomFar: 4.0,               // px per metre at high speed
  lookAhead: 0.9,             // seconds of velocity the camera leads by
  tileM: 64,                  // tile size in world metres
  maxTiles: 64,

  // traffic
  trafficRadius: 430,
  trafficBase: 70,
  sirenRange: 105,
  distractedShare: 0.075,
};

Z.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
Z.lerp = function (a, b, t) { return a + (b - a) * t; };
Z.rand = function (a, b) { return a + Math.random() * (b - a); };
Z.pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };
Z.angDiff = function (a, b) { var d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
Z.mulberry = function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
Z.hash2 = function (x, y) { var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
Z.fmtTime = function (s) { s = Math.max(0, Math.ceil(s)); return (s / 60 | 0) + ':' + ('0' + s % 60).slice(-2); };
Z.fmtDist = function (m) { return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : (Math.round(m / 10) * 10) + ' m'; };
