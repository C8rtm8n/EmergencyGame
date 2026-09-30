// DOM menus. Mostly icons; all strings come from Z.t().
'use strict';
(function () {
  var root, cur = null;
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'on') { for (var ev in attrs.on) el.addEventListener(ev, attrs.on[ev]); }
      else if (k === 'cls') el.className = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c == null) return; el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function btn(label, fn, cls) { return h('button', { cls: 'btn ' + (cls || ''), on: { click: function (e) { e.stopPropagation(); Z.audio.unlock(); Z.audio.blip(); fn(); } } }, [label]); }
  var t = function (k) { return Z.t(k); };
  var VEH_ICON = { van: '🚑', suv: '🚙', box: '🚐', rs: '🏎️' };

  var UI = Z.ui = {
    init: function (el) { root = el; },
    hide: function () { root.innerHTML = ''; root.className = 'hidden'; cur = null; },
    show: function (name, arg) { cur = name; root.className = 'screen-' + name; root.innerHTML = ''; root.appendChild(SCREENS[name](arg)); },
    current: function () { return cur; },
    refresh: function () { if (cur) UI.show(cur); },
  };

  function rankLine() {
    var r = Z.rankOf(Z.save.xp), nx = Z.rankNext(Z.save.xp);
    return h('div', { cls: 'rank' }, [
      h('span', { cls: 'chip' }, ['🎖 ' + t('rank' + r)]),
      h('span', { cls: 'chip' }, ['🪙 ' + Z.save.coins]),
      nx ? h('span', { cls: 'chip dim' }, ['XP ' + Z.save.xp + ' / ' + nx]) : h('span', { cls: 'chip dim' }, ['XP ' + Z.save.xp]),
    ]);
  }
  function osm() { return h('div', { cls: 'osm' }, ['Map data ' + t('osm') + ' · ODbL']); }
  function title() {
    return h('div', { cls: 'title' }, [
      h('div', { cls: 'logo' }, [h('span', { cls: 'n155' }, ['155']), h('span', {}, [t('title').replace(' 155', '')])]),
      h('div', { cls: 'sub' }, [t('subtitle')]),
    ]);
  }
  function langSwitch() {
    return h('div', { cls: 'lang' }, Object.keys(Z.I18N).map(function (l) {
      return h('button', { cls: 'lbtn' + (Z.lang === l ? ' on' : ''), on: { click: function (e) { e.stopPropagation(); Z.save.lang = l; Z.writeSave(); Z.setLang(l); UI.refresh(); } } }, [l.toUpperCase()]);
    }));
  }

  var SCREENS = {
    loading: function () { return h('div', { cls: 'panel center' }, [title(), h('div', { cls: 'spinner' }), h('div', {}, [t('loading')]), osm()]); },
    menu: function () {
      var d = Z.dailyKey(), done = Z.save.daily.day === d.day && Z.save.daily.done;
      return h('div', { cls: 'panel menu' }, [
        langSwitch(), title(), rankLine(),
        h('div', { cls: 'col' }, [
          btn('▶  ' + t('play'), function () { Z.game.play(); }, 'big primary'),
          h('div', { cls: 'row' }, [btn('🔧 ' + t('garage'), function () { UI.show('garage'); }), btn('🏆 ' + t('records'), function () { UI.show('records'); })]),
          h('div', { cls: 'row' }, [btn('⚙️ ' + t('settings'), function () { UI.show('settings'); }), btn('❔ ' + t('howto'), function () { UI.show('howto'); })]),
        ]),
        h('div', { cls: 'daily' + (done ? ' done' : '') }, ['📅 ' + t('daily') + ': ' + t(d.key) + (done ? ' ✔' : '  (🪙 300)')]),
        osm(),
      ]);
    },
    garage: function () {
      var u = Z.save.upg, rank = Z.rankOf(Z.save.xp);
      var rows = [['engine', '⚙️'], ['susp', '🛞'], ['siren', '🚨']].map(function (r) {
        var lvl = u[r[0]], costs = Z.UPGRADES[r[0]], cost = costs[lvl];
        return h('div', { cls: 'upg' }, [
          h('span', { cls: 'ico' }, [r[1]]), h('span', { cls: 'nm' }, [t(r[0] === 'susp' ? 'suspension' : r[0])]),
          h('span', { cls: 'lvl' }, [0, 1, 2].map(function (i) { return h('i', { cls: i < lvl ? 'on' : '' }); })),
          cost == null ? h('span', { cls: 'chip' }, [t('max')]) :
            btn('🪙 ' + cost, function () { if (Z.save.coins >= cost) { Z.save.coins -= cost; u[r[0]]++; Z.writeSave(); Z.audio.blip('coin'); UI.refresh(); } else Z.audio.blip('bad'); }, Z.save.coins >= cost ? 'small primary' : 'small dim'),
        ]);
      });
      var vehs = Object.keys(Z.VEHICLES).map(function (k) {
        var v = Z.VEHICLES[k], owned = Z.save.owned.indexOf(k) >= 0, sel = Z.save.vehicle === k, locked = rank < v.rank;
        var action = sel ? h('span', { cls: 'chip' }, ['✔']) : owned ? btn(t('select'), function () { Z.save.vehicle = k; Z.writeSave(); UI.refresh(); }, 'small') :
          locked ? h('span', { cls: 'chip dim' }, ['🔒 ' + t('rank' + v.rank)]) :
            btn('🪙 ' + v.price, function () { if (Z.save.coins >= v.price) { Z.save.coins -= v.price; Z.save.owned.push(k); Z.save.vehicle = k; Z.writeSave(); Z.audio.blip('coin'); UI.refresh(); } else Z.audio.blip('bad'); }, 'small primary');
        var stat = function (ico, val, max) { return h('div', { cls: 'st' }, [ico, h('b', { style: 'width:' + Math.round(Z.clamp(val / max, 0.1, 1) * 100) + '%' })]); };
        return h('div', { cls: 'veh' + (sel ? ' sel' : '') + (locked ? ' locked' : '') }, [
          h('div', { cls: 'vi' }, [VEH_ICON[k]]), h('div', { cls: 'vn' }, [t('veh_' + k)]),
          stat('💨', v.vmax - 35, 22), stat('🛏', v.comfort + 2, 5), stat('🛡', v.hp, 150), action,
        ]);
      });
      return h('div', { cls: 'panel' }, [h('h2', {}, ['🔧 ' + t('garage')]), rankLine(), h('div', { cls: 'upgs' }, rows), h('h3', {}, [t('vehicles')]), h('div', { cls: 'vehs' }, vehs), btn('⬅ ' + t('back'), function () { UI.show('menu'); })]);
    },
    records: function () {
      var rows = Object.keys(Z.CALL_TYPES).map(function (k) {
        return h('div', { cls: 'rec' }, [h('span', { cls: 'ico' }, [Z.CALL_TYPES[k].icon]), h('span', { cls: 'nm' }, [t('c_' + k)]), h('b', {}, [String(Z.save.rec[k] || '–')])]);
      });
      return h('div', { cls: 'panel' }, [
        h('h2', {}, ['🏆 ' + t('records')]),
        h('div', { cls: 'row' }, [h('span', { cls: 'chip' }, ['⭐ ' + Z.save.best]), h('span', { cls: 'chip' }, ['〰 ' + Z.save.bestClean + ' m']), h('span', { cls: 'chip' }, ['🛏 ' + Z.save.saved])]),
        h('div', { cls: 'recs' }, rows), btn('⬅ ' + t('back'), function () { UI.show('menu'); }),
      ]);
    },
    settings: function () {
      var S = Z.save;
      return h('div', { cls: 'panel' }, [
        h('h2', {}, ['⚙️ ' + t('settings')]),
        h('div', { cls: 'set' }, [h('span', {}, ['🌐 ' + t('language')]), h('div', { cls: 'row' }, Object.keys(Z.I18N).map(function (l) {
          return btn(Z.I18N[l]._name, function () { S.lang = l; Z.writeSave(); Z.setLang(l); UI.refresh(); }, 'small' + (Z.lang === l ? ' primary' : ''));
        }))]),
        h('div', { cls: 'set' }, [h('span', {}, ['🔊 ' + t('sound')]), btn(S.sound ? t('on') : t('off'), function () { S.sound = S.sound ? 0 : 1; Z.writeSave(); Z.audio.refreshVolume(); UI.refresh(); }, 'small' + (S.sound ? ' primary' : ''))]),
        h('div', { cls: 'set' }, [h('span', {}, ['🚨 ' + t('siren_tone')]), h('div', { cls: 'row' }, [
          btn(t('tone_hilo'), function () { S.sirenMode = 0; Z.writeSave(); Z.audio.sirenModeChanged(); UI.refresh(); }, 'small' + (S.sirenMode === 0 ? ' primary' : '')),
          btn(t('tone_wail'), function () { S.sirenMode = 1; Z.writeSave(); Z.audio.sirenModeChanged(); UI.refresh(); }, 'small' + (S.sirenMode === 1 ? ' primary' : '')),
        ])]),
        h('div', { cls: 'set' }, [h('span', {}, ['🗑 ' + t('reset')]), btn('✖', function () { if (window.confirm(t('reset_q'))) { var l = S.lang; Z.resetSave(); Z.save.lang = l; Z.writeSave(); UI.refresh(); } }, 'small dim')]),
        osm(), btn('⬅ ' + t('back'), function () { UI.show('menu'); }),
      ]);
    },
    howto: function () {
      var keys = Z.input.isTouchDevice();
      var row = function (k, ico, txt) { return h('div', { cls: 'how' }, [h('span', { cls: 'key' }, [k]), h('span', { cls: 'ico' }, [ico]), h('span', {}, [txt])]); };
      return h('div', { cls: 'panel' }, [
        h('h2', {}, ['❔ ' + t('howto')]),
        h('p', { cls: 'goal' }, ['🚑 → 📍 → ✋ → 🏥   ' + t('help_goal')]),
        row(keys ? '▲▼◀▶' : 'WASD / ⬆⬇⬅➡', '🚑', t('help_drive')),
        row(keys ? '🚨' : 'SPACE', '🚨', t('help_siren')),
        row(keys ? '📯' : 'H', '🎧', t('help_horn')),
        row(keys ? '✋' : 'E', '✋', t('help_action')),
        h('p', { cls: 'goal' }, ['😣 ' + t('help_smooth')]),
        h('p', { cls: 'goal' }, ['🚦 ⛔🚨 −50   ·   〰 ' + t('smooth') + ' +']),
        btn('⬅ ' + t('back'), function () { UI.show(Z.game.state === 'pause' ? 'pause' : 'menu'); }),
      ]);
    },
    pause: function () {
      return h('div', { cls: 'panel center small' }, [
        h('h2', {}, ['⏸ ' + t('paused')]),
        btn('▶ ' + t('resume'), function () { Z.game.resume(); }, 'big primary'),
        btn('❔ ' + t('howto'), function () { UI.show('howto'); }),
        btn('⏹ ' + t('quit'), function () { Z.game.finishShift(); }),
      ]);
    },
    extend: function () {
      return h('div', { cls: 'panel center small' }, [
        h('h2', {}, ['⏱ 0:00']),
        btn('🎬 ' + t('extend'), function () { Z.game.extendShift(); }, 'big primary'),
        btn('✖', function () { Z.game.finishShift(); }),
      ]);
    },
    end: function (r) {
      return h('div', { cls: 'panel center' }, [
        h('h2', {}, ['🏁 ' + t('shift_over')]),
        r.record ? h('div', { cls: 'chip gold' }, ['🏆 ' + t('new_best')]) : null,
        h('div', { cls: 'results' }, [
          h('div', {}, [h('span', {}, ['⭐ ' + t('score')]), h('b', {}, [String(r.score)])]),
          h('div', {}, [h('span', {}, ['🛏 ' + t('saved')]), h('b', {}, [String(r.saved)])]),
          h('div', {}, [h('span', {}, ['〰 ' + t('best_clean')]), h('b', {}, [r.bestClean + ' m'])]),
          h('div', {}, [h('span', {}, ['🪙 ' + t('coins')]), h('b', {}, ['+' + r.coins])]),
        ]),
        rankLine(),
        h('div', { cls: 'row' }, [btn('↻ ' + t('again'), function () { Z.game.play(); }, 'big primary'), btn('☰ ' + t('menu'), function () { Z.game.toMenu(); }, 'big')]),
        osm(),
      ]);
    },
  };
})();
