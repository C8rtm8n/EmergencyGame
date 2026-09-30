# Ztroskotanec (Castaway)

Pixel-art plošinovka z džungle pro **CrazyGames**. Hráč se nepohybuje šipkami – postavu
vystřeluje tažením prstu/myši jako prak (Angry Birds), houpe se na liánách, přichytává se na
kmeny a odráží se od hub. Čisté HTML5 Canvas + JavaScript, **bez knihoven, bez obrázků a
zvukových souborů** – veškerá grafika i hudba se generuje kódem při startu.

* velikost: ~160 KB (≈ 50 KB gzip) v jednom souboru
* interní rozlišení 320×180, ostré (nearest-neighbour) škálování na 16:9, volitelný CRT filtr (WebGL)
* ovládání: dotyk i myš, orientace na šířku, Esc/P = pauza
* jazyky: čeština, angličtina (výchozí podle prohlížeče, přepínač v Nastavení)

## Spuštění

Otevři `index.html` v prohlížeči (funguje i z `file://`), nebo složku servíruj libovolným
statickým serverem. Bez SDK (offline, jiný web) hra běží dál: reklamy se přeskočí
(odměny se v tom případě udělí rovnou) a postup se ukládá do `localStorage`.

URL přepínače pro vývoj: `?level=1-3`, `?scene=intro|ending|memory|chapter|map`,
`?unlock=1` (odemkne vše), `?reset=1` (smaže postup).

## Build pro CrazyGames

```sh
node tools/build.js        # -> dist/index.html (jeden soubor, skripty vložené inline)
node tools/solve.js [id]   # ověří, že každý level jde projít, a vypíše min. počet skoků
```

`dist/index.html` se nahraje na CrazyGames (SDK v3 se načítá z jejich CDN).

## Integrace CrazyGames SDK v3 (`js/sdk.js`)

| volání | kdy |
|---|---|
| `init`, `loadingStart` / `loadingStop` | start hry, generování grafiky |
| `gameplayStart` / `gameplayStop` | hraní levelu ↔ pauza, dialogy, menu, mapa, filmové scény, ztráta fokusu |
| `requestAd('midgame')` | jen mezi kapitolami (po mezihře „Nálezy z lodi“), max. 1× za 3 min |
| `requestAd('rewarded')` | „+3 banány“ po vyčerpání skoků, „Přeskočit level“ v pauze |
| `happytime()` | dokončení kapitoly, záchrana na konci hry |
| `data.getItem/setItem` | uložení postupu a nastavení (fallback `localStorage`) |
| `settings.muteAudio` | respektuje ztlumení z portálu; během reklamy je zvuk vypnutý |

Hra se pozastaví při ztrátě fokusu okna / přepnutí záložky, neotevírá žádné odkazy ani okna.

## Hratelnost

* **Tažení a výstřel** – polož prst kamkoli, táhni opačně, než chceš letět. Síla = délka tahu
  (max. 46 px interní plochy), zobrazí se jen začátek dráhy. Postava se přikrčí podle síly.
* **Banány** = skoky v levelu. Hvězdy podle zbylých banánů (`stars: [pro 2★, pro 3★]`).
* **Liány** – chytí se automaticky (zdarma), odraz stojí banán; rychlost = hybnost houpání + tah.
* **Kmeny** – přichycení a skok dál; **houby/listy** – trampolíny; **hnilé větve** prasknou 0,6 s po dopadu.
* **Vítr / vodopády**, **nebezpečí** (moře, řeka, bodláky, láva, masožravé rostliny, krabi,
  krokodýli – na zavřené tlamě se dá stát, opice s kokosy) → návrat k poslednímu táboráku.
* **Sběr**: kompas, lahev se vzkazem, dalekohled, stránky lodního deníku (texty o osudu posádky).
  Vše z kapitoly odemkne filmovou vzpomínku.

Hotovo: úvodní filmová scéna (bouře → vrak → probuzení), 5 levelů 1. kapitoly, mapa ostrova se
40 místy (další se odkrývají), mezihra po kapitole, vzpomínka, finální záchrana při západu slunce
(`?scene=ending`). Enginově podporované prvky pro další kapitoly: vítr/vodopády, láva, krokodýli,
masožravé rostliny, pozadí `temple` a `volcano` s náladami kapitol 2–4.

## Přidání levelu

Levely jsou čistá data v `js/levels.js` (popis všech polí je v hlavičce souboru):

```js
{ id: '2-1', ch: 1, bg: 'jungle', w: 800, h: 240, jumps: 8, stars: [1, 2],
  start: [40, 200], goal: [770, 150],
  solids: [[0, 200, 120, 40, 'soil'], [720, 150, 80, 90, 'rock']],
  vines: [[300, 20, 110]], trunks: [[500, 40, 190, 10, 'tree']],
  hazards: [[120, 220, 600, 20, 'river']], crocs: [[400, 222]],
  checkpoints: [[60, 200]], items: [[480, 60, 'page', 6]] }
```

Pak `node tools/solve.js 2-1` ověří průchodnost. Texty (názvy levelů, stránky deníku) jsou v `js/i18n.js`.
Pořadí v poli = pořadí na mapě; poslední level kapitoly spustí mezihru, reklamu a `happytime()`.

## Struktura

| soubor | obsah |
|---|---|
| `js/config.js` | rozlišení, fyzikální konstanty, paleta, pomocné funkce |
| `js/i18n.js` | všechny texty CZ/EN |
| `js/font.js` | bitmapový font 5×7 s českou diakritikou |
| `js/sdk.js`, `js/save.js` | CrazyGames SDK wrapper, ukládání |
| `js/audio.js` | Web Audio: chiptune sekvencer (square/triangle/marimba/bonga), ambient, SFX |
| `js/sprites.js` | procedurální pixel art (hrdina skládaný z kloubů + automatický obrys), předměty, zvířata |
| `js/bg.js` | paralaxní pozadí (nebe, hory se sopkou, moře/koruny, popředí) pro 4 nálady |
| `js/levels.js` | data levelů |
| `js/world.js` | fyzika a logika levelu (sdílená s `tools/solve.js`) |
| `js/levelgfx.js` | předkreslení terénu + animované prvky |
| `js/ui.js` | dřevo/lano/bambus UI, dialogy, nastavení, částice, iris přechod |
| `js/game.js` | herní scéna: tažení, kamera, animace, HUD, výhra/prohra |
| `js/scenes.js`, `js/cutscenes.js` | titulka, mapa ostrova, filmové scény |
| `js/main.js` | smyčka, škálování, vstup, CRT shader, pauza při ztrátě fokusu |
