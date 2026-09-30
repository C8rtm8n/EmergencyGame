#!/usr/bin/env node
// ============================================================================
//  Level solver: breadth-first search over resting positions using the real
//  game physics (js/world.js). Prints the minimum number of launches needed for
//  every level and a suggested star rating. Moving actors (monkeys, crabs) are
//  disabled because they are time dependent.
//  Usage: node tools/solve.js [levelId]
// ============================================================================
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, globalThis: null };
ctx.globalThis = ctx; ctx.window = ctx;
vm.createContext(ctx);
['js/config.js', 'js/levels.js', 'js/world.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const Z = ctx.Z, P = Z.P;

const ANG = [], POW = [];
for (let a = -175; a <= 5; a += 5) ANG.push(a * Math.PI / 180);
for (let p = 0.3; p <= 1.001; p += 0.1) POW.push(p);

function keyOf(w) {
  const h = w.hero;
  if (h.st === 'swing') return 's' + w.vines.indexOf(h.swing.v) + ':' + Math.round(h.swing.r / 6) + ':' + Math.round(h.swing.v.ang * 5) + ':' + Math.round(h.swing.v.av * 2);
  return h.st[0] + Math.round(h.x / 5) + ':' + Math.round(h.y / 5);
}

// simulate until rest / death / win
function run(w, maxT) {
  const dt = P.dt;
  for (let t = 0; t < maxT; t += dt) {
    w.step(dt);
    const s = w.hero.st;
    if (w.won) return 'win';
    if (s === 'dead') return 'dead';
    if (s === 'idle' || s === 'cling' || s === 'swing') return 'rest';
  }
  return 'timeout';
}

function solve(lv) {
  const w = new Z.World(lv, { noActors: true });
  w.jumps = 99;
  const start = w.snapshot();
  let frontier = [start], seen = new Set([keyOf(w)]), depth = 0, sims = 0;
  while (frontier.length && depth < 20) {
    depth++;
    const next = [];
    for (const snap of frontier) {
      const releaseTimes = snap.st === 'swing' ? [] : [0];
      if (snap.st === 'swing') for (let t = 0; t <= 3.0; t += 0.15) releaseTimes.push(t);
      for (const rt of releaseTimes) {
        for (const a of (snap.st === 'swing' ? ANG.filter((_, i) => i % 3 === 0) : ANG)) {
          for (const p of (snap.st === 'swing' ? POW.filter((_, i) => i % 2 === 0) : POW)) {
            w.restore(snap);
            if (rt > 0) { let ok = true; for (let t = 0; t < rt; t += P.dt) { w.step(P.dt); if (w.hero.st !== 'swing') { ok = false; break; } } if (!ok) continue; }
            const vx = Math.cos(a) * p * P.vmax, vy = Math.sin(a) * p * P.vmax;
            if (!w.launch(vx, vy)) continue;
            sims++;
            const r = run(w, 6);
            if (r === 'win') return { min: depth, sims };
            if (r !== 'rest') continue;
            const k = keyOf(w);
            if (seen.has(k)) continue;
            seen.add(k);
            next.push(w.snapshot());
          }
        }
      }
    }
    frontier = next;
  }
  return { min: -1, sims };
}

const only = process.argv[2];
let bad = 0;
for (const lv of Z.LEVELS) {
  if (only && lv.id !== only) continue;
  const t0 = Date.now(), r = solve(lv);
  const left = lv.jumps - r.min;
  const ok = r.min > 0 && r.min <= lv.jumps;
  if (!ok) bad++;
  console.log(`${lv.id}  min launches: ${r.min < 0 ? 'UNSOLVABLE' : r.min}  bananas: ${lv.jumps}  spare: ${left}  stars(2,3 at left>=): [${lv.stars}]  ${ok ? 'OK' : 'FAIL'}  (${r.sims} sims, ${Date.now() - t0} ms)`);
}
process.exit(bad ? 1 : 0);
