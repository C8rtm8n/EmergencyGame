// ============================================================================
//  i18n.js — all texts (CZ + EN). The bitmap font is upper-case only, texts are
//  upper-cased when drawn, so write them naturally. Add a language = add a key.
// ============================================================================
'use strict';
Z.lang = 'cs';
Z.TEXT = {
  cs: {
    title: 'ZTROSKOTANEC', subtitle: 'Cesta na sopečný útes',
    tap_start: 'Klepni pro start', loading: 'Načítání',
    settings: 'Nastavení', music: 'Hudba', sfx: 'Efekty', crt: 'CRT filtr', lang: 'Jazyk',
    on: 'Zap', off: 'Vyp', back: 'Zpět', ok: 'OK',
    pause: 'Pauza', resume: 'Pokračovat', restart: 'Znovu', map: 'Mapa',
    skip_level: 'Přeskočit level', ad: 'Reklama',
    level_done: 'Level dokončen!', next: 'Další', retry: 'Znovu',
    out_of: 'Došly banány!', plus3: '+3 banány', ad_fail: 'Reklama teď není dostupná',
    jumps: 'Skoky', items: 'Nálezy',
    hint_drag: 'Táhni prstem a pusť!', hint_drag2: 'Delší tah = delší skok',
    hint_fire: 'Táborák = checkpoint', hint_trunk: 'Na kmeny se přichytíš',
    hint_vine: 'Chyť liánu, rozhoupej se a odraz!', hint_vine2: 'Chycení liány skok nestojí',
    hint_bounce: 'Houby a listy pruží', hint_rotten: 'Pozor, hnilé větve praskají!',
    hint_monkey: 'Opice hází kokosy!',
    chapter: 'Kapitola {0}',
    ch: ['Pobřeží a vrak', 'Hluboký prales', 'Řeka a chrám', 'Úbočí sopky'],
    soon: 'Pokračování brzy...', locked: 'Zamčeno',
    diary: 'Lodní deník', page: 'Stránka {0}', no_pages: 'Zatím žádné stránky',
    tap_continue: 'Klepni pro pokračování', tap_skip: 'Klepni = přeskočit',
    intro_storm: 'Bouře...', intro_wreck: 'Loď Zefír narazila na útes.',
    intro_dark: '...', intro_morning: 'Ráno.', intro_where: 'Kde to jsem?',
    intro_goal: 'Na vrcholu sopky zapálím signální oheň!',
    finds: 'Nálezy z lodi', memory: 'Vzpomínka', memories: 'Vzpomínky',
    memory_1a: 'Noc před bouří.', memory_1b: 'Kapitán mi dal svůj šátek pro štěstí.',
    memory_1c: '"Vrať se domů, chlapče."',
    ch_end_1: 'Na pláži vyplavilo bednu ze Zefíru.', ch_end_2: 'Cesta vede do pralesa.',
    rescue: 'Zachráněn!', the_end: 'Konec', thanks: 'Děkujeme za hraní!',
    end_1: 'Signální oheň hoří.', end_2: 'Na obzoru se objevila plachta!',
    item_compass: 'Kompas', item_bottle: 'Lahev se vzkazem', item_spyglass: 'Dalekohled', item_page: 'Stránka deníku',
    rotate: 'Otoč zařízení na šířku', collected: 'Sebráno: {0}/{1}',
    all_found: 'Vše nalezeno! Odemčena vzpomínka.',
    levels: [
      'Pláž', 'Palmy', 'Liány', 'Houby a listy', 'Hnilé větve',
      'Hustník', 'Paprsky', 'Mlha', 'Světlušky', 'Srdce pralesa',
      'Brod', 'Vodopád', 'Chrám', 'Krokodýlí řeka', 'Oltář',
      'Popel', 'Láva', 'Sirné prameny', 'Kráter', 'Vrchol'
    ],
    pages: [
      'Den 1. Vyplouváme na Zefíru. Kapitán Brand slibuje, že za tři týdny budeme doma.',
      'Den 9. Kuchař Tomáš vidí zlá znamení. Racci zmizeli a moře úplně ztichlo.',
      'Den 12. Na obzoru černá mračna. Kapitán nechal stáhnout plachty a zavřít poklopy.',
      'Den 13. Bouře. Hlavní stěžeň praskl. Posádka spouští člun, já zůstal u kormidla.',
      'Nevím, kolik dní uplynulo. Člun jsem na pláži nenašel. Snad doplul k jinému břehu...'
    ]
  },
  en: {
    title: 'CASTAWAY', subtitle: 'Road to the volcano cliff',
    tap_start: 'Tap to start', loading: 'Loading',
    settings: 'Settings', music: 'Music', sfx: 'Sound FX', crt: 'CRT filter', lang: 'Language',
    on: 'On', off: 'Off', back: 'Back', ok: 'OK',
    pause: 'Paused', resume: 'Resume', restart: 'Restart', map: 'Map',
    skip_level: 'Skip level', ad: 'Ad',
    level_done: 'Level complete!', next: 'Next', retry: 'Retry',
    out_of: 'Out of bananas!', plus3: '+3 bananas', ad_fail: 'No ad available right now',
    jumps: 'Jumps', items: 'Finds',
    hint_drag: 'Drag and release!', hint_drag2: 'Longer drag = longer jump',
    hint_fire: 'Campfire = checkpoint', hint_trunk: 'You can cling to trunks',
    hint_vine: 'Grab a vine, swing and leap!', hint_vine2: 'Grabbing a vine is free',
    hint_bounce: 'Mushrooms and leaves are bouncy', hint_rotten: 'Careful, rotten branches snap!',
    hint_monkey: 'The monkey throws coconuts!',
    chapter: 'Chapter {0}',
    ch: ['The Wreck Coast', 'Deep Jungle', 'River Temple', 'Volcano Slopes'],
    soon: 'To be continued...', locked: 'Locked',
    diary: 'Ship log', page: 'Page {0}', no_pages: 'No pages found yet',
    tap_continue: 'Tap to continue', tap_skip: 'Tap = skip',
    intro_storm: 'The storm...', intro_wreck: 'The Zephyr hit the reef.',
    intro_dark: '...', intro_morning: 'Morning.', intro_where: 'Where am I?',
    intro_goal: 'I will light a signal fire on the volcano!',
    finds: 'Finds from the ship', memory: 'Memory', memories: 'Memories',
    memory_1a: 'The night before the storm.', memory_1b: 'The captain gave me his lucky bandana.',
    memory_1c: '"Get back home, lad."',
    ch_end_1: 'A crate from the Zephyr washed ashore.', ch_end_2: 'The path leads into the jungle.',
    rescue: 'Rescued!', the_end: 'The End', thanks: 'Thanks for playing!',
    end_1: 'The signal fire is burning.', end_2: 'A sail on the horizon!',
    item_compass: 'Compass', item_bottle: 'Message in a bottle', item_spyglass: 'Spyglass', item_page: 'Log page',
    rotate: 'Rotate your device', collected: 'Found: {0}/{1}',
    all_found: 'All found! Memory unlocked.',
    levels: [
      'The Beach', 'Palm Trees', 'Vines', 'Bouncy Greens', 'Rotten Branches',
      'Thicket', 'Sunbeams', 'Fog', 'Fireflies', 'Jungle Heart',
      'The Ford', 'Waterfall', 'Temple', 'Croc River', 'Altar',
      'Ash', 'Lava', 'Sulphur Springs', 'Crater', 'Summit'
    ],
    pages: [
      'Day 1. We set sail on the Zephyr. Captain Brand promises we will be home in three weeks.',
      'Day 9. Tom the cook sees bad omens. The gulls are gone and the sea went quiet.',
      'Day 12. Black clouds on the horizon. The captain ordered sails furled and hatches shut.',
      'Day 13. The storm. The mainmast snapped. The crew lowers the boat, I stayed at the helm.',
      'I do not know how many days have passed. The boat is not on the beach. I hope they reached another shore...'
    ]
  }
};
// Translate: Z.t('page', 3) -> "Stránka 3"
Z.t = function (key) {
  var s = (Z.TEXT[Z.lang] && Z.TEXT[Z.lang][key]);
  if (s === undefined) s = Z.TEXT.cs[key];
  if (s === undefined) return key;
  for (var i = 1; i < arguments.length; i++) s = String(s).split('{' + (i - 1) + '}').join(arguments[i]);
  return s;
};
Z.tl = function (key, idx) { var a = Z.t(key); return (a && a[idx] !== undefined) ? a[idx] : '?'; };
