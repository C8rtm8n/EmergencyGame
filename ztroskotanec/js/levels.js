// ============================================================================
//  levels.js — level definitions (plain JSON-compatible data).
//
//  To add a level, append an object to Z.LEVELS. Fields:
//    id       'chapter-number' e.g. '2-1'      ch     chapter index (0..3)
//    bg       background: beach | jungle | temple | volcano
//    w,h      level size in px (screen is 320x180)
//    jumps    bananas (launches) available     stars  [leftFor2, leftFor3]
//    hint     optional hint key(s) from i18n.js (array)
//    start    [x,y] feet position               goal   [x,y] flag position
//    solids   [x,y,w,h,type]   type: sand | rock | wreck | soil | stone | basalt
//    branches [x,y,w,rotten]   one-way platforms (rotten=1 snaps 0.6 s after landing)
//    trunks   [x,y,h,w,type]   climbable trunks (type: palm | tree)
//    vines    [anchorX,anchorY,length]
//    bouncers [x,y,w,type,power]  type: mush | leaf
//    winds    [x,y,w,h,fx,fy,type] accelerations; type: air | fall (waterfall)
//    hazards  [x,y,w,h,type]   type: water | river | spikes | thistle | lava
//    plants   [x,y]            carnivorous plant (x centre, y ground)
//    walkers  [x0,x1,y,type,speed]  crabs / scorpions patrolling
//    crocs    [x,y,phase]      croc in water: back is a platform, open jaws kill
//    monkeys  [x,y,interval]   coconut throwers
//    checkpoints [[x,y]]       campfires
//    items    [x,y,type,id]    type: compass | bottle | spyglass | page (id = page number)
//    deco     [x,y,type,(w)]   palm, crate, barrel, shell, starfish, grass, fern, bush,
//                               mast, stone, flower, canopy(w), sign, skull
//  Verify with: node tools/solve.js
// ============================================================================
'use strict';
Z.LEVELS = [
  // ------------------------------------------------------------ 1-1 beach (tutorial)
  {
    id: '1-1', ch: 0, bg: 'beach', w: 640, h: 180, jumps: 7, stars: [1, 2],
    hint: ['hint_drag', 'hint_drag2', 'hint_fire'], tutorial: true,
    start: [120, 150], goal: [612, 150],
    solids: [[0, 150, 190, 30, 'sand'], [250, 138, 50, 42, 'rock'], [300, 150, 100, 30, 'sand'],
      [342, 134, 30, 16, 'wreck'], [460, 122, 100, 58, 'wreck'], [560, 150, 80, 30, 'sand']],
    hazards: [[190, 156, 60, 24, 'water'], [400, 156, 60, 24, 'water']],
    checkpoints: [[318, 150]],
    items: [[512, 96, 'page', 1]],
    deco: [[30, 150, 'palm'], [70, 150, 'shell'], [160, 150, 'starfish'], [382, 150, 'crate'],
      [480, 122, 'mast'], [540, 122, 'barrel'], [596, 150, 'palm'], [580, 150, 'grass'], [8, 150, 'grass']]
  },
  // ------------------------------------------------------------ 1-2 palms: trunks + branches
  {
    id: '1-2', ch: 0, bg: 'beach', w: 720, h: 220, jumps: 8, stars: [1, 2],
    hint: ['hint_trunk'],
    start: [60, 200], goal: [690, 170],
    solids: [[0, 200, 130, 20, 'sand'], [150, 196, 44, 24, 'rock'], [226, 182, 44, 38, 'rock'],
      [380, 152, 70, 68, 'rock'], [540, 104, 60, 116, 'rock'], [600, 170, 120, 50, 'sand']],
    trunks: [[168, 112, 84, 8, 'palm'], [306, 66, 140, 8, 'palm'], [486, 44, 156, 8, 'palm']],
    branches: [[150, 112, 44, 0], [314, 118, 44, 0]],
    hazards: [[130, 206, 250, 14, 'water'], [450, 206, 150, 14, 'water']],
    checkpoints: [[410, 152]],
    items: [[322, 56, 'bottle', 0], [466, 120, 'page', 2]],
    deco: [[20, 200, 'palm'], [100, 200, 'crate'], [420, 152, 'grass'], [560, 104, 'grass'], [650, 170, 'palm'], [620, 170, 'shell']]
  },
  // ------------------------------------------------------------ 1-3 vines
  {
    id: '1-3', ch: 0, bg: 'jungle', w: 820, h: 220, jumps: 8, stars: [1, 2],
    hint: ['hint_vine', 'hint_vine2'],
    start: [50, 190], goal: [792, 150],
    solids: [[0, 190, 112, 30, 'soil'], [262, 172, 44, 48, 'rock'], [540, 160, 84, 60, 'soil'], [744, 150, 76, 70, 'soil']],
    vines: [[186, 24, 108], [370, 18, 116], [468, 28, 104], [688, 24, 104]],
    trunks: [[636, 40, 170, 10, 'tree']],
    hazards: [[112, 200, 150, 20, 'river'], [306, 200, 234, 20, 'river'], [624, 200, 120, 20, 'river']],
    checkpoints: [[566, 160]],
    items: [[418, 40, 'compass', 0], [690, 150, 'page', 3]],
    deco: [[0, 0, 'canopy', 820], [30, 190, 'fern'], [96, 190, 'bush'], [286, 172, 'grass'], [600, 160, 'fern'], [770, 150, 'bush'], [556, 160, 'flower']]
  },
  // ------------------------------------------------------------ 1-4 bouncy mushrooms and leaves
  {
    id: '1-4', ch: 0, bg: 'jungle', w: 760, h: 260, jumps: 6, stars: [1, 2],
    hint: ['hint_bounce'],
    start: [50, 230], goal: [724, 80],
    solids: [[0, 230, 120, 30, 'soil'], [200, 230, 60, 30, 'soil'], [300, 130, 80, 130, 'rock'],
      [500, 116, 56, 144, 'rock'], [590, 230, 70, 30, 'soil'], [660, 80, 100, 180, 'rock']],
    bouncers: [[214, 218, 24, 'mush', 360], [428, 176, 28, 'leaf', 300], [606, 218, 26, 'mush', 400]],
    trunks: [[418, 70, 190, 10, 'tree']],
    hazards: [[120, 240, 80, 20, 'thistle'], [260, 240, 40, 20, 'thistle'], [380, 240, 120, 20, 'thistle'], [556, 240, 34, 20, 'thistle']],
    checkpoints: [[330, 130]],
    items: [[250, 150, 'spyglass', 0], [520, 70, 'page', 4]],
    deco: [[0, 0, 'canopy', 760], [20, 230, 'fern'], [90, 230, 'bush'], [360, 130, 'fern'], [640, 230, 'grass'], [690, 80, 'bush'], [520, 116, 'flower']]
  },
  // ------------------------------------------------------------ 1-5 rotten branches + monkey
  {
    id: '1-5', ch: 0, bg: 'jungle', w: 900, h: 240, jumps: 10, stars: [1, 2],
    hint: ['hint_rotten', 'hint_monkey'],
    start: [44, 200], goal: [868, 150],
    solids: [[0, 200, 100, 40, 'soil'], [400, 172, 64, 68, 'rock'], [816, 150, 84, 90, 'rock'], [100, 234, 716, 6, 'soil']],
    branches: [[128, 150, 40, 0], [218, 132, 36, 1], [318, 140, 40, 0], [492, 138, 30, 1], [580, 124, 30, 1], [654, 108, 48, 0], [520, 90, 40, 0]],
    trunks: [[358, 50, 184, 10, 'tree'], [644, 36, 198, 10, 'tree']],
    vines: [[748, 22, 100]],
    hazards: [[100, 222, 300, 12, 'thistle'], [464, 222, 352, 12, 'thistle']],
    monkeys: [[540, 90, 2.8]],
    checkpoints: [[426, 172]],
    items: [[598, 56, 'page', 5]],
    deco: [[0, 0, 'canopy', 900], [20, 200, 'fern'], [80, 200, 'bush'], [440, 172, 'grass'], [850, 150, 'fern'], [830, 150, 'flower']]
  }
];

// Chapter meta: map path colours, mood index, item lists are derived from levels.
Z.CHAPTERS = [
  { mood: 0, levels: 10 }, { mood: 1, levels: 10 }, { mood: 2, levels: 10 }, { mood: 3, levels: 10 }
];
Z.levelIndex = function (id) { for (var i = 0; i < Z.LEVELS.length; i++) if (Z.LEVELS[i].id === id) return i; return -1; };
// All collectibles of a chapter (for the memory scene unlock).
Z.chapterItems = function (ch) {
  var out = [];
  Z.LEVELS.forEach(function (l) { if (l.ch === ch) (l.items || []).forEach(function (it, i) { out.push(l.id + ':' + i); }); });
  return out;
};
Z.lastLevelOfChapter = function (ch) {
  var last = -1; Z.LEVELS.forEach(function (l, i) { if (l.ch === ch) last = i; }); return last;
};
