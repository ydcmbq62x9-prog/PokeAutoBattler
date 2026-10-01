/* 2.6.0: Paras, Parasect, Exeggcute, Exeggutor and the Leaf Stone. */
const E = require('./engine.js'); const S = E.SPECIES, T = E.TUNING;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const mk = (id, bank) => { const u = E.makeUnit(id, T.expForLevel2); E.growUnit(u, bank || { hp:48, atk:48, spd:24 }); return u; };
const lines = r => r.steps.flatMap(s => s.lines);
for(const id of ['paras', 'parasect', 'exeggcute', 'exeggutor']) check(!!S[id] && S[id].type === (id[0] === 'p' ? 'Bug' : 'Grass'), id + ' exists and has its real main type');
check(E.roleOf('paras') === 'bruiser' && E.roleOf('parasect') === 'bruiser', 'Paras line is a Bruiser');
check(E.roleOf('exeggcute') === 'cannon' && E.roleOf('exeggutor') === 'cannon', 'Exeggcute line is a Cannon');
check(E.evoNext('paras').some(e => e.into === 'parasect' && e.by === 'level'), 'Paras evolves into Parasect');
check(E.stonesFor('exeggcute').includes('leafstone') && E.evoNext('exeggcute').some(e => e.into === 'exeggutor'), 'Exeggcute evolves with the Leaf Stone');
check(E.ITEMS.leafstone && E.ITEMS.leafstone.eligible(E.makeUnit('exeggcute', 0)) && !E.ITEMS.leafstone.eligible(E.makeUnit('paras', 0)), 'Leaf Stone only works on Exeggcute');
{ const u = E.makeUnit('exeggcute', 0); const G = { evolve: (x, st) => { x.evolvedWith = st; } }; E.ITEMS.leafstone.apply(u, G); check(u.evolvedWith === 'leafstone', 'Leaf Stone applies the leafstone evolution'); }
{ const r = E.simulateBattle([mk('parasect')], [mk('snorlax'), mk('golem')], 4), L = lines(r);
  check(L.some(l => /Parasect used Spore/.test(l)), 'Parasect uses Spore'); }
{ const j = mk('exeggutor'); j.hp = 900; const r = E.simulateBattle([j], [mk('snorlax'), mk('golem'), mk('onix')], 3), L = lines(r);
  check(L.some(l => /Exeggutor used Solar Beam/.test(l)) && L.some(l => /Exeggutor used Egg Bomb/.test(l)), 'Exeggutor alternates Solar Beam and Egg Bomb'); }
check(T.mods.monoFoes.Grass < 1, 'Mono-Grass has a foe factor (re-measured in 3.0.0, pinned in v300test)');
console.log(fails ? `${fails} FAILED` : 'v260 passed'); process.exit(fails ? 1 : 0);
