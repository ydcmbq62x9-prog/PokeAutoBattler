// node itemvalue2.js N itemKey [role]  — win-rate gain when ONE holder of that role (default support) holds the item, teams that have one only
const E = require('./engine.js');
if(process.env.PATCH){ const P = JSON.parse(process.env.PATCH); for(const k in P) Object.assign(E.HELD_ITEMS[k], P[k]); }
const ROSTER = E.BUYABLE.filter(k => E.SPECIES[k].tier <= 4);
function team(seed, size = 6, bumpBase = 8){
  let s = seed >>> 0; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const out = [];
  for(let i = 0; i < size; i++){ const u = E.makeUnit(ROSTER[Math.floor(rnd() * ROSTER.length)], 0);
    const bump = bumpBase + Math.floor(rnd() * 8); u.hp += bump * 3; u.atk += bump * 3; u.spd += bump * 2; u.pos = i; out.push(u); }
  return out;
}
const clone = t => t.map(u => Object.assign({}, u));
const N = +process.argv[2] || 600, key = process.argv[3], role = process.argv[4] || 'support';
let base = 0, withI = 0, n = 0;
for(let i = 0; i < N; i++){
  const A = team(i*2+1), B = team(i*2+2); const h = A.findIndex(u => E.roleOf(u.id) === role); if(h < 0) continue;
  n++;
  const a0 = clone(A), a1 = clone(A); a1[h].held = key;
  if(E.simulateBattle(a0, clone(B), i*7919+13).result === 'win') base++;
  if(E.simulateBattle(a1, clone(B), i*7919+13).result === 'win') withI++;
}
console.log(key, role, 'teams', n, 'base', (base/n*100).toFixed(1) + '%', 'with', (withI/n*100).toFixed(1) + '%', 'gain', ((withI-base)/n*100).toFixed(1) + '%');
