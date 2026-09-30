#!/usr/bin/env node
// Generates data/osm-sketch.json: an approximate, hand-traced model of Hradec Králové,
// the D11 to Jaroměř, Smiřice, Černožice and the old road I/33, written in the SAME
// format as an Overpass API JSON export ({elements:[node|way]}), so that
// tools/build-map.js treats it exactly like real OpenStreetMap data.
//
// Main roads, rivers and places are traced by hand (approximate positions);
// local streets are generated as grids inside neighbourhoods and noded to the
// main roads. Replace it with a real export (see tools/overpass-query.txt) any time.
'use strict';
const fs = require('fs');
const path = require('path');
const cfg = require('../map-config.json');

const LAT0 = cfg.origin.lat, LON0 = cfg.origin.lon;
const KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KY = 110540;
const XY = (lat, lon) => [(lon - LON0) * KX, (lat - LAT0) * KY];
const LL = (x, y) => [LAT0 + y / KY, LON0 + x / KX];

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(4242);

// ---------------------------------------------------------------- stores
const NODES = []; let nid = 1;
function mk(x, y, tags) { const n = { id: nid++, x, y, tags }; NODES.push(n); return n; }
const WAYS = []; let wid = 1;
// A way: {id, ns:[node], tags, nodable, cls}
function addWay(ns, tags, opts = {}) {
  const w = { id: wid++, ns, tags, nodable: opts.nodable !== false, grid: !!opts.grid, noBridge: !!opts.noBridge };
  WAYS.push(w); return w;
}
function wayLL(pts, tags, opts) {
  // pts: [lat,lon] pairs or existing node objects
  const ns = pts.map(p => (p && p.id) ? p : mk(...XY(p[0], p[1])));
  return addWay(ns, tags, opts);
}
const EXTRA = []; // extra elements (POIs, areas) as {type, ...}
function poi(lat, lon, tags) { const n = mk(...XY(lat, lon), tags); n.poi = true; return n; }
function area(ptsLL, tags) {
  const ns = ptsLL.map(p => mk(...XY(p[0], p[1])));
  ns.push(ns[0]);
  EXTRA.push({ ns, tags });
}
function areaXY(pts, tags) { const ns = pts.map(p => mk(p[0], p[1])); ns.push(ns[0]); EXTRA.push({ ns, tags }); }

// ---------------------------------------------------------------- geometry helpers
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = a => Math.hypot(a[0], a[1]);
function distPtSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  let t = L2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy), t };
}
function distPtLine(p, pts) { let m = 1e9; for (let i = 0; i + 1 < pts.length; i++) m = Math.min(m, distPtSeg(p, pts[i], pts[i + 1]).d); return m; }
function segX(p1, p2, p3, p4) {
  const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1], d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
  const den = d1x * d2y - d1y * d2x; if (Math.abs(den) < 1e-9) return null;
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / den;
  const u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / den;
  const e = 1e-6; if (t <= e || t >= 1 - e || u <= e || u >= 1 - e) return null;
  return { t, u };
}
function pip(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function resample(ptsXY, step) {
  const out = [ptsXY[0]];
  for (let i = 0; i + 1 < ptsXY.length; i++) {
    const a = ptsXY[i], b = ptsXY[i + 1], L = len(sub(b, a)), n = Math.max(1, Math.round(L / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
// Catmull-Rom smoothing so traced polylines look like roads, not zig-zags.
function smooth(ptsXY, seg = 4) {
  if (ptsXY.length < 3) return ptsXY;
  const out = [];
  for (let i = 0; i + 1 < ptsXY.length; i++) {
    const p0 = ptsXY[Math.max(0, i - 1)], p1 = ptsXY[i], p2 = ptsXY[i + 1], p3 = ptsXY[Math.min(ptsXY.length - 1, i + 2)];
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(ptsXY[ptsXY.length - 1]);
  return out;
}
const llToXY = pts => pts.map(p => XY(p[0], p[1]));

// ================================================================ WATER
const RIVERS = [];
function river(name, ptsLL, width) {
  const xy = smooth(llToXY(ptsLL), 5);
  RIVERS.push({ name, xy, width });
  const ns = xy.map(p => mk(p[0], p[1]));
  EXTRA.push({ ns, tags: { waterway: 'river', name, width: String(width) } });
}
river('Labe', [
  [50.3700, 15.9230], [50.3600, 15.9150], [50.3520, 15.9060], [50.3450, 15.9000], [50.3300, 15.8850],
  [50.3200, 15.8810], [50.3080, 15.8740], [50.3000, 15.8610], [50.2880, 15.8520], [50.2780, 15.8420],
  [50.2650, 15.8330], [50.2540, 15.8250], [50.2400, 15.8230], [50.2250, 15.8250], [50.2145, 15.8285],
  [50.2090, 15.8262], [50.2020, 15.8245], [50.1900, 15.8220], [50.1750, 15.8180], [50.1600, 15.8120]
], 45);
river('Orlice', [
  [50.1900, 15.9500], [50.1950, 15.9000], [50.2000, 15.8800], [50.2080, 15.8650], [50.2130, 15.8500],
  [50.2160, 15.8380], [50.2145, 15.8285]
], 30);
river('Úpa', [[50.3750, 15.9550], [50.3640, 15.9330], [50.3600, 15.9230], [50.3590, 15.9160]], 18);
river('Metuje', [[50.3480, 15.9550], [50.3500, 15.9400], [50.3530, 15.9200], [50.3540, 15.9100]], 14);

const LAKES = [];
function lake(name, lat, lon, rx, ry, rot = 0) {
  const c = XY(lat, lon), pts = [];
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, j = 0.8 + rnd() * 0.35;
    const x = Math.cos(a) * rx * j, y = Math.sin(a) * ry * j;
    pts.push([c[0] + x * Math.cos(rot) - y * Math.sin(rot), c[1] + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  LAKES.push(pts);
  areaXY(pts, { natural: 'water', name });
}
lake('Stříbrný rybník', 50.1865, 15.8880, 260, 170, 0.4);
lake('Datlík', 50.1790, 15.8990, 150, 110, -0.2);
lake('Biřička', 50.1935, 15.8735, 110, 70, 0.8);
lake('Roudnička', 50.1920, 15.8130, 120, 80, 0.3);
lake('Rozkoš (část)', 50.3380, 15.9500, 380, 220, 0.3);
lake('Rybník Smiřice', 50.2920, 15.8790, 140, 80, -0.5);

function nearWater(p, margin) {
  for (const r of RIVERS) if (distPtLine(p, r.xy) < r.width / 2 + margin) return true;
  for (const l of LAKES) if (pip(p, l) || distPtLine(p, l.concat([l[0]])) < margin) return true;
  return false;
}

// ================================================================ MOTORWAY D11
const D11_CENTER = smooth(llToXY([
  [50.2085, 15.7680], [50.2150, 15.7760], [50.2260, 15.7815], [50.2400, 15.7870], [50.2540, 15.7960],
  [50.2680, 15.8080], [50.2800, 15.8210], [50.2900, 15.8330], [50.2970, 15.8430], [50.3070, 15.8500],
  [50.3180, 15.8570], [50.3280, 15.8670], [50.3370, 15.8770], [50.3440, 15.8860]
]), 4);
const D11 = resample(D11_CENTER, 140);
const W_END = mk(...D11[0]), J_END = mk(...D11[D11.length - 1]);
const NB = D11.map((p, i) => i === 0 ? W_END : i === D11.length - 1 ? J_END : mk(p[0], p[1]));
const SB = D11.map((p, i) => i === 0 ? W_END : i === D11.length - 1 ? J_END : mk(p[0], p[1]));
const MOTOR = { highway: 'motorway', ref: 'D11', name: 'Dálnice D11', lanes: '2', oneway: 'yes', maxspeed: '130' };
addWay(NB.slice(), MOTOR, { nodable: false });
addWay(SB.slice().reverse(), MOTOR, { nodable: false });

function nearestIdx(pts, p) { let bi = 0, bd = 1e18; pts.forEach((q, i) => { const d = len(sub(q, p)); if (d < bd) { bd = d; bi = i; } }); return bi; }
const RAMP_PTS = [];
// Diamond interchange: local road crosses over the motorway, 4 ramps.
function diamond(latlon, side = 1) {
  const k = nearestIdx(D11, XY(...latlon));
  const P = D11[k], T = (() => { const a = D11[k - 1], b = D11[k + 1]; const d = sub(b, a), L = len(d); return [d[0] / L, d[1] / L]; })();
  const R = [T[1], -T[0]]; // right of northbound (y north)
  const at = (t, r) => [P[0] + T[0] * t + R[0] * r, P[1] + T[1] * t + R[1] * r];
  const Pw = mk(...at(0, -150)), Pe = mk(...at(0, 150));
  const link = { highway: 'motorway_link', oneway: 'yes' };
  RAMP_PTS.push(at(-230, 45), at(-90, 110), at(90, 110), at(230, 45), at(230, -45), at(90, -110), at(-90, -110), at(-230, -45), at(0, 150), at(0, -150));
  addWay([NB[k - 3], mk(...at(-230, 45)), mk(...at(-90, 110)), Pe], link, { nodable: false });
  addWay([Pe, mk(...at(90, 110)), mk(...at(230, 45)), NB[k + 3]], link, { nodable: false });
  addWay([SB[k + 3], mk(...at(230, -45)), mk(...at(90, -110)), Pw], link, { nodable: false });
  addWay([Pw, mk(...at(-90, -110)), mk(...at(-230, -45)), SB[k - 3]], link, { nodable: false });
  return { Pw, Pe, at };
}

// ================================================================ MAIN ROADS
const R = (pts, tags, opts) => {
  // mix of [lat,lon] and node objects; smooth runs of lat/lon
  const out = []; let run = [];
  const flush = () => { if (run.length) { const s = run.length > 2 ? smooth(llToXY(run), 3) : llToXY(run); s.forEach(p => out.push(mk(p[0], p[1]))); run = []; } };
  for (const p of pts) { if (p && p.id) { flush(); out.push(p); } else run.push(p); }
  flush();
  // de-duplicate consecutive coincident points
  const ns = out.filter((n, i) => i === 0 || Math.hypot(n.x - out[i - 1].x, n.y - out[i - 1].y) > 0.5);
  return addWay(ns, tags, opts);
};
const prim = (name, ref, extra) => Object.assign({ highway: 'primary', name, ref }, extra || {});
const sec = (name, extra) => Object.assign({ highway: 'secondary', name }, extra || {});
const ter = (name, extra) => Object.assign({ highway: 'tertiary', name }, extra || {});

// D11 west end (Kukleny) -> Pražská třída into the centre
R([W_END, [50.2095, 15.7760], [50.2112, 15.7850], [50.2125, 15.7950], [50.2118, 15.8030], [50.2110, 15.8100],
  [50.2102, 15.8190], [50.2096, 15.8255], [50.2093, 15.8290]], prim('Pražská třída', 'I/11', { lanes: '4' }));
// Old-town ring (tertiary loop)
R([[50.2093, 15.8290], [50.2130, 15.8292], [50.2133, 15.8350], [50.2131, 15.8402], [50.2090, 15.8405],
  [50.2060, 15.8400], [50.2058, 15.8350], [50.2062, 15.8295], [50.2093, 15.8290]], ter('Třída Československé armády'));
// Gočárova (4 lanes) to the east
R([[50.2060, 15.8400], [50.2048, 15.8470], [50.2035, 15.8560], [50.2020, 15.8650], [50.2005, 15.8760], [50.1990, 15.8900]],
  prim('Gočárova třída', 'I/11', { lanes: '4' }));
// Třída Karla IV. / Hradecká south past the ambulance base to Nový Hradec
R([[50.2058, 15.8350], [50.2030, 15.8380], [50.2000, 15.8405], [50.1968, 15.8430], [50.1930, 15.8470],
  [50.1900, 15.8500], [50.1860, 15.8560], [50.1830, 15.8610], [50.1790, 15.8680], [50.1740, 15.8760]],
  prim('Hradecká', 'I/37'));
// Sokolská: from Pražská south past the Fakultní nemocnice
R([[50.2110, 15.8100], [50.2075, 15.8095], [50.2040, 15.8092], [50.2000, 15.8085], [50.1950, 15.8070], [50.1900, 15.8045]],
  sec('Sokolská třída', { lanes: '4' }));
// Ring road (Okružní / I/35) – full loop around the city
R([[50.1900, 15.8045], [50.1882, 15.8150], [50.1878, 15.8260], [50.1872, 15.8380], [50.1900, 15.8500],
  [50.1930, 15.8620], [50.1965, 15.8700], [50.2005, 15.8760], [50.2045, 15.8730], [50.2100, 15.8700],
  [50.2170, 15.8660], [50.2250, 15.8600], [50.2305, 15.8500], [50.2330, 15.8400], [50.2335, 15.8300],
  [50.2338, 15.8200], [50.2350, 15.8100], [50.2345, 15.8000], [50.2280, 15.7985], [50.2200, 15.7975],
  [50.2125, 15.7950], [50.2050, 15.7980], [50.1970, 15.8010], [50.1900, 15.8045]],
  { highway: 'trunk', name: 'Okružní', ref: 'I/35', lanes: '4' });
// Old road I/33 north: old town -> Labská kotlina -> Předměřice -> Lochenice -> Smiřice -> Černožice -> Jaroměř
const I33a = [[50.2131, 15.8350], [50.2180, 15.8345], [50.2240, 15.8350], [50.2335, 15.8350]];
R(I33a, prim('Pospíšilova / Na Okrouhlíku', 'I/33'));
// Slezská (NE)
R([[50.2131, 15.8402], [50.2170, 15.8440], [50.2210, 15.8500], [50.2250, 15.8600]], sec('Slezská'));
// Brněnská (SE, from Gočárova towards the forest)
R([[50.2035, 15.8560], [50.1990, 15.8600], [50.1940, 15.8640], [50.1900, 15.8700], [50.1850, 15.8760], [50.1790, 15.8850]],
  sec('Brněnská'));
// Plotiště interchange and road
const dPlot = diamond([50.2410, 15.7880]);
R([dPlot.Pw, [50.2400, 15.7780], [50.2380, 15.7700]], ter('Plotišťská'), { nodable: true });
R([dPlot.Pe, [50.2395, 15.7960], [50.2375, 15.8000], [50.2345, 15.8000]], ter('Plotišťská'));
// Předměřice interchange (Předměřice/Plotiště north) and I/33 through Předměřice
R([[50.2335, 15.8350], [50.2430, 15.8340], [50.2530, 15.8335], [50.2620, 15.8390], [50.2700, 15.8450],
  [50.2790, 15.8495], [50.2870, 15.8570], [50.2940, 15.8640], [50.3000, 15.8690], [50.3060, 15.8730],
  [50.3110, 15.8760], [50.3160, 15.8745], [50.3200, 15.8720], [50.3260, 15.8760], [50.3330, 15.8830],
  [50.3400, 15.8890], [50.3470, 15.8950], [50.3510, 15.9030], [50.3540, 15.9110], [50.3560, 15.9200],
  [50.3575, 15.9290], [50.3600, 15.9400]], prim('Silnice I/33', 'I/33'));
// Smiřice interchange road
const dSmi = diamond([50.2965, 15.8425]);
R([dSmi.Pw, [50.2950, 15.8330], [50.2930, 15.8250]], ter('Smiřická'));
R([dSmi.Pe, [50.2975, 15.8520], [50.2985, 15.8600], [50.3000, 15.8690]], ter('Smiřická'));
// Černožice interchange road
const dCer = diamond([50.3185, 15.8575]);
R([dCer.Pw, [50.3170, 15.8480]], ter('Černožická'));
R([dCer.Pe, [50.3195, 15.8650], [50.3200, 15.8720]], ter('Černožická'));
// Jaroměř end of D11 -> I/33
R([J_END, [50.3460, 15.8910], [50.3470, 15.8950]], prim('Jaroměřská', 'I/33'));
// Jaroměř local main streets
R([[50.3560, 15.9200], [50.3610, 15.9190], [50.3660, 15.9230], [50.3700, 15.9300]], sec('Náchodská'));
R([[50.3560, 15.9200], [50.3520, 15.9250], [50.3480, 15.9320], [50.3450, 15.9420]], sec('Pražská (Jaroměř)'));
R([[50.3470, 15.8950], [50.3500, 15.8880], [50.3560, 15.8850]], ter('Na Ostrově'));
// Lochenice – Smiřice riverside road (alternative)
R([[50.2790, 15.8495], [50.2840, 15.8440], [50.2900, 15.8460], [50.2950, 15.8520], [50.2975, 15.8520]], ter('Lochenická'));
// Plotiště – Předměřice northern link (crosses Labe)
R([[50.2395, 15.7960], [50.2450, 15.8050], [50.2490, 15.8200], [50.2530, 15.8335]], ter('Plotiště – Předměřice'));
// Kukleny – Sokolská link (Kutnohorská)
R([[50.2050, 15.7980], [50.2045, 15.8030], [50.2040, 15.8092]], ter('Kutnohorská'));
// Nový Hradec – Moravské Předměstí link
R([[50.1930, 15.8620], [50.1968, 15.8430]], ter('Pouchovská'));
// Roads to the countryside (make the map feel open)
R([[50.1990, 15.8900], [50.1980, 15.9100], [50.1960, 15.9300]], sec('Třebechovická'));
R([[50.1740, 15.8760], [50.1700, 15.8900], [50.1680, 15.9050]], ter('Lesní'));

// ================================================================ ROUNDABOUTS (created before noding)
const ROUNDABOUTS = [];
function roundabout(lat, lon, r, hw) {
  const c = XY(lat, lon), ns = [];
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ns.push(mk(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r)); }
  ns.push(ns[0]);
  addWay(ns, { highway: hw, junction: 'roundabout', oneway: 'yes' }); // CCW in a y-north frame
  ROUNDABOUTS.push({ c, r });
}
roundabout(50.1900, 15.8500, 32, 'primary');   // Hradecká × ring
roundabout(50.2125, 15.7950, 34, 'primary');   // Kukleny: Pražská × ring
roundabout(50.2005, 15.8760, 30, 'primary');   // Gočárova × ring
roundabout(50.2335, 15.8350, 30, 'primary');   // I/33 × ring north
roundabout(50.3000, 15.8690, 26, 'primary');   // Smiřice
roundabout(50.2050, 15.7980, 24, 'tertiary');  // Kukleny south

// ================================================================ NEIGHBOURHOOD STREET GRIDS
// Grid streets inside a neighbourhood box; each street end is extended outwards
// (up to maxExt) until it meets a main road, so the neighbourhood gets connected.
function rayToMainRoad(P, dir, maxExt) {
  let best = maxExt + 1;
  const Q = [P[0] + dir[0] * maxExt, P[1] + dir[1] * maxExt];
  for (const w of WAYS) {
    if (w.grid || !w.nodable) continue;
    for (let i = 0; i + 1 < w.ns.length; i++) {
      const r = segX(P, Q, [w.ns[i].x, w.ns[i].y], [w.ns[i + 1].x, w.ns[i + 1].y]);
      if (r && r.t * maxExt < best) best = r.t * maxExt;
    }
  }
  return best <= maxExt ? best : -1;
}
const okPt = p => !nearWater(p, 18) && distPtLine(p, D11) > 40 && RAMP_PTS.every(q => len(sub(p, q)) > 90) &&
  !ROUNDABOUTS.some(r => len(sub(p, r.c)) < r.r + 6);
function grid(lat, lon, halfW, halfH, rotDeg, sp, opts = {}) {
  const c = XY(lat, lon), a = rotDeg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const toW = (u, v) => [c[0] + u * ca - v * sa, c[1] + u * sa + v * ca];
  const lines = [];
  const jitter = () => (rnd() - 0.5) * sp * 0.25;
  for (let u = -halfW + sp / 2; u < halfW; u += sp) { const j = jitter(); lines.push([toW(u + j, -halfH), toW(u + j, halfH)]); }
  for (let v = -halfH + sp / 2; v < halfH; v += sp) { const j = jitter(); lines.push([toW(-halfW, v + j), toW(halfW, v + j)]); }
  const maxExt = opts.ext ?? 260;
  for (let [A, B] of lines) {
    if (rnd() < (opts.skip || 0.1)) continue;
    const d = sub(B, A), L = len(d), u = [d[0] / L, d[1] / L];
    // extend both ends to the nearest main road if the way there is clear
    for (const end of [0, 1]) {
      const P = end ? B : A, dir = end ? u : [-u[0], -u[1]];
      const t = rayToMainRoad(P, dir, maxExt);
      if (t < 0) continue;
      const ext = resample([P, [P[0] + dir[0] * (t + 3), P[1] + dir[1] * (t + 3)]], 6);
      if (!ext.every(okPt)) continue;
      if (end) B = ext[ext.length - 1]; else A = ext[ext.length - 1];
    }
    const pts = resample([A, B], 6), good = pts.map(okPt);
    let run = [];
    const flush = () => {
      if (run.length > 1 && len(sub(run[run.length - 1], run[0])) > 40) {
        addWay([mk(...run[0]), mk(...run[run.length - 1])], { highway: 'residential', name: opts.name || '' }, { grid: true });
      }
      run = [];
    };
    pts.forEach((p, i) => { if (good[i]) run.push(p); else flush(); });
    flush();
  }
}
// Hradec Králové
grid(50.2095, 15.8347, 360, 380, 2, 75, { name: 'Staré Město', skip: 0.04, ext: 120 });
grid(50.2065, 15.8170, 450, 330, 5, 110, { name: 'Pražské Předměstí' });
grid(50.2140, 15.7930, 480, 330, -8, 110, { name: 'Kukleny' });
grid(50.1955, 15.8335, 420, 300, 0, 120, { name: 'Malšovice', ext: 320 });
grid(50.2000, 15.8560, 750, 450, 10, 170, { name: 'Moravské Předměstí' });
grid(50.1925, 15.8545, 380, 220, 30, 120, { name: 'Třebeš', ext: 300 });
grid(50.1845, 15.8590, 520, 380, 30, 115, { name: 'Nový Hradec Králové', ext: 320 });
grid(50.2230, 15.8510, 600, 380, -15, 150, { name: 'Slezské Předměstí' });
grid(50.2225, 15.8320, 400, 420, 0, 140, { name: 'Labská kotlina' });
grid(50.2250, 15.8080, 620, 460, 6, 130, { name: 'Věkoše' });
grid(50.2200, 15.8690, 360, 300, 12, 170, { name: 'Pouchov', skip: 0.15, ext: 320 });
grid(50.1930, 15.8130, 380, 240, -4, 120, { name: 'Roudnička' });
// villages and towns to the north
grid(50.2375, 15.7960, 460, 300, 15, 125, { name: 'Plotiště nad Labem' });
grid(50.2535, 15.8350, 420, 360, -10, 130, { name: 'Předměřice nad Labem' });
grid(50.2790, 15.8515, 280, 250, 30, 110, { name: 'Lochenice', ext: 200 });
grid(50.3000, 15.8715, 480, 360, 20, 130, { name: 'Smiřice' });
grid(50.3200, 15.8715, 360, 300, -20, 130, { name: 'Černožice' });
grid(50.3565, 15.9205, 300, 220, 8, 85, { name: 'Jaroměř – centrum', skip: 0.04 });
grid(50.3530, 15.9290, 520, 330, 20, 120, { name: 'Jaroměř' });
grid(50.3620, 15.9180, 380, 240, -10, 125, { name: 'Jaroměř – sever' });
grid(50.3500, 15.9380, 400, 260, 10, 170, { name: 'Jaroměř – průmysl', skip: 0.2 });

// ================================================================ NODING
function segList(ways) {
  const S = [];
  ways.forEach(w => { if (!w.nodable) return; for (let i = 0; i + 1 < w.ns.length; i++) S.push({ w, i }); });
  return S;
}
// 1) endpoint snapping (T-junctions)
function snapEnds() {
  const nodable = WAYS.filter(w => w.nodable);
  const usage = new Map();
  WAYS.forEach(w => w.ns.forEach(n => usage.set(n, (usage.get(n) || 0) + 1)));
  for (const w of nodable) {
    for (const end of [0, w.ns.length - 1]) {
      const e = w.ns[end];
      if ((usage.get(e) || 0) > 1) continue;
      let best = null;
      for (const v of nodable) {
        if (v === w) continue;
        for (let i = 0; i + 1 < v.ns.length; i++) {
          const a = v.ns[i], b = v.ns[i + 1];
          const r = distPtSeg([e.x, e.y], [a.x, a.y], [b.x, b.y]);
          if (r.d < (w.grid ? 45 : 30) && (!best || r.d < best.d)) best = { d: r.d, t: r.t, v, i };
        }
      }
      if (!best) continue;
      const { v, i, t } = best, a = v.ns[i], b = v.ns[i + 1];
      const segL = Math.hypot(b.x - a.x, b.y - a.y);
      let target;
      if (t * segL < 8) target = a; else if ((1 - t) * segL < 8) target = b;
      else { target = mk(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); v.ns.splice(i + 1, 0, target); }
      w.ns[end] = target;
      usage.set(target, (usage.get(target) || 0) + 1);
    }
  }
}
// 2) crossings
function nodeCrossings() {
  const S = segList(WAYS), CELL = 250, G = new Map();
  const key = (i, j) => i * 100003 + j;
  S.forEach((s, idx) => {
    const a = s.w.ns[s.i], b = s.w.ns[s.i + 1];
    const x0 = Math.floor(Math.min(a.x, b.x) / CELL), x1 = Math.floor(Math.max(a.x, b.x) / CELL);
    const y0 = Math.floor(Math.min(a.y, b.y) / CELL), y1 = Math.floor(Math.max(a.y, b.y) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) { const k = key(i, j); if (!G.has(k)) G.set(k, []); G.get(k).push(idx); }
  });
  const ins = new Map(), seen = new Set();
  for (const list of G.values()) {
    for (let p = 0; p < list.length; p++) for (let q = p + 1; q < list.length; q++) {
      const A = S[list[p]], B = S[list[q]];
      if (A.w === B.w) continue;
      const pk = list[p] < list[q] ? list[p] * 1e7 + list[q] : list[q] * 1e7 + list[p];
      if (seen.has(pk)) continue; seen.add(pk);
      const a1 = A.w.ns[A.i], a2 = A.w.ns[A.i + 1], b1 = B.w.ns[B.i], b2 = B.w.ns[B.i + 1];
      if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) continue;
      const r = segX([a1.x, a1.y], [a2.x, a2.y], [b1.x, b1.y], [b2.x, b2.y]);
      if (!r) continue;
      const n = mk(a1.x + (a2.x - a1.x) * r.t, a1.y + (a2.y - a1.y) * r.t);
      for (const [s, t] of [[A, r.t], [B, r.u]]) {
        const k = s.w.id + ':' + s.i; if (!ins.has(k)) ins.set(k, []); ins.get(k).push({ t, n });
      }
    }
  }
  for (const w of WAYS) {
    if (!w.nodable) continue;
    const out = [w.ns[0]];
    for (let i = 0; i + 1 < w.ns.length; i++) {
      const L = ins.get(w.id + ':' + i);
      if (L) L.sort((a, b) => a.t - b.t).forEach(x => out.push(x.n));
      out.push(w.ns[i + 1]);
    }
    w.ns = out;
  }
}
snapEnds();
nodeCrossings();

// Remove way parts inside roundabouts, grid spurs that became tiny, and split into runs
function splitRuns(w, keepSeg, tagSeg) {
  const res = []; let cur = null, curTag = null;
  for (let i = 0; i + 1 < w.ns.length; i++) {
    if (!keepSeg(i)) { cur = null; continue; }
    const tg = tagSeg ? tagSeg(i) : 0;
    if (!cur || tg !== curTag) { cur = { ns: [w.ns[i]], bridge: tg }; curTag = tg; res.push(cur); }
    cur.ns.push(w.ns[i + 1]);
  }
  return res;
}
const OUTWAYS = [];
for (const w of WAYS) {
  const isRing = w.tags.junction === 'roundabout';
  // insert bridge vertices where a road crosses a river or (for non-motorway) the D11 centreline
  const ns = [w.ns[0]], br = [];
  for (let i = 0; i + 1 < w.ns.length; i++) {
    const a = w.ns[i], b = w.ns[i + 1], A = [a.x, a.y], B = [b.x, b.y], L = len(sub(B, A));
    const cuts = [];
    const crossers = RIVERS.map(r => ({ xy: r.xy, hl: r.width / 2 + 10 }));
    if (w.tags.highway !== 'motorway' && w.tags.highway !== 'motorway_link') crossers.push({ xy: D11, hl: 16 });
    for (const c of crossers) for (let j = 0; j + 1 < c.xy.length; j++) {
      const r = segX(A, B, c.xy[j], c.xy[j + 1]);
      if (r) cuts.push([Math.max(0.001, r.t - c.hl / L), Math.min(0.999, r.t + c.hl / L)]);
    }
    cuts.sort((p, q) => p[0] - q[0]);
    let lastT = 0;
    for (const [t0, t1] of cuts) {
      if (t0 <= lastT) continue;
      ns.push(mk(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0)); br.push(0);
      ns.push(mk(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1)); br.push(1);
      lastT = t1;
    }
    ns.push(b); br.push(0);
  }
  w.ns = ns;
  const keep = i => {
    if (isRing) return true;
    const a = w.ns[i], b = w.ns[i + 1], m = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    return !ROUNDABOUTS.some(r => len(sub(m, r.c)) < r.r * 0.95);
  };
  for (const run of splitRuns(w, keep, i => br[i])) {
    const tags = Object.assign({}, w.tags);
    if (run.bridge) { tags.bridge = 'yes'; tags.layer = '1'; }
    OUTWAYS.push({ ns: run.ns, tags });
  }
}

// ================================================================ AREAS, POIS, PLACES
// Forests
area([[50.1870, 15.8950], [50.1960, 15.9250], [50.1850, 15.9420], [50.1680, 15.9350], [50.1650, 15.9000], [50.1730, 15.8880], [50.1810, 15.9060]], { landuse: 'forest', name: 'Hradecké lesy' });
area([[50.1780, 15.8480], [50.1800, 15.8560], [50.1700, 15.8700], [50.1640, 15.8550]], { natural: 'wood' });
area([[50.2700, 15.7900], [50.2800, 15.8000], [50.2720, 15.8110], [50.2620, 15.8000]], { landuse: 'forest' });
area([[50.3080, 15.8250], [50.3150, 15.8380], [50.3060, 15.8450], [50.2990, 15.8330]], { landuse: 'forest' });
area([[50.3300, 15.8450], [50.3400, 15.8600], [50.3320, 15.8680], [50.3230, 15.8540]], { landuse: 'forest' });
area([[50.3640, 15.8900], [50.3700, 15.9050], [50.3620, 15.9080], [50.3580, 15.8950]], { landuse: 'forest' });
area([[50.2100, 15.7650], [50.2200, 15.7700], [50.2170, 15.7780], [50.2090, 15.7760]], { natural: 'wood' });
// Parks
area([[50.2150, 15.8292], [50.2160, 15.8330], [50.2140, 15.8345], [50.2132, 15.8300]], { leisure: 'park', name: 'Jiráskovy sady' });
area([[50.2065, 15.8255], [50.2085, 15.8270], [50.2075, 15.8285], [50.2058, 15.8272]], { leisure: 'park', name: 'Šimkovy sady' });
area([[50.1985, 15.8475], [50.1995, 15.8520], [50.1970, 15.8525], [50.1962, 15.8480]], { leisure: 'park' });
area([[50.3565, 15.9120], [50.3575, 15.9145], [50.3555, 15.9150], [50.3548, 15.9125]], { leisure: 'park' });
// Farmland patchwork over the countryside (skips towns, forests and water)
{
  const [x0, y0] = XY(cfg.bbox.s, cfg.bbox.w), [x1, y1] = XY(cfg.bbox.n, cfg.bbox.e);
  const S = 520, crops = ['farmland', 'farmland', 'farmland', 'meadow', 'farmland', 'orchard'];
  for (let x = x0; x < x1; x += S) for (let y = y0; y < y1; y += S) {
    const c = [x + S / 2, y + S / 2];
    const inTown = cfg.towns.some(t => len(sub(c, XY(t.lat, t.lon))) < t.r * (t.name === 'Hradec Králové' ? 0.8 : 1.05) + 250);
    if (inTown || nearWater(c, 60)) continue;
    const j = () => (rnd() - 0.5) * 60;
    areaXY([[x + 12 + j(), y + 12 + j()], [x + S - 12 + j(), y + 12 + j()], [x + S - 12 + j(), y + S - 12 + j()], [x + 12 + j(), y + S - 12 + j()]],
      { landuse: crops[Math.floor(rnd() * crops.length)] });
  }
}
// Hospitals, ambulance stations
poi(50.2038, 15.8065, { amenity: 'hospital', name: 'Fakultní nemocnice Hradec Králové', emergency: 'yes' });
poi(50.3590, 15.9260, { amenity: 'hospital', name: 'Nemocnice Jaroměř' });
poi(50.1962, 15.8445, { emergency: 'ambulance_station', name: 'ZZS KHK – výjezdová základna Hradec Králové' });
poi(50.3515, 15.9220, { emergency: 'ambulance_station', name: 'ZZS KHK – výjezdová základna Jaroměř' });
// Landmarks & churches
poi(50.2099, 15.8322, { man_made: 'tower', name: 'Bílá věž' });
poi(50.2093, 15.8335, { amenity: 'place_of_worship', name: 'Katedrála sv. Ducha', building: 'cathedral' });
for (const [lat, lon, name] of [[50.2385, 15.7968, 'Plotiště'], [50.2535, 15.8345, 'Předměřice'], [50.2792, 15.8505, 'Lochenice'],
  [50.3005, 15.8705, 'Smiřice'], [50.3205, 15.8715, 'Černožice'], [50.3568, 15.9205, 'Jaroměř']])
  poi(lat, lon, { amenity: 'place_of_worship', name: 'Kostel ' + name, building: 'church' });
// Traffic signals (snapped to the nearest junction by the converter)
for (const [lat, lon] of [[50.2110, 15.8100], [50.2093, 15.8290], [50.2130, 15.8292], [50.2060, 15.8400], [50.2058, 15.8350],
  [50.2131, 15.8402], [50.2131, 15.8350], [50.2035, 15.8560], [50.1968, 15.8430], [50.2040, 15.8092], [50.1900, 15.8045],
  [50.2250, 15.8600], [50.2102, 15.8190], [50.3560, 15.9200], [50.2000, 15.8405]])
  poi(lat, lon, { highway: 'traffic_signals' });
// Places
for (const [lat, lon, name, place] of [
  [50.2092, 15.8328, 'Hradec Králové', 'city'], [50.2125, 15.7950, 'Kukleny', 'suburb'], [50.2070, 15.8160, 'Pražské Předměstí', 'suburb'],
  [50.2000, 15.8540, 'Moravské Předměstí', 'suburb'], [50.2235, 15.8510, 'Slezské Předměstí', 'suburb'], [50.1850, 15.8600, 'Nový Hradec Králové', 'suburb'],
  [50.2225, 15.8330, 'Labská kotlina', 'suburb'], [50.1950, 15.8250, 'Malšovice', 'suburb'], [50.2380, 15.7960, 'Plotiště nad Labem', 'suburb'],
  [50.2535, 15.8345, 'Předměřice nad Labem', 'village'], [50.2790, 15.8505, 'Lochenice', 'village'], [50.3000, 15.8700, 'Smiřice', 'town'],
  [50.3200, 15.8715, 'Černožice', 'village'], [50.3560, 15.9200, 'Jaroměř', 'town'], [50.2230, 15.8780, 'Pouchov', 'suburb']])
  poi(lat, lon, { place, name });
// Railway Hradec Králové – Jaroměř (east of the old road)
{
  const xy = smooth(llToXY([[50.2130, 15.8125], [50.2200, 15.8190], [50.2300, 15.8200], [50.2450, 15.8290], [50.2600, 15.8420],
    [50.2750, 15.8560], [50.2900, 15.8720], [50.3050, 15.8820], [50.3200, 15.8900], [50.3350, 15.9020], [50.3500, 15.9150], [50.3600, 15.9120]]), 4);
  EXTRA.push({ ns: xy.map(p => mk(p[0], p[1])), tags: { railway: 'rail', name: 'Trať 041' } });
}

// ================================================================ OUTPUT (Overpass JSON)
const used = new Set();
OUTWAYS.forEach(w => w.ns.forEach(n => used.add(n)));
EXTRA.forEach(w => w.ns.forEach(n => used.add(n)));
NODES.forEach(n => { if (n.poi) used.add(n); });
const elements = [];
for (const n of NODES) {
  if (!used.has(n)) continue;
  const [lat, lon] = LL(n.x, n.y);
  const e = { type: 'node', id: n.id, lat: +lat.toFixed(7), lon: +lon.toFixed(7) };
  if (n.tags) e.tags = n.tags;
  elements.push(e);
}
let oid = 1;
for (const w of OUTWAYS.concat(EXTRA)) {
  const tags = {}; for (const k in w.tags) if (w.tags[k] !== '' && w.tags[k] != null) tags[k] = String(w.tags[k]);
  elements.push({ type: 'way', id: oid++, nodes: w.ns.map(n => n.id), tags });
}
const out = { version: 0.6, generator: 'EmergencyGame sketch (approximate, hand-traced)', osm3s: { copyright: 'Approximation for development; replace with an OpenStreetMap export (ODbL).' }, elements };
const file = path.join(__dirname, '..', '..', 'data', 'osm-sketch.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out));
console.log(`sketch: ${elements.filter(e => e.type === 'node').length} nodes, ${elements.filter(e => e.type === 'way').length} ways -> ${path.relative(process.cwd(), file)}`);
