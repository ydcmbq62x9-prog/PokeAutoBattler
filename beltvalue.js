/* Expert Belt where it's meant to shine: into a themed (gym-like) team that resists the holder. */
const E = require('./engine.js');
const ROSTER = E.BUYABLE.filter(k => E.SPECIES[k].tier <= 4);
const types = [...new Set(ROSTER.map(k => E.SPECIES[k].type))];
const N = +process.argv[2] || 600;
function mk(id, rnd){ const u = E.makeUnit(id, 0); const b = 10 + Math.floor(rnd()*8); u.hp += b*3; u.atk += b*3; u.spd += b*2; return u; }
function rng(seed){ let s = seed>>>0; return () => (s = (s*1664525+1013904223)>>>0)/4294967296; }
const clone = t => t.map(u => Object.assign({}, u));
let rows = [];
for(const T of types){
  const foes = ROSTER.filter(k => E.SPECIES[k].type === T);
  // attacker types that T resists
  const weakAtk = types.filter(A => E.typeMult(A, T) < 1);
  if(!weakAtk.length) continue;
  const mine = ROSTER.filter(k => weakAtk.includes(E.SPECIES[k].type));
  const res = { none:0, belt:0, band:0 };
  for(let i = 0; i < N; i++){
    const r = rng(i*31+7);
    const a = []; for(let k = 0; k < 6; k++){ const u = mk(ROSTER[Math.floor(r()*ROSTER.length)], r); u.pos = k; a.push(u); }
    const hIdx = Math.floor(r()*6); a[hIdx] = Object.assign(mk(mine[Math.floor(r()*mine.length)], r), { pos:hIdx });
    const b = []; for(let k = 0; k < 6; k++){ const u = mk(foes[Math.floor(r()*foes.length)], r); u.pos = k; b.push(u); }
    for(const [key, item] of [['none', null], ['belt', 'char'], ['band', 'band']]){
      const aa = clone(a); aa[hIdx].held = item;
      if(E.simulateBattle(aa, clone(b), i*7919+3).result === 'win') res[key]++;
    }
  }
  rows.push(`${T.padEnd(10)} vs resisted ${weakAtk.join('/')}: base ${(res.none/N*100).toFixed(1)}%  Expert Belt ${((res.belt-res.none)/N*100).toFixed(1)}%  Muscle Band ${((res.band-res.none)/N*100).toFixed(1)}%`);
}
console.log(rows.join('\n'));
