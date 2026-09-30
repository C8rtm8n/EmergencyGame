// ============================================================================
//  ZTROSKOTANEC — config.js
//  Global namespace, resolution, physics tunables, palette and small helpers.
//  All game files attach themselves to the global `Z` object (plain <script>
//  tags, no bundler needed, works from file://).
// ============================================================================
'use strict';
var Z = (typeof window !== 'undefined' ? window : globalThis).Z = {};

// Internal (virtual) resolution. Everything is drawn into a 320x180 buffer and
// scaled up with nearest-neighbour filtering.
Z.W = 320;
Z.H = 180;

// Physics tunables (pixels, seconds).
Z.P = {
  g: 380,           // gravity
  vmax: 245,        // launch speed at full drag
  dragMax: 46,      // drag distance (internal px) that gives full power
  dragMin: 5,       // shorter drags are cancelled
  swingMix: 0.75,   // how much of the drag adds to vine momentum
  vmaxSwing: 315,   // cap for vine launches (momentum + drag)
  maxFall: 420,
  dt: 1 / 120,      // fixed physics step
  heroW: 8,         // collision box (feet anchored)
  heroH: 15,
  handUp: 21,       // hands are this far above the feet when hanging
  previewTime: 0.42 // seconds of trajectory shown while aiming
};

// ~30 colour palette. Chapters tint backgrounds with their own moods (bg.js).
Z.C = {
  ink: '#1a1423', night: '#2b2442', deep: '#3b3a6b', dusk: '#5a4a7a',
  sea: '#2f6fa8', seaD: '#23507e', seaL: '#4fa4d6', foam: '#cdeff5',
  sky: '#8fd3f0', white: '#fff6e0', grey: '#9a9aa8',
  sand: '#e8c77a', sandL: '#f6e2a4', sandD: '#c49a52',
  wood: '#8a5a33', woodD: '#5c3a22', woodL: '#b07a45', rope: '#d8b878',
  rock: '#7a7068', rockD: '#4e4640', rockL: '#a39a8c',
  leaf: '#3e8a3a', leafD: '#23572b', leafL: '#7cc04a', lime: '#b8e05a',
  skin: '#e9a877', skinD: '#b8704a', hair: '#4a2a1a',
  red: '#d0413c', redD: '#8c2433', orange: '#f08a2e', yellow: '#f7d64a',
  gold: '#e0a82e', purple: '#7a3d8f', pink: '#e87a9a',
  pants: '#4a6fa5', pantsD: '#34497a', parch: '#ecd9a8', parchD: '#c9a86a'
};

// ---------------------------------------------------------------- helpers
Z.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
Z.lerp = function (a, b, t) { return a + (b - a) * t; };
Z.rand = function (a, b) { return a + Math.random() * (b - a); };
Z.irand = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
Z.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
// Deterministic hash noise in [0,1) — used for textures so they never flicker.
Z.hash = function (x, y, s) {
  var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
Z.overlap = function (ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
};
Z.ease = function (t) { t = Z.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
