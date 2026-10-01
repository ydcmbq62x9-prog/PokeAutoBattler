/* 2.7.0: the Bellsprout line, Leaf Stone on Weepinbell, re-tuned run rules. */
const E = require('./engine.js'); const S = E.SPECIES, T = E.TUNING;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const mk = (id, bank) => { const u = E.makeUnit(id, T.expForLevel2); E.growUnit(u, bank || { hp:48, atk:48, spd:24 }); return u; };
const lines = r => r.steps.flatMap(s => s.lines);
for(const id of ['bellsprout', 'weepinbell', 'victreebel']) check(!!S[id] && S[id].type === 'Grass' && E.roleOf(id) === 'cannon' && S[id].tier === 3, id + ' is a Tier 3 Grass Cannon');
check(E.evoNext('bellsprout').some(e => e.into === 'weepinbell' && e.by === 'level'), 'Bellsprout evolves into Weepinbell by level');
check(E.evoNext('weepinbell').some(e => e.into === 'victreebel' && e.stone === 'leafstone'), 'Weepinbell evolves into Victreebel with a Leaf Stone');
check(E.ITEMS.leafstone.eligible(E.makeUnit('weepinbell', 0)) && E.ITEMS.leafstone.eligible(E.makeUnit('exeggcute', 0)) && !E.ITEMS.leafstone.eligible(E.makeUnit('bellsprout', 0)), 'Leaf Stone works on Weepinbell and Exeggcute, not Bellsprout');
{ const j = mk('victreebel'); j.hp = 900; const r = E.simulateBattle([j], [mk('snorlax'), mk('golem'), mk('onix')], 3), L = lines(r);
  check(L.some(l => /Victreebel used Razor Leaf/.test(l)) && L.some(l => /Victreebel used Poison Powder/.test(l)), 'Victreebel uses Razor Leaf and Poison Powder'); }
check(/Deals 130%/.test(S.bellsprout.move.text(1)) && /Deals 185%/.test(S.victreebel.move.text(1)), 'Vine Whip 130% → Razor Leaf 185%');
check(E.MONO_TYPES.every(t => T.mods.monoFoes[t] > 0.6 && T.mods.monoFoes[t] < 1.6), 'mono factors exist (re-tuned in 3.0.0, pinned in v300test)');
check(T.mods.richFoes > 1.1, 'Rich & Ruthless foe factor (re-tuned in 3.0.0)');
console.log(fails ? `${fails} FAILED` : 'v270 passed'); process.exit(fails ? 1 : 0);
