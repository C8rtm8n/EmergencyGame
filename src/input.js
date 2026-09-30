// Keyboard (arrows/WASD, Space = siren, H = horn, E = action, Esc = pause) and
// on-screen touch buttons (gas, brake, left, right, siren, horn, action).
'use strict';
(function () {
  var I = Z.input = { up: false, down: false, left: false, right: false, horn: false, pressed: {}, touch: false, anyKey: false };
  var held = {};
  var MAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Space: 'siren', KeyH: 'horn', KeyE: 'action', Enter: 'action', Escape: 'pause', KeyP: 'pause', KeyQ: 'tone', ShiftLeft: 'tone',
    Digit1: 'n1', Digit2: 'n2', Digit3: 'n3', KeyM: 'mute',
  };
  function set(name, v) {
    if (name === 'up' || name === 'down' || name === 'left' || name === 'right' || name === 'horn') I[name] = v;
    if (v && !held[name]) I.pressed[name] = true;
    held[name] = v;
  }
  window.addEventListener('keydown', function (e) {
    var n = MAP[e.code]; I.anyKey = true;
    Z.audio.unlock();
    if (!n) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    e.preventDefault();
    if (!e.repeat) set(n, true);
  });
  window.addEventListener('keyup', function (e) { var n = MAP[e.code]; if (n) { set(n, false); e.preventDefault(); } });
  window.addEventListener('blur', function () { for (var k in held) set(k, false); });
  // consume a one-shot press
  I.take = function (name) { var v = !!I.pressed[name]; I.pressed[name] = false; return v; };
  I.clear = function () { I.pressed = {}; };
  I.hold = function (name) { return !!held[name]; };

  // ---------------------------------------------------------------- touch buttons
  I.bindTouch = function (root) {
    var btns = root.querySelectorAll('[data-btn]');
    Array.prototype.forEach.call(btns, function (b) {
      var name = b.getAttribute('data-btn'), ids = new Set(), longT = null;
      function down(e) {
        e.preventDefault(); Z.audio.unlock(); I.touch = true;
        ids.add(e.pointerId); b.classList.add('on');
        try { b.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
        if (name === 'siren') { longT = setTimeout(function () { longT = null; I.pressed.tone = true; }, 550); return; }
        set(name, true);
      }
      function up(e) {
        if (!ids.has(e.pointerId)) return;
        ids.delete(e.pointerId);
        if (ids.size) return;
        b.classList.remove('on');
        if (name === 'siren') { if (longT) { clearTimeout(longT); longT = null; I.pressed.siren = true; } return; }
        set(name, false);
      }
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
  };
  I.isTouchDevice = function () {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  };
})();
