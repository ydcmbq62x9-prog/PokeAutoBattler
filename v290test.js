/* 2.9.0: gym leaders and the Elite Four lead with a signature pokémon. */
const E = require('./engine.js'); const S = E.SPECIES;
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const bosses = E.ALL_BOSSES.filter(b => b.theme);
check(bosses.length === 12 && bosses.every(b => Array.isArray(b.signature) && b.signature.length >= 2), 'every gym leader and Elite Four member has a signature list');
check(bosses.every(b => b.signature.every(k => S[k])), 'every signature is a real species');
check(!E.CHAMPION.signature, 'the Champion has none (he has his rival starter, an Eeveelution and a legendary)');
const team = (b, turn, badges, kind) => E.generateAiTeam({ turn, seed:5, badges, kind, boss:b, tier: kind === 'gym' ? Math.min(3, 1 + Math.floor(turn / 8)) : 5 });
{ const b = E.bossById('blaine'); const t = team(b, 28, 6, 'gym').team.map(u => u.id);
  check(t.some(id => ['arcanine', 'growlithe'].includes(id)), 'Blaine fields Arcanine or Growlithe'); }
{ const b = E.bossById('lance'); let n = 0; for(let s = 1; s <= 20; s++){ const t = E.generateAiTeam({ turn:33, seed:s, badges:8, kind:'elite', boss:b, tier:6 }).team.map(u => u.id);
    if(t.some(id => E.evoLine('dratini').includes(id))) n++; }
  check(n === 20, `Lance has his Dragon line in 20 of 20 seeds (${n})`); }
{ const b = E.bossById('brock'); const t = E.generateAiTeam({ turn:4, seed:9, badges:0, kind:'gym', boss:b, tier:1 }).team.map(u => u.id);
  check(!t.includes('golem') && !t.includes('rhydon'), 'Brock’s first team has no Golem or Rhydon (evolution depth is still gated)'); }
console.log(fails ? `${fails} FAILED` : 'v290 passed'); process.exit(fails ? 1 : 0);
