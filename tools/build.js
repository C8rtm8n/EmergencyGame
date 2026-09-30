#!/usr/bin/env node
// Bundles the game into dist/index.html (single file: all scripts inlined, lightly
// minified by stripping comments/indentation) and reports the download size.
// Usage: node tools/build.js
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
function strip(js) {
  // conservative: drop full-line // comments and leading indentation (no string-aware minification)
  return js.split('\n').filter(l => !/^\s*\/\/(?!#)/.test(l)).map(l => l.replace(/^\s+/, '')).join('\n');
}
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const js = fs.readFileSync(path.join(ROOT, src), 'utf8');
  return '<script>' + (src.endsWith('mapdata.js') ? js : strip(js)).replace(/<\/script/gi, '<\\/script') + '</script>';
});
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), html);
const gz = zlib.gzipSync(html).length;
console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB (gzip ${(gz / 1024).toFixed(0)} KB) — Poki limit for initial download: 8 MB`);
