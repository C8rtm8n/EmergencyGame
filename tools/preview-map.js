#!/usr/bin/env node
// Writes data/preview.svg from src/mapdata.js for a quick visual check of the converted map.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'src/mapdata.js'), 'utf8');
const window = {}; eval(src); // eslint-disable-line no-eval
const M = window.MAP_DATA;
const [x0, y0, x1, y1] = M.bounds, S = 0.25;
const pt = (x, y) => `${((x / 10 - x0) * S).toFixed(1)},${((y / 10 - y0) * S).toFixed(1)}`;
const flat = (f) => { const o = []; for (let i = 0; i < f.length; i += 2) o.push(pt(f[i], f[i + 1])); return o; };
const AC = ['#6aa7d8', '#5b8a4a', '#d9d29a', '#b7d38c', '#8fc46f', '#9fcf8a', '#a8b89a', '#d8d2c8', '#cbbfc9', '#d8c9a8'];
let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${((x1 - x0) * S) | 0}" height="${((y1 - y0) * S) | 0}"><rect width="100%" height="100%" fill="#a9c98a"/>`;
for (const [c, , p] of M.areas) s += `<polygon points="${flat(p).join(' ')}" fill="${AC[c]}"/>`;
for (const [w, p] of M.rivers) s += `<polyline points="${flat(p).join(' ')}" fill="none" stroke="#6aa7d8" stroke-width="${(w / 10 * S).toFixed(1)}"/>`;
for (let i = 0; i < M.buildings.length; i += 8) {
  const [x, y, w, d, a, , st] = M.buildings.slice(i, i + 8);
  s += `<rect x="${-w / 20 * S}" y="${-d / 20 * S}" width="${w / 10 * S}" height="${d / 10 * S}" fill="${['#c96','#bbb','#999','#889','#ca8','#fff','#fff','#f66','#ff0'][st]}" transform="translate(${pt(x, y)}) rotate(${a / 1000 * 180 / Math.PI})"/>`;
}
const N = M.nodes, col = ['#e33', '#e93', '#e63', '#fc3', '#fff', '#eee', '#ccc'];
for (const [a, b, cls, lanes, fl, p] of M.edges) {
  const pts = [pt(N[a * 2], N[a * 2 + 1])].concat(flat(p), [pt(N[b * 2], N[b * 2 + 1])]);
  const w = ((fl & 1) ? lanes : lanes * 2) * 3.4 * S;
  s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${col[cls]}" stroke-width="${Math.max(0.8, w).toFixed(1)}" stroke-linejoin="round"/>`;
}
for (const i of M.sig) s += `<circle cx="${pt(N[i * 2], N[i * 2 + 1]).split(',')[0]}" cy="${pt(N[i * 2], N[i * 2 + 1]).split(',')[1]}" r="3" fill="#0c0"/>`;
for (const h of M.hospitals) s += `<text x="${pt(h.x, h.y).split(',')[0]}" y="${pt(h.x, h.y).split(',')[1]}" font-size="14" fill="#c00">H</text>`;
for (const h of M.stations) s += `<text x="${pt(h.x, h.y).split(',')[0]}" y="${pt(h.x, h.y).split(',')[1]}" font-size="14" fill="#00c">Z</text>`;
for (const p of M.places) s += `<text x="${pt(p.x, p.y).split(',')[0]}" y="${pt(p.x, p.y).split(',')[1]}" font-size="10" fill="#000">${p.n}</text>`;
s += '</svg>';
fs.writeFileSync(path.join(ROOT, 'data/preview.svg'), s);
console.log('wrote data/preview.svg');
