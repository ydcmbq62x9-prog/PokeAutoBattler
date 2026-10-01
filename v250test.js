/* 2.5.0: starter roles swapped, Jolteon's Thunderbolt, Blastoise's charge, and the What's new entry. */
const E = require('./engine.js'); const S = E.SPECIES, T = E.TUNING;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const mk = (id, bank) => { const u = E.makeUnit(id, T.expForLevel2); E.growUnit(u, bank || { hp:48, atk:48, spd:24 }); return u; };
const lines = r => r.steps.flatMap(s => s.lines);
{ const j = mk('jolteon'); j.hp = 900; const r = E.simulateBattle([j], [mk('snorlax'), mk('golem'), mk('onix')], 3);
  const L = lines(r), tb = L.findIndex(l => l === 'Jolteon used Thunderbolt!');
  check(tb > 0, 'Jolteon uses Thunderbolt in battle');
  const after = L.slice(tb + 1, tb + 8).filter(l => /took \d+/.test(l));
  check(after.length >= 3, `Thunderbolt hits every enemy (${after.length} hit lines after it)`); }
check(S.jolteon.hp === 24 && S.jolteon.atk === 28 && S.jolteon.spd === 64, 'Jolteon is 24/28/64 (38/72 in 2.5.0, trimmed in 3.2.0 and 3.5.0)');
check(S.jolteon.move.name === 'Pin Missile', 'Jolteon keeps Pin Missile as its main move');
/* roles and growth */
const grown = id => { const u = E.makeUnit(id, 0); const h = u.hp; E.growUnit(u, { hp: 10, atk: 10, spd: 10 }); return { dhp: u.hp - h }; };
check(grown('bulbasaur').dhp > grown('squirtle').dhp, 'a Bulbasaur grows more HP than a Squirtle now (Tank 1.8× vs Bruiser 1×)');
check(E.roleOf('venusaur') === 'tank' && E.roleOf('blastoise') === 'bruiser', 'Venusaur is a Tank, Blastoise a Bruiser');
/* tank / bruiser traits actually apply */
{ const a = mk('venusaur'), b = mk('blastoise'); const r = E.simulateBattle([a], [b], 5); check(!!r && r.steps.length > 3, 'the two finals fight each other without error'); }
/* Blastoise: Surf hits everyone (3.3.0; it was a charged Hydro Pump), Bubble every 3rd */
{ const r = E.simulateBattle([mk('blastoise')], [mk('snorlax')], 6), L = lines(r);
  const acts = L.filter(l => /^Blastoise used /.test(l));
  check(acts.some(l => /Surf/.test(l)) && acts.some(l => /Bubble/.test(l)), `Blastoise alternates Surf and Bubble (${[...new Set(acts)].join(', ')})`); }
/* Squirtle line: Water Gun 105 → 120, Bubble slows */
check(/Deals 105% damage/.test(S.squirtle.move.text(1)) && /120%/.test(S.wartortle.move.text(1)), 'Water Gun gets stronger with each evolution');
check(/cuts the target's Speed/.test(S.squirtle.move2.text(1)) && S.squirtle.move2.when() === 'Every 3rd action', 'Squirtle’s Bubble is a slow every 3rd action');
/* Venusaur: Poison Powder stronger up the line, no Solar Beam */
const pp = id => +/Deals (\d+)%/.exec(S[id].move2.text(1))[1];
check(pp('bulbasaur') < pp('ivysaur') && pp('ivysaur') < pp('venusaur'), `Poison Powder scales up the line (${pp('bulbasaur')}% → ${pp('ivysaur')}% → ${pp('venusaur')}%)`);
/* run rules were re-tuned */
check(T.mods.richFoes > 1.1 && T.mods.nopcFoes > 0.8 && T.mods.monoFoes.Grass < 1, 'run-rule factors exist (exact values are pinned in v300test)');
console.log(fails ? `${fails} FAILED` : 'v250 passed'); process.exit(fails ? 1 : 0);
