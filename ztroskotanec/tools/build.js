#!/usr/bin/env node
// Bundles the game into dist/index.html (one file, all game scripts inlined).
// The CrazyGames SDK stays an external CDN script as required by the portal.
// Usage: node tools/build.js
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const strip = js => js.split('\n').filter(l => !/^\s*\/\/(?!#)/.test(l)).map(l => l.replace(/^\s+/, '')).join('\n');
html = html.replace(/<script src="(js\/[^"]+)"><\/script>\n?/g, (m, src) =>
  '<script>' + strip(fs.readFileSync(path.join(ROOT, src), 'utf8')).replace(/<\/script/gi, '<\\/script') + '</script>\n');
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), html);
const gz = zlib.gzipSync(html).length;
console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB (gzip ${(gz / 1024).toFixed(0)} KB) — CrazyGames target < 5 MB`);
