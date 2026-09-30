#!/usr/bin/env node
// Converts an Overpass API JSON export (OpenStreetMap data) into the compact game map
// src/mapdata.js (window.MAP_DATA). Usage:
//   node tools/build-map.js [input.json]
// Default input: data/overpass.json if present, otherwise data/osm-sketch.json.
//
// Pipeline: GPS -> local metres -> non-uniform warp (towns 1:1, countryside compressed)
// -> road graph (junction nodes) -> Douglas–Peucker -> merge close nodes -> prune dead
// ends -> keep the largest strongly connected component -> merge degree-2 chains ->
// separate motorway carriageways -> signals/roundabouts -> water, land use, POIs ->
// procedural buildings by zone style -> JSON.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'map-config.json'), 'utf8'));

const input = process.argv[2] || (fs.existsSync(path.join(ROOT, 'data/overpass.json')) ? path.join(ROOT, 'data/overpass.json') : path.join(ROOT, 'data/osm-sketch.json'));
console.log('input:', path.relative(ROOT, input));
const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
const t0 = Date.now();

// ------------------------------------------------------------------ utils
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(cfg.seed || 1);
const hypot = Math.hypot;
function distPtSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  let t = L2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { d: hypot(px - ax - t * dx, py - ay - t * dy), t };
}
function dp(pts, eps) { // Douglas–Peucker on [[x,y]]
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) { const d = distPtSeg(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]).d; if (d > md) { md = d; mi = i; } }
    if (md > eps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function polyArea(p) { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return a / 2; }
function pip(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
class Grid {
  constructor(cell) { this.c = cell; this.m = new Map(); this.stamp = 0; }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  add(x0, y0, x1, y1, item) {
    const c = this.c;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(y0 / c); j <= Math.floor(y1 / c); j++) {
      const k = this.key(i, j); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(item);
    }
  }
  query(x0, y0, x1, y1, cb) {
    const c = this.c, s = ++this.stamp;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(y0 / c); j <= Math.floor(y1 / c); j++) {
      const a = this.m.get(this.key(i, j)); if (!a) continue;
      for (const it of a) { if (it._s === s) continue; it._s = s; if (cb(it) === false) return; }
    }
  }
}

// ------------------------------------------------------------------ projection + warp
const LAT0 = cfg.origin.lat, LON0 = cfg.origin.lon;
const KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KY = 110540;
const G = cfg.globalScale, RURAL = cfg.ruralCompression;
const projN = (lat, lon) => [(lon - LON0) * KX, (lat - LAT0) * KY]; // metres, y north
const A = projN(cfg.axis.from.lat, cfg.axis.from.lon), B = projN(cfg.axis.to.lat, cfg.axis.to.lon);
const AL = hypot(B[0] - A[0], B[1] - A[1]), U = [(B[0] - A[0]) / AL, (B[1] - A[1]) / AL], NRM = [-U[1], U[0]];
function mergeIv(iv) { iv.sort((a, b) => a[0] - b[0]); const o = []; for (const x of iv) { if (o.length && x[0] <= o[o.length - 1][1]) o[o.length - 1][1] = Math.max(o[o.length - 1][1], x[1]); else o.push(x.slice()); } return o; }
function makeWarp(iv, k) {
  const L = 1e7;
  const D = s => { let v = (s + L) / k; for (const [a, b] of iv) { const ov = Math.min(s, b) - a; if (ov > 0) v += Math.min(ov, b - a) * (1 - 1 / k); } return v; };
  const D0 = D(0);
  return s => D(s) - D0;
}
const sIv = mergeIv(cfg.towns.filter(t => !t.compress).map(t => {
  const p = projN(t.lat, t.lon), s = (p[0] - A[0]) * U[0] + (p[1] - A[1]) * U[1]; return [s - t.r, s + t.r];
}));
const warpS = makeWarp(sIv, RURAL), warpT = makeWarp([[-cfg.urbanHalfWidth, cfg.urbanHalfWidth]], RURAL);
// World: metres * G, x east, y SOUTH (screen convention)
function W(lat, lon) {
  const p = projN(lat, lon), dx = p[0] - A[0], dy = p[1] - A[1];
  const s = warpS(dx * U[0] + dy * U[1]), t = warpT(dx * NRM[0] + dy * NRM[1]);
  const X = A[0] + U[0] * s + NRM[0] * t, Y = A[1] + U[1] * s + NRM[1] * t;
  return [X * G, -Y * G];
}
const inBBox = (lat, lon) => lat >= cfg.bbox.s && lat <= cfg.bbox.n && lon >= cfg.bbox.w && lon <= cfg.bbox.e;

// ------------------------------------------------------------------ parse elements
const NODES = new Map(); const WAYS = []; const RELS = [];
const geomKey = new Map(); let synth = -1;
for (const e of raw.elements) if (e.type === 'node') NODES.set(e.id, e);
for (const e of raw.elements) {
  if (e.type === 'way') {
    let ids = e.nodes;
    if (e.geometry && (!ids || ids.some(id => !NODES.has(id)))) {
      ids = e.geometry.map(g => {
        const k = g.lat.toFixed(7) + ',' + g.lon.toFixed(7);
        if (!geomKey.has(k)) { const id = synth--; geomKey.set(k, id); NODES.set(id, { id, lat: g.lat, lon: g.lon }); }
        return geomKey.get(k);
      });
    }
    if (ids) WAYS.push({ id: e.id, nodes: ids.filter(id => NODES.has(id)), tags: e.tags || {}, geometry: e.geometry });
  } else if (e.type === 'relation') RELS.push(e);
}
const WAY_BY_ID = new Map(WAYS.map(w => [w.id, w]));
const wpos = new Map();
const P = id => { let p = wpos.get(id); if (!p) { const n = NODES.get(id); p = W(n.lat, n.lon); wpos.set(id, p); } return p; };
console.log(`parsed ${NODES.size} nodes, ${WAYS.length} ways, ${RELS.length} relations`);

// Town zones in world coordinates
const TOWNS = cfg.towns.map(t => { const c = W(t.lat, t.lon); return { name: t.name, x: c[0], y: c[1], r: t.r * G / (t.compress ? RURAL : 1) }; });
const STYLES = cfg.styles.map(s => { const c = W(s.lat, s.lon); return { style: s.style, x: c[0], y: c[1], r: s.r * G }; });
const inTown = (x, y) => TOWNS.some(t => hypot(x - t.x, y - t.y) < t.r);

// ------------------------------------------------------------------ roads
const HW = {
  motorway: 0, motorway_link: 1, trunk: 2, trunk_link: 1, primary: 3, primary_link: 3, secondary: 4, secondary_link: 4,
  tertiary: 5, tertiary_link: 5, unclassified: 6, residential: 6, living_street: 6
};
const keep = new Set(cfg.keepHighways);
const roadWays = WAYS.filter(w => w.tags.highway && keep.has(w.tags.highway) && w.tags.area !== 'yes' && w.nodes.length > 1 &&
  !['proposed', 'construction'].includes(w.tags.highway));
function roadAttrs(t) {
  const hw = t.highway, cls = HW[hw];
  const isRb = t.junction === 'roundabout' || t.junction === 'circular';
  let oneway = 0;
  if (t.oneway === 'yes' || t.oneway === 'true' || t.oneway === '1') oneway = 1;
  else if (t.oneway === '-1' || t.oneway === 'reverse') oneway = -1;
  else if (t.oneway !== 'no' && (hw === 'motorway' || hw === 'motorway_link' || isRb)) oneway = 1;
  const L = parseInt(t.lanes, 10);
  let lanes;
  if (oneway) lanes = isFinite(L) ? Math.max(1, Math.min(3, L)) : (hw === 'motorway' ? 2 : 1);
  else lanes = isFinite(L) ? Math.max(1, Math.min(3, Math.floor(L / 2))) : (hw === 'motorway' ? 2 : 1);
  if (cls >= 5 || isRb) lanes = Math.min(lanes, 1);
  return { cls, oneway, lanes, rb: isRb ? 1 : 0 };
}
// split ways into in-bbox runs
const rws = [];
for (const w of roadWays) {
  let run = [];
  const flush = () => { if (run.length > 1) rws.push({ ids: run, tags: w.tags, a: roadAttrs(w.tags) }); run = []; };
  for (const id of w.nodes) { const n = NODES.get(id); if (inBBox(n.lat, n.lon)) run.push(id); else flush(); }
  flush();
}
const usage = new Map();
for (const w of rws) { w.ids.forEach((id, i) => usage.set(id, (usage.get(id) || 0) + ((i === 0 || i === w.ids.length - 1) ? 2 : 1))); }
// closed ways count their shared first/last node twice already
let segs = [];
for (const w of rws) {
  let cur = [w.ids[0]];
  for (let i = 1; i < w.ids.length; i++) {
    cur.push(w.ids[i]);
    if (i === w.ids.length - 1 || usage.get(w.ids[i]) > 1) { segs.push({ ids: cur, a: w.a }); cur = [w.ids[i]]; }
  }
}
// orient reverse oneways, split self loops
segs = segs.flatMap(s => {
  if (s.a.oneway === -1) { s.ids.reverse(); s.a = Object.assign({}, s.a, { oneway: 1 }); }
  if (s.ids[0] === s.ids[s.ids.length - 1]) {
    if (s.ids.length < 4) return [];
    const m = Math.floor(s.ids.length / 2);
    return [{ ids: s.ids.slice(0, m + 1), a: s.a }, { ids: s.ids.slice(m), a: s.a }];
  }
  return [s];
});

// graph
let gNodes = [], gIndex = new Map();
const gnode = id => { if (!gIndex.has(id)) { const p = P(id); gIndex.set(id, gNodes.length); gNodes.push({ x: p[0], y: p[1], osm: [id], sig: 0 }); } return gIndex.get(id); };
let edges = segs.map(s => ({ a: gnode(s.ids[0]), b: gnode(s.ids[s.ids.length - 1]), pts: dp(s.ids.map(P), 1.0), ...s.a }));
edges.forEach(e => { e.pts[0] = [gNodes[e.a].x, gNodes[e.a].y]; e.pts[e.pts.length - 1] = [gNodes[e.b].x, gNodes[e.b].y]; });
console.log(`raw graph: ${gNodes.length} nodes, ${edges.length} edges`);

const elen = e => { let L = 0; for (let i = 1; i < e.pts.length; i++) L += hypot(e.pts[i][0] - e.pts[i - 1][0], e.pts[i][1] - e.pts[i - 1][1]); return L; };

// merge nodes closer than MERGE_D (union-find)
{
  const MERGE_D = 3.0, par = gNodes.map((_, i) => i);
  const f = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  const g = new Grid(10);
  gNodes.forEach((n, i) => g.add(n.x, n.y, n.x, n.y, { i }));
  gNodes.forEach((n, i) => g.query(n.x - MERGE_D, n.y - MERGE_D, n.x + MERGE_D, n.y + MERGE_D, it => {
    if (it.i !== i && hypot(gNodes[it.i].x - n.x, gNodes[it.i].y - n.y) < MERGE_D) par[f(it.i)] = f(i);
  }));
  // collapse short edges between junctions too
  for (const e of edges) if (elen(e) < MERGE_D) par[f(e.a)] = f(e.b);
  const groups = new Map();
  gNodes.forEach((n, i) => { const r = f(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
  const remap = new Array(gNodes.length), nn = [];
  for (const [, g2] of groups) {
    const x = g2.reduce((s, i) => s + gNodes[i].x, 0) / g2.length, y = g2.reduce((s, i) => s + gNodes[i].y, 0) / g2.length;
    const id = nn.length; nn.push({ x, y, osm: g2.flatMap(i => gNodes[i].osm), sig: 0 }); g2.forEach(i => remap[i] = id);
  }
  gNodes = nn;
  edges = edges.map(e => ({ ...e, a: remap[e.a], b: remap[e.b] })).filter(e => e.a !== e.b || elen(e) > 12);
  edges.forEach(e => { e.pts[0] = [gNodes[e.a].x, gNodes[e.a].y]; e.pts[e.pts.length - 1] = [gNodes[e.b].x, gNodes[e.b].y]; });
  // split remaining self-loops
  edges = edges.flatMap(e => {
    if (e.a !== e.b) return [e];
    if (e.pts.length < 3) return [];
    const m = Math.floor(e.pts.length / 2), id = gNodes.length; gNodes.push({ x: e.pts[m][0], y: e.pts[m][1], osm: [], sig: 0 });
    return [{ ...e, b: id, pts: e.pts.slice(0, m + 1) }, { ...e, a: id, pts: e.pts.slice(m) }];
  });
}

// prune dead ends + largest SCC
function pruneDeadEnds() {
  let changed = true, removed = 0;
  while (changed) {
    changed = false;
    const nb = gNodes.map(() => new Set());
    edges.forEach(e => { nb[e.a].add(e.b); nb[e.b].add(e.a); });
    const before = edges.length;
    edges = edges.filter(e => nb[e.a].size > 1 && nb[e.b].size > 1);
    if (edges.length !== before) { changed = true; removed += before - edges.length; }
  }
  return removed;
}
function largestSCC() {
  const n = gNodes.length, adj = gNodes.map(() => []);
  edges.forEach(e => { adj[e.a].push(e.b); if (!e.oneway) adj[e.b].push(e.a); });
  const idx = new Int32Array(n).fill(-1), low = new Int32Array(n), on = new Uint8Array(n), comp = new Int32Array(n).fill(-1);
  const st = []; let counter = 0, nc = 0;
  for (let s = 0; s < n; s++) {
    if (idx[s] !== -1 || adj[s].length === 0) continue;
    const call = [[s, 0]]; idx[s] = low[s] = counter++; st.push(s); on[s] = 1;
    while (call.length) {
      const fr = call[call.length - 1], v = fr[0];
      if (fr[1] < adj[v].length) {
        const w = adj[v][fr[1]++];
        if (idx[w] === -1) { idx[w] = low[w] = counter++; st.push(w); on[w] = 1; call.push([w, 0]); }
        else if (on[w]) low[v] = Math.min(low[v], idx[w]);
      } else {
        call.pop();
        if (call.length) { const u = call[call.length - 1][0]; low[u] = Math.min(low[u], low[v]); }
        if (low[v] === idx[v]) { let w; do { w = st.pop(); on[w] = 0; comp[w] = nc; } while (w !== v); nc++; }
      }
    }
  }
  const size = new Map(); for (let i = 0; i < n; i++) if (comp[i] >= 0) size.set(comp[i], (size.get(comp[i]) || 0) + 1);
  let best = -1, bs = 0; for (const [c, s] of size) if (s > bs) { bs = s; best = c; }
  const before = edges.length;
  edges = edges.filter(e => comp[e.a] === best && comp[e.b] === best);
  return before - edges.length;
}
for (let it = 0; it < 4; it++) { const r1 = pruneDeadEnds(), r2 = largestSCC(); if (!r1 && !r2) break; console.log(`prune pass ${it}: dead-end edges ${r1}, outside SCC ${r2}`); }

// signals: OSM traffic_signals nodes -> nearest junction
{
  const deg = gNodes.map(() => 0); edges.forEach(e => { deg[e.a]++; deg[e.b]++; });
  const g = new Grid(40); gNodes.forEach((n, i) => { if (deg[i] >= 3) g.add(n.x, n.y, n.x, n.y, { i }); });
  let c = 0;
  for (const n of NODES.values()) {
    if (!n.tags || n.tags.highway !== 'traffic_signals' || !inBBox(n.lat, n.lon)) continue;
    const [x, y] = W(n.lat, n.lon); let best = -1, bd = 25;
    g.query(x - 25, y - 25, x + 25, y + 25, it => { const d = hypot(gNodes[it.i].x - x, gNodes[it.i].y - y); if (d < bd) { bd = d; best = it.i; } });
    if (best >= 0 && !gNodes[best].sig) { gNodes[best].sig = 1; c++; }
  }
  console.log(`signalised junctions: ${c}`);
}

// merge degree-2 chains with identical attributes
{
  let merged = 0, again = true;
  while (again) {
    again = false;
    const inc = gNodes.map(() => []);
    edges.forEach((e, i) => { inc[e.a].push(i); inc[e.b].push(i); });
    const dead = new Set();
    for (let v = 0; v < gNodes.length; v++) {
      const L = inc[v].filter(i => !dead.has(i));
      if (L.length !== 2 || gNodes[v].sig || L[0] === L[1]) continue;
      let e1 = edges[L[0]], e2 = edges[L[1]];
      if (e1.cls !== e2.cls || e1.lanes !== e2.lanes || e1.oneway !== e2.oneway || e1.rb !== e2.rb) continue;
      // orient: e1 ends at v, e2 starts at v
      const rev = e => ({ ...e, a: e.b, b: e.a, pts: e.pts.slice().reverse() });
      if (e1.b !== v) { if (e1.oneway) { [e1, e2] = [e2, e1]; } else e1 = rev(e1); }
      if (e1.b !== v) continue;
      if (e2.a !== v) { if (e2.oneway) continue; e2 = rev(e2); }
      if (e2.a !== v || e1.a === e2.b) continue;
      const ne = { ...e1, b: e2.b, pts: e1.pts.concat(e2.pts.slice(1)) };
      dead.add(L[0]); dead.add(L[1]); edges.push(ne);
      inc[e1.a] = inc[e1.a].filter(i => i !== L[0] && i !== L[1]).concat([edges.length - 1]);
      inc[e2.b] = inc[e2.b].filter(i => i !== L[0] && i !== L[1]).concat([edges.length - 1]);
      merged++; again = true;
    }
    edges = edges.filter((_, i) => !dead.has(i));
  }
  edges.forEach(e => { e.pts = dp(e.pts, 1.0); });
  console.log(`merged ${merged} degree-2 nodes`);
}

// compact node list
{
  const used = new Map(), nn = [];
  const u = i => { if (!used.has(i)) { used.set(i, nn.length); nn.push(gNodes[i]); } return used.get(i); };
  edges.forEach(e => { e.a = u(e.a); e.b = u(e.b); });
  gNodes = nn;
}

// separate motorway carriageways: push oneway motorway geometry to its right
{
  const off = cfg.motorwayOffset;
  const isMw = e => e.cls === 0 && e.oneway;
  const nsum = gNodes.map(() => [0, 0, 0]);
  const rn = (dx, dy) => { const L = hypot(dx, dy) || 1; return [-dy / L, dx / L]; };
  for (const e of edges) {
    if (!isMw(e)) continue;
    const p = e.pts, n0 = rn(p[1][0] - p[0][0], p[1][1] - p[0][1]), n1 = rn(p[p.length - 1][0] - p[p.length - 2][0], p[p.length - 1][1] - p[p.length - 2][1]);
    nsum[e.a][0] += n0[0]; nsum[e.a][1] += n0[1]; nsum[e.a][2]++;
    nsum[e.b][0] += n1[0]; nsum[e.b][1] += n1[1]; nsum[e.b][2]++;
    for (let i = 1; i < p.length - 1; i++) {
      const n = rn(p[i + 1][0] - p[i - 1][0], p[i + 1][1] - p[i - 1][1]);
      p[i] = [p[i][0] + n[0] * off, p[i][1] + n[1] * off];
    }
  }
  gNodes.forEach((n, i) => {
    const s = nsum[i]; if (!s[2]) return;
    const L = hypot(s[0], s[1]) / s[2];
    if (L > 0.5) { n.x += s[0] / s[2] * off; n.y += s[1] / s[2] * off; }
  });
  edges.forEach(e => { e.pts[0] = [gNodes[e.a].x, gNodes[e.a].y]; e.pts[e.pts.length - 1] = [gNodes[e.b].x, gNodes[e.b].y]; });
}
edges.forEach(e => { const m = e.pts[Math.floor(e.pts.length / 2)]; e.urban = inTown(m[0], m[1]) ? 1 : 0; });
console.log(`final graph: ${gNodes.length} nodes, ${edges.length} edges, ${(edges.reduce((s, e) => s + elen(e), 0) / 1000).toFixed(1)} km of road (world)`);

// ------------------------------------------------------------------ polylines & polygons
const closedRing = ids => ids.length > 3 && ids[0] === ids[ids.length - 1];
function ringsFromRelation(r) {
  // assemble outer rings from member ways (by id or inline geometry)
  const parts = [];
  for (const m of r.members || []) {
    if (m.type !== 'way' || (m.role && m.role !== 'outer')) continue;
    let pts = null;
    const w = WAY_BY_ID.get(m.ref);
    if (w) pts = w.nodes.map(id => [NODES.get(id).lat, NODES.get(id).lon]);
    else if (m.geometry) pts = m.geometry.map(g => [g.lat, g.lon]);
    if (pts && pts.length > 1) parts.push(pts);
  }
  const rings = [], k = p => p[0].toFixed(6) + ',' + p[1].toFixed(6);
  while (parts.length) {
    let ring = parts.pop(), guard = 0;
    while (k(ring[0]) !== k(ring[ring.length - 1]) && guard++ < 1000) {
      const i = parts.findIndex(p => k(p[0]) === k(ring[ring.length - 1]) || k(p[p.length - 1]) === k(ring[ring.length - 1]));
      if (i < 0) break;
      let p = parts.splice(i, 1)[0]; if (k(p[0]) !== k(ring[ring.length - 1])) p = p.reverse();
      ring = ring.concat(p.slice(1));
    }
    if (ring.length > 3) rings.push(ring);
  }
  return rings;
}
function areaCat(t) {
  if (t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'reservoir' || t.landuse === 'basin') return 'water';
  if (t.landuse === 'forest' || t.natural === 'wood') return 'forest';
  if (['farmland', 'orchard', 'vineyard', 'allotments', 'plant_nursery'].includes(t.landuse)) return 'farm';
  if (['meadow', 'grass', 'recreation_ground', 'village_green'].includes(t.landuse) || ['grassland', 'scrub', 'heath', 'wetland'].includes(t.natural)) return 'meadow';
  if (['park', 'garden', 'golf_course', 'nature_reserve'].includes(t.leisure)) return 'park';
  if (['pitch', 'stadium', 'sports_centre', 'track'].includes(t.leisure)) return 'sport';
  if (t.landuse === 'cemetery' || t.amenity === 'grave_yard') return 'cemetery';
  if (t.landuse === 'residential') return 'residential';
  if (['industrial', 'commercial', 'retail', 'railway', 'construction', 'garages', 'brownfield'].includes(t.landuse)) return 'industrial';
  if (t.landuse === 'farmyard') return 'farmyard';
  return null;
}
const AREA_CATS = ['water', 'forest', 'farm', 'meadow', 'park', 'sport', 'cemetery', 'residential', 'industrial', 'farmyard'];
const polys = []; // {cat, pts(world), id}
function addPoly(cat, ll, id) {
  if (!ll.some(p => inBBox(p[0], p[1]))) return;
  let pts = ll.map(p => W(p[0], p[1]));
  pts = dp(pts, 2.0);
  if (pts.length < 4) return;
  if (hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.01) pts.pop();
  const a = Math.abs(polyArea(pts));
  if (a < (cat === 'water' ? 120 : 250)) return;
  polys.push({ cat, pts, id, area: a });
}
for (const w of WAYS) {
  const cat = areaCat(w.tags); if (!cat || !closedRing(w.nodes)) continue;
  addPoly(cat, w.nodes.map(id => [NODES.get(id).lat, NODES.get(id).lon]), w.id);
}
for (const r of RELS) {
  const t = r.tags || {}; if (t.type !== 'multipolygon') continue;
  const cat = areaCat(t); if (!cat) continue;
  for (const ring of ringsFromRelation(r)) addPoly(cat, ring, r.id);
}
polys.sort((a, b) => b.area - a.area); // draw large first
const rivers = [];
for (const w of WAYS) {
  const t = w.tags; if (!['river', 'canal', 'stream'].includes(t.waterway)) continue;
  const ll = w.nodes.map(id => NODES.get(id)).filter(n => inBBox(n.lat, n.lon));
  if (ll.length < 2) continue;
  let width = parseFloat(t.width); if (!isFinite(width)) width = t.waterway === 'river' ? 30 : t.waterway === 'canal' ? 10 : 3;
  const ww = t.waterway === 'stream' ? Math.max(2.5, width * G) : Math.max(8, width * G);
  rivers.push({ w: ww, pts: dp(ll.map(n => W(n.lat, n.lon)), 1.5), name: t.name || '' });
}
const rails = [];
for (const w of WAYS) {
  if (w.tags.railway !== 'rail' || w.tags.service) continue;
  const ll = w.nodes.map(id => NODES.get(id)).filter(n => inBBox(n.lat, n.lon));
  if (ll.length > 1) rails.push(dp(ll.map(n => W(n.lat, n.lon)), 1.5));
}
const bridges = [];
for (const w of rws) if (w.tags.bridge && w.tags.bridge !== 'no') {
  const pts = dp(w.ids.map(P), 0.8); if (pts.length > 1) bridges.push({ cls: w.a.cls, lanes: w.a.lanes, ow: w.a.oneway ? 1 : 0, pts });
}
// apply motorway offset to bridges too: find nearest motorway edge direction is complex — skip; bridges of motorways
// are drawn from the offset edge geometry at runtime instead (flag only).
console.log(`areas ${polys.length}, rivers ${rivers.length}, rails ${rails.length}, bridges ${bridges.length}`);

// ------------------------------------------------------------------ spatial helpers for placement
const LANE_W = [3.75, 3.75, 3.5, 3.5, 3.4, 3.2, 3.0];
const halfW = e => (e.oneway ? e.lanes : e.lanes * 2) * LANE_W[e.cls] / 2 + (e.cls === 0 ? 1.2 : 0.6);
const segGrid = new Grid(48);
for (const e of edges) {
  const hw = halfW(e);
  for (let i = 0; i + 1 < e.pts.length; i++) {
    const a = e.pts[i], b = e.pts[i + 1];
    segGrid.add(Math.min(a[0], b[0]) - hw, Math.min(a[1], b[1]) - hw, Math.max(a[0], b[0]) + hw, Math.max(a[1], b[1]) + hw, { a, b, hw });
  }
}
for (const r of rails) for (let i = 0; i + 1 < r.length; i++) {
  const a = r[i], b = r[i + 1];
  segGrid.add(Math.min(a[0], b[0]) - 4, Math.min(a[1], b[1]) - 4, Math.max(a[0], b[0]) + 4, Math.max(a[1], b[1]) + 4, { a, b, hw: 3 });
}
const waterGrid = new Grid(64);
for (const r of rivers) for (let i = 0; i + 1 < r.pts.length; i++) {
  const a = r.pts[i], b = r.pts[i + 1], hw = r.w / 2;
  waterGrid.add(Math.min(a[0], b[0]) - hw, Math.min(a[1], b[1]) - hw, Math.max(a[0], b[0]) + hw, Math.max(a[1], b[1]) + hw, { a, b, hw });
}
const areaGrid = new Grid(128);
for (const p of polys) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of p.pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  p.bb = [x0, y0, x1, y1]; areaGrid.add(x0, y0, x1, y1, p);
}
function roadClear(x, y, margin) {
  let ok = true;
  segGrid.query(x - 30, y - 30, x + 30, y + 30, s => { if (distPtSeg(x, y, s.a[0], s.a[1], s.b[0], s.b[1]).d < s.hw + margin) { ok = false; return false; } });
  return ok;
}
function waterAt(x, y, margin) {
  let hit = false;
  waterGrid.query(x - 40, y - 40, x + 40, y + 40, s => { if (distPtSeg(x, y, s.a[0], s.a[1], s.b[0], s.b[1]).d < s.hw + margin) { hit = true; return false; } });
  if (hit) return true;
  areaGrid.query(x, y, x, y, p => { if (p.cat === 'water' && pip(x, y, p.pts)) { hit = true; return false; } });
  return hit;
}
function areaAt(x, y) { // smallest containing area
  let best = null;
  areaGrid.query(x, y, x, y, p => { if (x >= p.bb[0] && x <= p.bb[2] && y >= p.bb[1] && y <= p.bb[3] && pip(x, y, p.pts) && (!best || p.area < best.area)) best = p; });
  return best ? best.cat : null;
}
function styleAt(x, y, cls) {
  for (const s of STYLES) if (hypot(x - s.x, y - s.y) < s.r) return s.style;
  const a = areaAt(x, y);
  if (a === 'industrial') return 'industrial';
  if (a === 'residential') return 'houses';
  if (a === 'farmyard') return 'village';
  if (a && a !== 'residential') return null;
  return inTown(x, y) && cls >= 3 ? 'houses' : null;
}

// ------------------------------------------------------------------ buildings
const STY = {
  //       w range     depth       setback  gap       floors   rows
  historic: { w: [11, 17], d: [13, 18], sb: [0.6, 1.2], gap: [0, 0.4], fl: [3, 4], id: 0 },
  houses: { w: [8, 11], d: [8, 11], sb: [3.5, 7], gap: [4, 9], fl: [1, 2], id: 1 },
  estate: { w: [34, 58], d: [11, 13], sb: [14, 26], gap: [18, 34], fl: [5, 12], id: 2 },
  industrial: { w: [26, 52], d: [20, 38], sb: [7, 12], gap: [8, 16], fl: [2, 3], id: 3 },
  village: { w: [9, 13], d: [8, 10], sb: [3, 6], gap: [6, 14], fl: [1, 2], id: 4 },
};
const STYLE_IDS = ['historic', 'houses', 'estate', 'industrial', 'village', 'church', 'tower', 'hospital', 'station'];
const R_ = (a) => a[0] + rnd() * (a[1] - a[0]);
const bGrid = new Grid(40); const buildings = [];
function obbCorners(b) {
  const c = Math.cos(b.ang), s = Math.sin(b.ang), hw = b.w / 2, hd = b.d / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [b.x + u * c - v * s, b.y + u * s + v * c]);
}
function obbOverlap(p, q, margin) {
  const ax = [];
  for (const b of [p, q]) { ax.push([Math.cos(b.ang), Math.sin(b.ang)], [-Math.sin(b.ang), Math.cos(b.ang)]); }
  const cp = obbCorners(p), cq = obbCorners(q);
  for (const a of ax) {
    let p0 = 1e9, p1 = -1e9, q0 = 1e9, q1 = -1e9;
    for (const v of cp) { const d = v[0] * a[0] + v[1] * a[1]; p0 = Math.min(p0, d); p1 = Math.max(p1, d); }
    for (const v of cq) { const d = v[0] * a[0] + v[1] * a[1]; q0 = Math.min(q0, d); q1 = Math.max(q1, d); }
    if (p1 + margin < q0 || q1 + margin < p0) return false;
  }
  return true;
}
function tryPlace(b, opts = {}) {
  const cs = obbCorners(b);
  const probes = cs.concat([[b.x, b.y], [(cs[0][0] + cs[1][0]) / 2, (cs[0][1] + cs[1][1]) / 2], [(cs[2][0] + cs[3][0]) / 2, (cs[2][1] + cs[3][1]) / 2],
    [(cs[1][0] + cs[2][0]) / 2, (cs[1][1] + cs[2][1]) / 2], [(cs[3][0] + cs[0][0]) / 2, (cs[3][1] + cs[0][1]) / 2]]);
  for (const p of probes) { if (!roadClear(p[0], p[1], opts.roadMargin ?? 0.8)) return false; if (waterAt(p[0], p[1], 2)) return false; }
  if (!opts.anyArea) { const a = areaAt(b.x, b.y); if (a && ['forest', 'farm', 'park', 'cemetery', 'sport', 'meadow', 'water'].includes(a)) return false; }
  const r = Math.max(b.w, b.d);
  let hit = false;
  bGrid.query(b.x - r, b.y - r, b.x + r, b.y + r, o => { if (obbOverlap(b, o, opts.gap ?? 0.8)) { hit = true; return false; } });
  if (hit) return false;
  buildings.push(b); bGrid.add(b.x - r / 2 - 1, b.y - r / 2 - 1, b.x + r / 2 + 1, b.y + r / 2 + 1, b);
  return true;
}
// special buildings first (landmarks, churches, hospitals, stations) so streets fill around them
const POI = { hospitals: [], stations: [], places: [] };
function nodeOrWayPos(e) {
  if (e.lat != null) return [e.lat, e.lon];
  if (e.center) return [e.center.lat, e.center.lon];
  const ids = e.nodes || []; if (!ids.length) return null;
  let la = 0, lo = 0, n = 0; for (const id of ids) { const q = NODES.get(id); if (q) { la += q.lat; lo += q.lon; n++; } }
  return n ? [la / n, lo / n] : null;
}
const tagged = [...NODES.values()].filter(n => n.tags).concat(WAYS.filter(w => w.tags && Object.keys(w.tags).length));
function placeNear(x, y, w, d, h, style, ang, tries = 40) {
  for (let k = 0; k < tries; k++) {
    const rr = k === 0 ? 0 : 4 + k * 2.5, a = rnd() * Math.PI * 2;
    const b = { x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr, w, d, ang: ang ?? 0, h, style: STYLE_IDS.indexOf(style), col: Math.floor(rnd() * 8) };
    if (tryPlace(b, { anyArea: true, roadMargin: 1.5, gap: 1 })) return b;
  }
  return null;
}
function nearestRoadAngle(x, y) {
  let best = null, bd = 1e9;
  segGrid.query(x - 60, y - 60, x + 60, y + 60, s => { const d = distPtSeg(x, y, s.a[0], s.a[1], s.b[0], s.b[1]).d; if (d < bd) { bd = d; best = s; } });
  return best ? Math.atan2(best.b[1] - best.a[1], best.b[0] - best.a[0]) : 0;
}
for (const lm of cfg.landmarks || []) {
  const e = tagged.find(t => t.tags.name && lm.match && t.tags.name.includes(lm.match));
  const ll = e ? nodeOrWayPos(e) : [lm.lat, lm.lon];
  const [x, y] = W(ll[0], ll[1]);
  placeNear(x, y, 7, 7, lm.h, lm.kind === 'tower' ? 'tower' : 'church', nearestRoadAngle(x, y));
}
for (const e of tagged) {
  const t = e.tags;
  const ll = nodeOrWayPos(e); if (!ll || !inBBox(ll[0], ll[1])) continue;
  const [x, y] = W(ll[0], ll[1]);
  if (t.amenity === 'hospital') POI.hospitals.push({ n: t.name || 'Hospital', x, y });
  else if (t.emergency === 'ambulance_station') POI.stations.push({ n: t.name || 'ZZS', x, y });
  else if (t.place && ['city', 'town', 'village', 'suburb', 'quarter', 'neighbourhood', 'hamlet'].includes(t.place) && t.name && e.lat != null)
    POI.places.push({ n: t.name, x, y, t: ['city', 'town', 'village', 'suburb', 'quarter', 'neighbourhood', 'hamlet'].indexOf(t.place) });
  else if (t.amenity === 'place_of_worship' && (t.building === 'church' || t.building === 'cathedral' || /kostel|katedr|church/i.test(t.name || ''))) {
    const big = t.building === 'cathedral';
    placeNear(x, y, big ? 14 : 10, big ? 26 : 20, big ? 16 : 11, 'church', nearestRoadAngle(x, y));
  }
}
// main hospital + ER entrance, main base
{
  const er = W(cfg.mainHospital.erLat, cfg.mainHospital.erLon);
  let main = POI.hospitals.find(h => cfg.mainHospital.match && h.n.includes(cfg.mainHospital.match));
  if (!main) main = POI.hospitals.slice().sort((a, b) => hypot(a.x - er[0], a.y - er[1]) - hypot(b.x - er[0], b.y - er[1]))[0];
  if (!main) { main = { n: cfg.mainHospital.name, x: er[0], y: er[1] }; POI.hospitals.push(main); }
  main.er = 1; main.ex = er[0]; main.ey = er[1];
  const base = W(cfg.mainBase.lat, cfg.mainBase.lon);
  let st = POI.stations.slice().sort((a, b) => hypot(a.x - base[0], a.y - base[1]) - hypot(b.x - base[0], b.y - base[1]))[0];
  if (!st) { st = { n: 'ZZS', x: base[0], y: base[1] }; POI.stations.push(st); }
  st.main = 1;
  for (const h of POI.hospitals) {
    const ang = nearestRoadAngle(h.x, h.y), big = h.er;
    const n = big ? 5 : 2;
    for (let i = 0; i < n; i++) placeNear(h.x + (rnd() - 0.5) * 40, h.y + (rnd() - 0.5) * 40, big ? 34 : 26, big ? 20 : 16, big ? 18 + i * 3 : 12, 'hospital', ang, 60);
  }
  for (const s of POI.stations) placeNear(s.x, s.y, 20, 12, 6, 'station', nearestRoadAngle(s.x, s.y), 60);
}
// street-side buildings
let tried = 0;
for (const e of edges) {
  if (e.cls <= 2 && !e.urban) continue;
  if (e.cls <= 1) continue;
  const hw = halfW(e);
  const cum = [0]; for (let i = 1; i < e.pts.length; i++) cum.push(cum[i - 1] + hypot(e.pts[i][0] - e.pts[i - 1][0], e.pts[i][1] - e.pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const at = s => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const a = e.pts[i - 1], b = e.pts[i], k = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); const dx = b[0] - a[0], dy = b[1] - a[1], l = hypot(dx, dy) || 1; return [a[0] + dx * k, a[1] + dy * k, dx / l, dy / l]; };
  for (const side of [1, -1]) {
    let s = 8 + rnd() * 6;
    while (s < L - 8) {
      const [x, y, tx, ty] = at(s);
      const nx = -ty * side, ny = tx * side;
      const style = styleAt(x + nx * (hw + 10), y + ny * (hw + 10), e.cls);
      if (!style) { s += 12; continue; }
      const S = STY[style];
      const w = R_(S.w), d = R_(S.d), sb = R_(S.sb);
      const rows = style === 'estate' ? 2 : style === 'houses' || style === 'village' ? 1 : 1;
      for (let row = 0; row < rows; row++) {
        const off = hw + sb + d / 2 + row * (d + 16 + rnd() * 10);
        const b = { x: x + tx * w / 2 + nx * off, y: y + ty * w / 2 + ny * off, w, d, ang: Math.atan2(ty, tx), h: Math.round(R_(S.fl)) * 3.1 + (style === 'industrial' ? 3 : 0), style: S.id, col: Math.floor(rnd() * 8) };
        if (style === 'estate' && rnd() < 0.3) { b.ang += Math.PI / 2; const t2 = b.w; b.w = b.d; b.d = t2; b.x += nx * (b.d - d) / 2; b.y += ny * (b.d - d) / 2; }
        tried++;
        tryPlace(b, { gap: style === 'historic' ? 0.05 : 1.0 });
      }
      s += w + R_(S.gap);
    }
  }
}
console.log(`buildings: ${buildings.length} placed (${tried} candidates)`);

// ------------------------------------------------------------------ output
const r1 = v => Math.round(v * 10); // decimetres
const flat = pts => { const o = []; for (const p of pts) o.push(r1(p[0]), r1(p[1])); return o; };
let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
gNodes.forEach(n => { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); });
const pad = 150; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
const clipPts = pts => pts.some(p => p[0] > x0 && p[0] < x1 && p[1] > y0 && p[1] < y1);
const out = {
  v: 1,
  src: path.basename(input),
  bounds: [x0, y0, x1, y1].map(Math.round),
  nodes: gNodes.flatMap(n => [r1(n.x), r1(n.y)]),
  sig: gNodes.map((n, i) => n.sig ? i : -1).filter(i => i >= 0),
  // edge: [a, b, cls, lanes, flags(1 oneway,2 roundabout,4 urban), pts(flat, without endpoints)]
  edges: edges.map(e => [e.a, e.b, e.cls, e.lanes, (e.oneway ? 1 : 0) | (e.rb ? 2 : 0) | (e.urban ? 4 : 0), flat(e.pts.slice(1, -1))]),
  areas: polys.filter(p => clipPts(p.pts)).map(p => [AREA_CATS.indexOf(p.cat), Math.abs(p.id) % 7, flat(p.pts)]),
  rivers: rivers.filter(r => clipPts(r.pts)).map(r => [r1(r.w), flat(r.pts)]),
  rails: rails.filter(clipPts).map(flat),
  bridges: bridges.map(b => [b.cls, b.lanes, b.ow, flat(b.pts)]),
  buildings: [].concat(...buildings.map(b => [r1(b.x), r1(b.y), r1(b.w), r1(b.d), Math.round(((b.ang % Math.PI) + Math.PI) % Math.PI * 1000), r1(b.h), b.style, b.col])),
  hospitals: POI.hospitals.map(h => ({ n: h.n, x: r1(h.x), y: r1(h.y), er: h.er ? 1 : 0, ex: r1(h.ex ?? h.x), ey: r1(h.ey ?? h.y) })),
  stations: POI.stations.map(s => ({ n: s.n, x: r1(s.x), y: r1(s.y), main: s.main ? 1 : 0 })),
  places: POI.places.map(p => ({ n: p.n, x: r1(p.x), y: r1(p.y), t: p.t })),
  towns: TOWNS.map(t => ({ n: t.name, x: r1(t.x), y: r1(t.y), r: r1(t.r) })),
};
const js = '// Generated by tools/build-map.js from ' + path.basename(input) + ' — map data © OpenStreetMap contributors (ODbL).\n' +
  '// Do not edit by hand. Regenerate with: node tools/build-map.js\nwindow.MAP_DATA=' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(ROOT, 'src', 'mapdata.js'), js);
console.log(`wrote src/mapdata.js ${(js.length / 1024).toFixed(0)} KB, bounds ${((x1 - x0) / 1000).toFixed(1)} x ${((y1 - y0) / 1000).toFixed(1)} km, ${Date.now() - t0} ms`);

// ------------------------------------------------------------------ report: D11 length and estimated drive time
{
  const mw = edges.filter(e => e.cls === 0).reduce((s, e) => s + elen(e), 0) / 2;
  console.log(`D11 carriageway length (world): ${(mw / 1000).toFixed(2)} km -> ~${Math.round(mw / 46)} s at 165 km/h`);
}
