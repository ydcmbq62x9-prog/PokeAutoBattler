/* v340: Brick Break and the gym difficulty pass. */
const E = require('./engine.js'); const S = E.SPECIES, T = E.TUNING;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
for(const k of ['hitmonlee','poliwrath']) check(S[k].move2.name === 'Brick Break' && S[k].move2.kind === 'breaker', `${k} has Brick Break`);
check(/shatters the target's barrier/.test(S.hitmonlee.move2.text(1)), 'Brick Break explains itself');
/* it really removes a barrier before the hit lands */
{ const a = E.makeUnit('hitmonlee', 0), d = E.makeUnit('onix', 0); a.spd = 500; a.atk = 30; a.hp = 3000; d.hp = 5000;
  const r = E.simulateBattle([a], [d], 9); const L = r.steps.flatMap(s => s.lines);
  check(L.some(l => /broke Onix's barrier/.test(l)), 'Brick Break breaks Onix’s opening barrier');
  const i = L.findIndex(l => /broke Onix's barrier/.test(l)); check(!/soaked/.test(L[i + 1] || '') , '…so the hit right after it is not soaked'); }
/* gym ramp */
const c = id => E.bossById(id).calib;
check(E.GYMS.every(g => g.calib > 1.15 && g.calib < 2.6), 'every gym calibration is in a sane range');
check(c('brock') < c('misty') && c('brock') < c('giovanni'), 'Brock is still the gentlest gym');
console.log(fails ? `${fails} FAILED` : 'v340 passed'); process.exit(fails ? 1 : 0);
