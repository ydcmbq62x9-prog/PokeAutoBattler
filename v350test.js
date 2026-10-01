/* v350: tank identities and the counter moves. */
const E = require('./engine.js'); const S = E.SPECIES, T = E.TUNING;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
check(S.tangela.hp === 70 && S.tangela.move.text(1).includes('230%'), 'Tangela is sturdier and Bind hits 230% from the front');
check(S.venusaur.move.text(1).includes('100%') && S.venusaur.hp === 56, 'Venusaur’s Giga Drain heals all the damage; 56 HP');
check(S.vaporeon.move2.trig === 'open' && S.vaporeon.move2.free, 'Vaporeon opens with Acid Armor');
for(const [k, name, kind] of [['alakazam','Disable','disable'],['electabuzz','Disable','disable'],['starmie','Haze','haze'],['scyther','Knock Off','knock']])
  check(S[k].move2.name === name && S[k].move2.kind === kind, `${k} has ${name}`);
const mk = id => E.makeUnit(id, 0);
const L = r => r.steps.flatMap(s => s.lines);
/* Disable seals the target's second move */
{ const a = mk('alakazam'), d = mk('snorlax'); a.atk = 30; a.hp = 3000; a.spd = 500; d.hp = 6000;
  const l = L(E.simulateBattle([a], [d], 4)); const i = l.findIndex(x => /sealed Snorlax's/.test(x));
  check(i >= 0, 'Disable seals the foe’s second move'); }
{ const a = mk('alakazam'), d = mk('onix'); a.atk = 30; a.hp = 3000; a.spd = 500; d.hp = 6000;
  const l = L(E.simulateBattle([a], [d], 4)); check(l.some(x => /sealed Onix's Iron Defense/.test(x)) || l.some(x => /Onix used Iron Defense/.test(x)), 'a sealed opener is either sealed or already used'); }
/* Haze wipes a ramp-up */
{ const a = mk('starmie'), d = mk('primeape'); a.atk = 30; a.hp = 4000; a.spd = 500; d.hp = 4000; d.spd = 300;
  const l = L(E.simulateBattle([a], [d], 5)); check(l.some(x => /cleared Primeape's boosts/.test(x)), 'Haze clears Primeape’s Rage'); }
/* Knock Off strips an item */
{ const a = mk('scyther'), d = mk('machop'); d.held = 'sitrus'; a.atk = 30; a.hp = 4000; a.spd = 500; d.hp = 4000;
  const l = L(E.simulateBattle([a], [d], 6)); check(l.some(x => /knocked off Machop's/.test(x)), 'Knock Off strips a held item'); }
check(E.ALL_BOSSES.every(b => (b.calib || 1) > 1.1 && (b.calib || 1) < 2.6), 'every calibration is in a sane range');
console.log(fails ? `${fails} FAILED` : 'v350 passed'); process.exit(fails ? 1 : 0);
