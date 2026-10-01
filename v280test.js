/* 2.8.0: Tangela, the Tier 3 Grass Tank. */
const fs = require('fs'); const E = require('./engine.js'); const S = E.SPECIES, T = E.TUNING;
const SPRITES = new Function(fs.readFileSync('sprites.js', 'utf8') + '; return SPRITES;')();
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const mk = (id, bank) => { const u = E.makeUnit(id, T.expForLevel2); E.growUnit(u, bank || { hp:48, atk:48, spd:24 }); return u; };
const lines = r => r.steps.flatMap(s => s.lines);
check(!!S.tangela && S.tangela.type === 'Grass' && S.tangela.tier === 3 && E.roleOf('tangela') === 'tank', 'Tangela is a Tier 3 Grass Tank');
check(E.BUYABLE.includes('tangela') && E.evoNext('tangela').length === 0, 'Tangela is buyable and does not evolve');
check(/while it stands in your front rank/.test(S.tangela.move.text(1)) && S.tangela.move.name === 'Bind', 'Bind hits harder from the front rank');
{ const t = mk('tangela'); t.hp = 900; const r = E.simulateBattle([t], [mk('snorlax'), mk('golem'), mk('onix')], 3), L = lines(r);
  check(L.some(l => /Tangela used Bind/.test(l)) && L.some(l => /Tangela used Stun Spore/.test(l)), 'Tangela uses Bind and Stun Spore'); }
check(/^data:image\/png;base64,/.test(SPRITES.tangela || ''), 'Tangela has a sprite');
check(T.mods.richFoes > 1.1 && T.gauntletRatio[0] > 0.3, 'run rules exist (re-measured in 3.0.0, pinned in v300test)');
console.log(fails ? `${fails} FAILED` : 'v280 passed'); process.exit(fails ? 1 : 0);
