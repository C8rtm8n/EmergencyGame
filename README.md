# Záchranka 155: Hradec Králové (working title)

HTML5 top-down ambulance game in the style of GTA 1, made for Poki.com.
Pure Canvas 2D + JavaScript, no libraries, no runtime network requests (the map is baked in).
Single-file build is ~330 KB (~115 KB gzipped).

## Run

Open `index.html` in a browser (works from `file://`), or serve the folder with any static server.

URL flags: `?debug=1` (FPS/cars counter, logs), `?autoplay=1` (skip the menu), `?poki=1` (force-load the Poki SDK).

## Build

```sh
node tools/build.js        # -> dist/index.html (single file, all scripts inlined)
```

## Map pipeline (OpenStreetMap)

```sh
# 1. export OSM data (Overpass API) — see the query for the covered area
curl -o data/overpass.json --data-urlencode data@tools/overpass-query.txt https://overpass-api.de/api/interpreter
# 2. convert to the compact game map
node tools/build-map.js    # uses data/overpass.json if present, else data/osm-sketch.json
node tools/preview-map.js  # optional: data/preview.svg for a visual check
```

`tools/build-map.js` does: GPS → local metres → non-uniform warp (towns 1:1 at `globalScale`,
countryside additionally compressed by `ruralCompression`) → road graph with junction nodes →
Douglas–Peucker → merging of close nodes / junction clusters → pruning of dead ends → largest
strongly connected component (so AI cars never get stuck) → merging degree-2 chains → separating
motorway carriageways → traffic signals, roundabouts, bridges → water, land use, railways →
hospitals, ambulance stations, places → procedurally generated buildings by zone style
(historic centre, housing estate, houses, industry, village with church, Bílá věž).
Everything is configured in `tools/map-config.json` (area, scale, towns, style zones, ER entrance, base).

**Note:** the Overpass export mentioned in the brief was not available when this was built, so
`data/osm-sketch.json` is a hand-traced *approximation* of the region in the same Overpass JSON
format (main roads, D11 with interchanges, old road I/33 through Předměřice–Lochenice–Smiřice–Černožice,
Labe/Orlice/Úpa, ponds, forests, generated street grids). Drop a real export into
`data/overpass.json` and re-run `node tools/build-map.js`.

Scale: towns at 0.36 of real size, countryside compressed further (×3.5) so that Kukleny → Jaroměř
on the D11 takes roughly 75–95 s at siren speed. Tune `globalScale` / `ruralCompression`; the script
prints the resulting D11 length.

## Code map

| file | what |
|---|---|
| `src/config.js` | tunables, Poki switch (`poki: 'auto' | true | false`) |
| `src/i18n.js` | all texts (EN default, CS); add a language = add a key |
| `src/storage.js` | save game, localStorage only inside try/catch |
| `src/poki.js` | Poki SDK wrapper: gameplayStart/Stop, commercialBreak, rewardedBreak |
| `src/audio.js` | Web Audio: two-tone/wail siren, engine, horn, crashes, UI |
| `src/map.js` | runtime road graph, lanes, spatial indexes, water mask, A* routing |
| `src/tiles.js` | terrain/roads pre-rendered into cached tiles, minimap |
| `src/render.js` | pseudo-3D buildings (roof parallax), vehicles, signals, night lights |
| `src/traffic.js` | AI traffic: IDM following, junction priority, lights, roundabouts, overtaking, siren response (pull-over, rescue corridor, cross traffic stop, 🎧 drivers), wreck queues |
| `src/player.js` | ambulance physics, collisions, kerbs, jolts |
| `src/missions.js` | dispatch, call types, patient condition, triage, scoring, smooth-run bonus, red-light penalty, incidents, daily challenge |
| `src/minigames.js` | CPR rhythm, bandage, splint, breathing, triage |
| `src/hud.js`, `src/ui.js`, `src/input.js`, `src/main.js` | HUD, menus, controls, main loop |

Controls: arrows/WASD, Space = siren (Q = change tone), H = horn, E = action, Esc = pause.
Touch: on-screen buttons (long-press 🚨 changes the tone).

Map data © OpenStreetMap contributors (ODbL) — shown in the menu and in game.
