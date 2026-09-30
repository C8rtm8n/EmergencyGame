// All player-facing text lives here. Add a language by adding another top-level key
// with the same entries (missing keys fall back to English).
'use strict';
(function () {
  var I18N = {
    en: {
      _name: 'English',
      title: 'Ambulance 155', subtitle: 'Hradec Králové',
      play: 'Play', garage: 'Garage', records: 'Records', settings: 'Settings', howto: 'How to play',
      back: 'Back', resume: 'Resume', menu: 'Menu', again: 'Play again', quit: 'End shift',
      language: 'Language', sound: 'Sound', siren_tone: 'Siren', tone_hilo: 'Two-tone', tone_wail: 'Wail',
      on: 'On', off: 'Off', reset: 'Reset progress', reset_q: 'Delete all progress?',
      osm: '© OpenStreetMap contributors',
      rank: 'Rank', coins: 'Coins', xp: 'XP', daily: 'Daily challenge', done: 'Done!',
      engine: 'Engine', suspension: 'Suspension', siren: 'Siren', max: 'MAX', buy: 'Buy', locked: 'Rank',
      vehicles: 'Vehicles', select: 'Drive', selected: 'Selected',
      veh_van: 'Standard', veh_suv: '4×4 Rapid', veh_box: 'Mobile ICU', veh_rs: 'Interceptor',
      rank0: 'Driver', rank1: 'Paramedic', rank2: 'Senior paramedic', rank3: 'Shift leader', rank4: 'Station chief',
      shift_over: 'Shift over', score: 'Score', saved: 'Patients', best_clean: 'Best smooth run', new_best: 'New record!',
      extend: '+60 s', repair: 'Repair',
      c_cardiac: 'Cardiac arrest', c_breath: 'Breathing trouble', c_fracture: 'Leg fracture', c_cut: 'Deep cut',
      c_birth: 'Childbirth', c_crash: 'Crash on D11', c_transfer: 'Transfer', c_stroke: 'Stroke', c_fall: 'Fall injury',
      night: 'Night call',
      go_to: 'Go', pick: 'Pick up', deliver: 'To ER', to_base: 'Back to base',
      arrived: 'Press ACTION', handover: 'Handover', triage: 'Who goes first?', triage_ok: 'Right call!', triage_bad: 'Not the most urgent',
      heli: 'Air rescue took over', smooth: 'Smooth run', red_light: 'Red light!', crash: 'Crash!',
      tap_rhythm: 'Tap to the beat', tap_fast: 'Tap fast!', tap_zone: 'Tap in the green', hold_breathe: 'Hold… release in green',
      perfect: 'Perfect', good: 'Good', ok: 'OK',
      paused: 'Paused', repaired: 'Repaired', dispatch: 'Dispatch', patient: 'Patient',
      rotate: 'Rotate your device', loading: 'Loading…', tap_start: 'Tap to start',
      help_drive: 'Drive', help_siren: 'Siren – traffic yields', help_horn: 'Horn – wakes 🎧 drivers',
      help_action: 'Action – treat / hand over', help_goal: 'Follow the arrow, treat the patient, drive smoothly to the ER.',
      help_smooth: 'Braking hard, crashes and kerbs hurt the patient.',
      daily_cardiac: 'Deliver 2 cardiac patients', daily_smooth: 'Smooth run of 1.5 km', daily_score: 'Score 2500 in one shift',
      daily_five: 'Deliver 5 patients', daily_village: 'Complete a call outside Hradec',
      reward: 'Reward',
    },
    cs: {
      _name: 'Čeština',
      title: 'Záchranka 155', subtitle: 'Hradec Králové',
      play: 'Hrát', garage: 'Garáž', records: 'Rekordy', settings: 'Nastavení', howto: 'Jak hrát',
      back: 'Zpět', resume: 'Pokračovat', menu: 'Menu', again: 'Hrát znovu', quit: 'Ukončit směnu',
      language: 'Jazyk', sound: 'Zvuk', siren_tone: 'Siréna', tone_hilo: 'Dvoutónová', tone_wail: 'Wail',
      on: 'Zap', off: 'Vyp', reset: 'Smazat postup', reset_q: 'Opravdu smazat postup?',
      osm: '© OpenStreetMap contributors',
      rank: 'Hodnost', coins: 'Mince', xp: 'XP', daily: 'Denní výzva', done: 'Splněno!',
      engine: 'Motor', suspension: 'Odpružení', siren: 'Siréna', max: 'MAX', buy: 'Koupit', locked: 'Hodnost',
      vehicles: 'Vozy', select: 'Jet', selected: 'Vybráno',
      veh_van: 'Standard', veh_suv: 'Rychlé 4×4', veh_box: 'Mobilní JIP', veh_rs: 'Speciál',
      rank0: 'Řidič', rank1: 'Záchranář', rank2: 'Starší záchranář', rank3: 'Vedoucí směny', rank4: 'Šéf stanice',
      shift_over: 'Konec směny', score: 'Skóre', saved: 'Pacienti', best_clean: 'Nejlepší plynulý průjezd', new_best: 'Nový rekord!',
      extend: '+60 s', repair: 'Oprava',
      c_cardiac: 'Zástava srdce', c_breath: 'Dušnost', c_fracture: 'Zlomená noha', c_cut: 'Řezná rána',
      c_birth: 'Porod', c_crash: 'Nehoda na D11', c_transfer: 'Převoz', c_stroke: 'Mrtvice', c_fall: 'Pád',
      night: 'Noční výjezd',
      go_to: 'Jeď', pick: 'Vyzvednout', deliver: 'Na urgent', to_base: 'Zpět na základnu',
      arrived: 'Stiskni AKCI', handover: 'Předání', triage: 'Koho vezeš první?', triage_ok: 'Správně!', triage_bad: 'Nebyl nejvážnější',
      heli: 'Převzal vrtulník', smooth: 'Plynulý průjezd', red_light: 'Na červenou!', crash: 'Náraz!',
      tap_rhythm: 'Ťukej do rytmu', tap_fast: 'Ťukej rychle!', tap_zone: 'Ťukni v zeleném', hold_breathe: 'Drž… pusť v zeleném',
      perfect: 'Výborně', good: 'Dobře', ok: 'Ujde',
      paused: 'Pauza', repaired: 'Opraveno', dispatch: 'Dispečink', patient: 'Pacient',
      rotate: 'Otoč zařízení', loading: 'Načítám…', tap_start: 'Ťukni pro start',
      help_drive: 'Jízda', help_siren: 'Siréna – auta uhýbají', help_horn: 'Klakson – probudí řidiče 🎧',
      help_action: 'Akce – ošetření / předání', help_goal: 'Sleduj šipku, ošetři pacienta a šetrně ho dovez na urgent.',
      help_smooth: 'Prudké brzdění, nárazy a obrubníky pacientovi škodí.',
      daily_cardiac: 'Doveď 2 pacienty se zástavou', daily_smooth: 'Plynulý průjezd 1,5 km', daily_score: 'Skóre 2500 za směnu',
      daily_five: 'Doveď 5 pacientů', daily_village: 'Výjezd mimo Hradec',
      reward: 'Odměna',
    },
  };
  Z.I18N = I18N;
  Z.lang = 'en';
  Z.detectLang = function () {
    var ls = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']);
    for (var i = 0; i < ls.length; i++) { var l = String(ls[i]).slice(0, 2).toLowerCase(); if (l === 'cs' || l === 'sk') return 'cs'; if (I18N[l]) return l; }
    return 'en';
  };
  Z.setLang = function (l) { Z.lang = I18N[l] ? l : 'en'; document.documentElement.lang = Z.lang; };
  Z.t = function (key, params) {
    var s = (I18N[Z.lang] && I18N[Z.lang][key]) || I18N.en[key] || key;
    if (params) for (var k in params) s = s.replace('{' + k + '}', params[k]);
    return s;
  };
})();
