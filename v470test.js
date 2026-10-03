/* 4.7.0: Eviolite is +50% HP and counts every Gen 2 evolution when Gen 2 is on. */
const E = require('./engine.js');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
check(E.HELD_ITEMS.evio.pct.hp === 0.5 && /\+50% HP/.test(E.HELD_ITEMS.evio.text), 'Eviolite gives +50% HP');
const open = ['scyther', 'chansey', 'onix', 'porygon', 'golbat', 'seadra'];
for(const seed of [1, 2, 3, 4, 5]){
  const G = E.newGame(seed, { gens: [1, 2] });
  check(open.every(k => E.canStillEvolve(k)), `seed ${seed} (pool ${G.evoPool.join('/')}): every Gen 2 evolution counts in a mixed run`);
  const u = E.makeUnit('scyther', 0); u.held = 'evio'; check(E.heldStats(u).hp === Math.round(u.hp * 0.5), `seed ${seed}: a Scyther with Eviolite gets +50% HP`);
}
E.newGame(1, { gens: [2] }); check(open.every(k => E.canStillEvolve(k)), 'Gen 2-only: all count');
E.newGame(1, { gens: [1] }); check(open.every(k => !E.canStillEvolve(k)) && E.canStillEvolve('pikachu') && E.canStillEvolve('gloom'), 'Gen 1-only: no Scizor, so Scyther is switched off, ordinary evolutions still count');
const f = E.makeUnit('raichu', 0); f.held = 'evio'; check(E.heldStats(f).hp === 0, 'a fully evolved pokémon gets nothing');
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
