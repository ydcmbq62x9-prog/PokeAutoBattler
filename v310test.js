/* v310: Poison type, the Zubat / Koffing / Mankey lines, Hitmonchan and Jynx. */
const E = require('./engine.js'); const S = E.SPECIES, T = E.TUNING;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const want = { zubat:['Poison','support',2], golbat:['Poison','support',2], koffing:['Poison','tank',3], weezing:['Poison','tank',3],
  mankey:['Fighting','bruiser',3], primeape:['Fighting','bruiser',3], hitmonchan:['Fighting','bruiser',5], jynx:['Ice','support',4] };
for(const [k, [type, role, tier]] of Object.entries(want)) check(S[k] && S[k].type === type && S[k].role === role && S[k].tier === tier, `${k}: ${type} ${role}, tier ${tier}`);
check(['golbat','weezing','primeape'].every(k => S[k].token), 'the evolved forms are tokens, not sold');
check(E.BUYABLE.includes('zubat') && E.BUYABLE.includes('koffing') && E.BUYABLE.includes('mankey') && E.BUYABLE.includes('hitmonchan') && E.BUYABLE.includes('jynx'), 'the five lines are buyable');
check(E.evoNext('zubat').some(e => e.into === 'golbat' && e.by === 'level') && E.evoNext('koffing').some(e => e.into === 'weezing') && E.evoNext('mankey').some(e => e.into === 'primeape'), 'they evolve by level');
check(E.TYPES.Poison.weak.join() === 'Ground,Psychic' && E.TYPES.Poison.resist.join() === 'Grass,Fighting,Poison,Bug', 'Poison is weak to Ground and Psychic, resists Grass, Fighting, Poison, Bug');
check(E.typeMult('Poison','Grass') === 2 && E.typeMult('Poison','Ground') === 0.5 && E.typeMult('Poison','Ghost') === 0.5 && E.typeMult('Ground','Poison') === 2, 'Poison chart hits');
check(E.MONO_TYPES.includes('Fighting') && !E.MONO_TYPES.includes('Ice'), 'Fighting is a Mono type; Ice (1 line) is not');   // 3.8.0: Poison reached 4 lines, so it is a Mono type now
check(T.mods.monoFoes.Fighting > 0.6 && T.mods.monoFoes.Fighting < 1.6, 'Mono-Fighting has a factor');
check(E.themePool(E.bossById('lorelei')).includes('jynx') && E.themePool(E.bossById('bruno')).includes('mankey') && E.themePool(E.bossById('bruno')).includes('hitmonchan') && E.themePool(E.bossById('koga')).includes('koffing') && E.themePool(E.bossById('agatha')).includes('zubat'), 'the new pokémon join the boss pools they fit');
check(E.bossById('koga').signature[0] === 'weezing', 'Koga leads with Weezing');
check(S.zubat.move.kind === 'drain' && S.mankey.move.kind === 'multi', 'move kinds');
// battle smoke: every new pokémon fights without errors
for(const k of Object.keys(want)){ const r = E.simulateBattle([E.makeUnit(k, 0)], [E.makeUnit('rattata', 0)], 5); check(!!r.result, `${k} fights`); }
console.log(fails ? `${fails} FAILED` : 'v310 passed'); process.exit(fails ? 1 : 0);
