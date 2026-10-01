/* 2.11.0: tougher gyms, re-tuned run rules, One Life has its own foe factor. */
const E = require('./engine.js'); const T = E.TUNING;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const c = id => E.bossById(id).calib;
check(['brock','misty','surge','erika'].every(id => c(id) > 1), 'gym calibs are set (exact values are pinned in v340test)');
check(['koga','sabrina','blaine','giovanni'].every(id => c(id) > 1), 'gym calibs are set (exact values are pinned in v340test)');
check(T.gauntletRatio.length === 5, 'Elite Four and Champion ratios exist (values pinned in v300test)');
check(typeof T.mods.onelifeFoes === 'number', 'One Life has its own foe factor');
check(E.MONO_TYPES.every(t => typeof T.mods.monoFoes[t] === 'number'), 'every Mono type has a factor');
/* the factor really scales the foes */
{ const a = E.newGame(7, { mods:{ onelife:true } }), b = E.newGame(7, {});
  for(const g of [a, b]){ E.rollShop(g, false); }
  const oa = E.opponentFor(a), ob = E.opponentFor(b);
  check(oa.team[0].hp >= ob.team[0].hp, 'One Life foes are at least as strong as normal ones'); }
console.log(fails ? `${fails} FAILED` : 'v2110 passed'); process.exit(fails ? 1 : 0);
