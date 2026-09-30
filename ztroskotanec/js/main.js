// ============================================================================
//  main.js — boot, main loop, responsive nearest-neighbour scaling, input,
//  optional CRT post-process (WebGL), focus handling, debug URL flags.
//
//  URL flags: ?level=1-3  ?scene=intro|ending|memory|chapter|map  ?unlock=1  ?reset=1
// ============================================================================
'use strict';
(function () {
  var screen = document.getElementById('screen'), crtCanvas = document.getElementById('crt');
  var sctx = screen.getContext('2d');
  var buf = document.createElement('canvas'); buf.width = Z.W; buf.height = Z.H;
  var g = buf.getContext('2d');
  g.imageSmoothingEnabled = false;
  var view = { x: 0, y: 0, w: Z.W, h: Z.H, scale: 1 };
  Z.scene = null;
  Z.crt = false;

  Z.setScene = function (s) {
    if (Z.scene && Z.scene.exit) Z.scene.exit();
    Z.scene = s; if (s.enter) s.enter();
  };

  // ------------------------------------------------------------ scaling
  function resize() {
    var ww = window.innerWidth, wh = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 3);
    var scale = Math.min(ww / Z.W, wh / Z.H);
    if (scale >= 1) { var ip = Math.floor(scale); if (scale - ip < 0.12) scale = ip; } // prefer integer scale when close
    var cw = Math.floor(Z.W * scale), ch = Math.floor(Z.H * scale);
    view = { x: Math.floor((ww - cw) / 2), y: Math.floor((wh - ch) / 2), w: cw, h: ch, scale: scale };
    [screen, crtCanvas].forEach(function (c) {
      c.style.width = cw + 'px'; c.style.height = ch + 'px'; c.style.left = view.x + 'px'; c.style.top = view.y + 'px';
      c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr);
    });
    sctx.imageSmoothingEnabled = false;
    if (crt.gl) crt.gl.viewport(0, 0, crtCanvas.width, crtCanvas.height);
    var rot = document.getElementById('rotate');
    if (rot) rot.style.display = (('ontouchstart' in window) && wh > ww * 1.1) ? 'flex' : 'none';
  }

  // ------------------------------------------------------------ CRT (WebGL)
  var crt = { gl: null };
  function initCRT() {
    var gl = null;
    try { gl = crtCanvas.getContext('webgl', { antialias: false, alpha: false }) || crtCanvas.getContext('experimental-webgl'); } catch (e) { gl = null; }
    if (!gl) return;
    var vs = 'attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*0.5+0.5,0.5-p.y*0.5);gl_Position=vec4(p,0.,1.);}';
    var fs = [
      'precision mediump float;uniform sampler2D t;uniform vec2 res;varying vec2 uv;',
      'vec2 curve(vec2 u){u=u*2.-1.;vec2 o=abs(u.yx)/vec2(5.5,4.5);u=u+u*o*o;return u*.5+.5;}',
      'void main(){vec2 c=curve(uv);',
      'if(c.x<0.||c.y<0.||c.x>1.||c.y>1.){gl_FragColor=vec4(0.,0.,0.,1.);return;}',
      'vec3 col;col.r=texture2D(t,c+vec2(.6/res.x,0.)).r;col.g=texture2D(t,c).g;col.b=texture2D(t,c-vec2(.6/res.x,0.)).b;',
      'float s=sin(c.y*res.y*6.28318);col*=.84+.16*s;',
      'float m=mod(gl_FragCoord.x,3.);col*=vec3(m<1.?1.08:.96,m>=1.&&m<2.?1.08:.96,m>=2.?1.08:.96);',
      'float v=16.*c.x*c.y*(1.-c.x)*(1.-c.y);col*=pow(v,.2)*1.12;',
      'gl_FragColor=vec4(col,1.);}'
    ].join('\n');
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform2f(gl.getUniformLocation(pr, 'res'), Z.W, Z.H);
    crt.gl = gl;
  }
  function present() {
    var useCRT = Z.crt && crt.gl;
    screen.style.visibility = useCRT ? 'hidden' : 'visible';
    crtCanvas.style.visibility = useCRT ? 'visible' : 'hidden';
    if (useCRT) {
      var gl = crt.gl;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, buf);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      sctx.imageSmoothingEnabled = false;
      sctx.drawImage(buf, 0, 0, screen.width, screen.height);
    }
  }

  // ------------------------------------------------------------ input
  var activePointer = null;
  function toInternal(e) { return { x: (e.clientX - view.x) / view.scale, y: (e.clientY - view.y) / view.scale }; }
  function target() { return Z.modals.length ? Z.modals[Z.modals.length - 1] : Z.scene; }
  window.addEventListener('pointerdown', function (e) {
    Z.Audio.init();
    if (activePointer !== null) return;
    activePointer = e.pointerId;
    e.preventDefault();
    if (Z.trans) return;
    var p = toInternal(e), t = target(); if (t && t.down) t.down(p.x, p.y);
  }, { passive: false });
  window.addEventListener('pointermove', function (e) {
    if (e.pointerId !== activePointer) return;
    var p = toInternal(e), t = target(); if (t && t.move) t.move(p.x, p.y);
  });
  function end(e) {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    if (Z.trans) return;
    var p = toInternal(e), t = target(); if (t && t.up) t.up(p.x, p.y);
  }
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', function (e) {
    Z.Audio.init();
    if (Z.modals.length && e.key === 'Escape') { var m = Z.modals[Z.modals.length - 1]; if (m.o.tap) m.o.tap(); return; }
    if (Z.scene && Z.scene.key) Z.scene.key(e.key);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0) e.preventDefault();
  });

  // ------------------------------------------------------------ focus / visibility
  function blur() {
    activePointer = null;
    if (Z.scene && Z.scene.blur) Z.scene.blur();
    Z.Audio.suspend();
  }
  function focus() { if (!document.hidden) Z.Audio.resume(); }
  window.addEventListener('blur', blur);
  window.addEventListener('focus', focus);
  document.addEventListener('visibilitychange', function () { if (document.hidden) blur(); else focus(); });

  // ------------------------------------------------------------ loop
  var last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    var dt = last ? Math.min((ts - last) / 1000, 0.05) : 0.016; last = ts;
    if (document.hidden) return;
    Z.updateTrans(dt);
    if (Z.scene) Z.scene.update(dt);
    Z.modals.forEach(function (m) { m.update(dt); });
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = Z.C.ink; g.fillRect(0, 0, Z.W, Z.H);
    if (Z.scene) Z.scene.draw(g);
    Z.modals.forEach(function (m) { m.draw(g); });
    Z.UI.drawToast(g, dt);
    Z.drawTrans(g);
    present();
  }

  // ------------------------------------------------------------ boot
  function loadingScreen(p) {
    g.fillStyle = Z.C.ink; g.fillRect(0, 0, Z.W, Z.H);
    Z.Font.draw(g, Z.t('loading'), Z.W / 2, 80, Z.C.parch, { align: 'center' });
    g.fillStyle = Z.C.woodD; g.fillRect(100, 94, 120, 6);
    g.fillStyle = Z.C.yellow; g.fillRect(101, 95, Math.round(118 * p), 4);
    present();
  }
  function boot() {
    resize(); initCRT(); resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
    loadingScreen(0.1);
    Z.SDK.init().then(function () {
      Z.SDK.loadingStart();
      loadingScreen(0.3);
      setTimeout(function () {
        Z.buildSprites(); Z.buildShips();
        loadingScreen(0.7);
        Z.Save.load();
        var q = new URLSearchParams(location.search);
        if (q.get('reset')) Z.Save.reset();
        if (q.get('unlock')) { Z.LEVELS.forEach(function (l) { if (!Z.Save.d.levels[l.id]) Z.Save.d.levels[l.id] = { stars: 3, items: (l.items || []).map(function (_, i) { return i; }) }; }); Z.Save.d.memories[0] = true; }
        // warm up backgrounds so the first level starts without a hitch
        Z.BG.get('beach', 0); Z.BG.get('jungle', 0);
        loadingScreen(1);
        Z.SDK.loadingStop();
        var lvl = q.get('level'), sc = q.get('scene');
        if (lvl && Z.levelIndex(lvl) >= 0) Z.setScene(new Z.GameScene(Z.levelIndex(lvl)));
        else if (sc === 'intro') Z.setScene(Z.IntroScene());
        else if (sc === 'ending') Z.setScene(Z.EndingScene());
        else if (sc === 'memory') Z.setScene(Z.MemoryScene(0));
        else if (sc === 'chapter') Z.setScene(Z.ChapterEndScene(0));
        else if (sc === 'map') Z.setScene(new Z.MapScene());
        else Z.setScene(new Z.TitleScene());
        requestAnimationFrame(frame);
      }, 30);
    });
  }
  boot();
})();
