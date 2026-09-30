// ============================================================================
//  font.js — proportional 5x7 bitmap font with Czech diacritics.
//  Glyphs are rendered once per colour into an atlas and blitted with drawImage.
//  Line box is 9 px: 2 rows for accents + 7 rows cap height.
// ============================================================================
'use strict';
(function () {
  var G = {
    A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.',
    C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
    E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
    G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
    I: '###|.#.|.#.|.#.|.#.|.#.|###', J: '..###|...#.|...#.|...#.|#..#.|#..#.|.##..',
    K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
    M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
    O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
    Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
    S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
    U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
    W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
    Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
    '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', '1': '.#.|##.|.#.|.#.|.#.|.#.|###',
    '2': '.###.|#...#|....#|...#.|..#..|.#...|#####', '3': '####.|....#|....#|.###.|....#|....#|####.',
    '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', '5': '#####|#....|####.|....#|....#|#...#|.###.',
    '6': '.###.|#....|#....|####.|#...#|#...#|.###.', '7': '#####|....#|...#.|..#..|..#..|..#..|..#..',
    '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.', '9': '.###.|#...#|#...#|.####|....#|....#|.###.',
    '.': '.|.|.|.|.|#|#', ',': '..|..|..|..|..|.#|#.', '!': '#|#|#|#|#|.|#', '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
    ':': '.|#|#|.|#|#|.', ';': '..|.#|.#|..|.#|.#|#.', '-': '...|...|...|###|...|...|...', '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
    '/': '....#|....#|...#.|..#..|.#...|#....|#....', "'": '#|#|.|.|.|.|.', '"': '#.#|#.#|...|...|...|...|...',
    '(': '.#|#.|#.|#.|#.|#.|.#', ')': '#.|.#|.#|.#|.#|.#|#.', '%': '##..#|##..#|...#.|..#..|.#...|#..##|#..##',
    '*': '.....|#.#.#|.###.|#####|.###.|#.#.#|.....', '<': '...#|..#.|.#..|#...|.#..|..#.|...#',
    '>': '#...|.#..|..#.|...#|..#.|.#..|#...', '=': '....|....|####|....|####|....|....',
    '#': '.#.#.|#####|.#.#.|.#.#.|.#.#.|#####|.#.#.', '_': '....|....|....|....|....|....|####'
  };
  // accented letter -> [base, mark] ; 1 acute, 2 caron, 3 ring, 4 umlaut
  var ACC = { 'Á': ['A', 1], 'Č': ['C', 2], 'Ď': ['D', 2], 'É': ['E', 1], 'Ě': ['E', 2], 'Í': ['I', 1], 'Ň': ['N', 2],
    'Ó': ['O', 1], 'Ř': ['R', 2], 'Š': ['S', 2], 'Ť': ['T', 2], 'Ú': ['U', 1], 'Ů': ['U', 3], 'Ý': ['Y', 1], 'Ž': ['Z', 2],
    'Ä': ['A', 4], 'Ö': ['O', 4], 'Ü': ['U', 4] };
  var LH = 9;          // line box height
  var glyphs = {};     // char -> {w, px:[[x,y],...]}

  function parse(ch, def) {
    var rows = def.split('|'), px = [], minX = 99, maxX = -1;
    rows.forEach(function (r, y) { for (var x = 0; x < r.length; x++) if (r[x] === '#') { px.push([x, y + 2]); minX = Math.min(minX, x); maxX = Math.max(maxX, x); } });
    if (maxX < 0) return { w: rows[0].length, px: [] };
    // keep designed width for narrow punctuation such as ',' but trim empty columns
    px.forEach(function (p) { p[0] -= minX; });
    return { w: maxX - minX + 1, px: px };
  }
  Object.keys(G).forEach(function (k) { glyphs[k] = parse(k, G[k]); });
  glyphs[' '] = { w: 3, px: [] };
  Object.keys(ACC).forEach(function (k) {
    var b = glyphs[ACC[k][0]], m = ACC[k][1], c = Math.floor(b.w / 2), px = b.px.slice();
    if (m === 1) px.push([c + 1, 0], [c, 1]);
    else if (m === 2) px.push([c - 1, 0], [c + 1, 0], [c, 1]);
    else if (m === 3) px.push([c, 0], [c + 1, 0], [c, 1], [c + 1, 1]);
    else px.push([c - 1, 1], [c + 1, 1]);
    glyphs[k] = { w: b.w, px: px };
  });

  var order = Object.keys(glyphs), atlasPos = {}, atlasW = 0;
  order.forEach(function (k) { atlasPos[k] = atlasW; atlasW += glyphs[k].w + 1; });
  var atlases = {};
  function atlas(color) {
    if (atlases[color]) return atlases[color];
    var c = document.createElement('canvas'); c.width = atlasW; c.height = LH;
    var g = c.getContext('2d'); g.fillStyle = color;
    order.forEach(function (k) { var ox = atlasPos[k]; glyphs[k].px.forEach(function (p) { g.fillRect(ox + p[0], p[1], 1, 1); }); });
    atlases[color] = c; return c;
  }
  function norm(s) { return String(s).toUpperCase(); }
  function width(s, scale) {
    s = norm(s); scale = scale || 1; var w = 0;
    for (var i = 0; i < s.length; i++) { var gl = glyphs[s[i]] || glyphs['?']; w += gl.w + 1; }
    return Math.max(0, w - 1) * scale;
  }
  // draw text. opts: {align:'left'|'center'|'right', shadow:color, scale:int, outline:color}
  function draw(g, s, x, y, color, opts) {
    opts = opts || {}; s = norm(s);
    var sc = opts.scale || 1, w = width(s, sc);
    if (opts.align === 'center') x -= Math.floor(w / 2); else if (opts.align === 'right') x -= w;
    x = Math.round(x); y = Math.round(y);
    if (opts.outline) { var o = opts.outline; opts = { scale: sc };
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if (dx || dy) draw(g, s, x + dx, y + dy, o, opts);
    }
    if (opts.shadow) draw(g, s, x + sc, y + sc, opts.shadow, { scale: sc });
    var at = atlas(color), cx = x;
    for (var i = 0; i < s.length; i++) {
      var ch = glyphs[s[i]] ? s[i] : '?', gl = glyphs[ch];
      if (gl.px.length) g.drawImage(at, atlasPos[ch], 0, gl.w, LH, cx, y, gl.w * sc, LH * sc);
      cx += (gl.w + 1) * sc;
    }
    return w;
  }
  // word wrap into lines that fit maxW
  function wrap(s, maxW, scale) {
    var words = String(s).split(' '), lines = [], cur = '';
    words.forEach(function (wd) {
      var t = cur ? cur + ' ' + wd : wd;
      if (width(t, scale) > maxW && cur) { lines.push(cur); cur = wd; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  Z.Font = { draw: draw, width: width, wrap: wrap, LH: LH };
})();
