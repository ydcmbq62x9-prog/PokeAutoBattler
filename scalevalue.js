/* Heart Scale on a healer: a mid-run team with one healing Support, the scale on that Support. */
const E = require('./engine.js');
if(process.env.PATCH){ const P = JSON.parse(process.env.PATCH); for(const k in P) Object.assign(E.HELD_ITEMS[k], P[k]); }
const ROSTER = E.BUYABLE.filter(k => E.SPECIES[k].tier <= 4);
const HEALERS = ROSTER.filter(k => E.roleOf(k) === 'support');
const N = +process.argv[2] || 800, BUMP = +process.argv[3] || 10;
function rng(seed){ let s = seed>>>0; return () => (s = (s*1664525+1013904223)>>>0)/4294967296; }
function mk(id, r){ const u = E.makeUnit(id, 0); const b = BUMP + Math.floor(r()*8); u.hp += b*3; u.atk += b*3; u.spd += b*2; return u; }
const clone = t => t.map(u => Object.assign({}, u));
function rate(item, other){ let w = 0;
  for(let i = 0; i < N; i++){ const r = rng(i*17+3);
    const a = []; for(let k = 0; k < 6; k++){ const u = mk(ROSTER[Math.floor(r()*ROSTER.length)], r); u.pos = k; a.push(u); }
    a[4] = Object.assign(mk(HEALERS[Math.floor(r()*HEALERS.length)], r), { pos:4, held:item });
    const b = []; for(let k = 0; k < 6; k++){ const u = mk(ROSTER[Math.floor(r()*ROSTER.length)], r); u.pos = k; b.push(u); }
    if(E.simulateBattle(a, b, i*7919+11).result === 'win') w++; }
  return w / N; }
const base = rate(null);
console.log(`healers: ${HEALERS.join(', ')}`);
console.log(`base ${(base*100).toFixed(1)}%  Heart Scale on the Support +${((rate('scale')-base)*100).toFixed(1)}%  Muscle Band on it +${((rate('band')-base)*100).toFixed(1)}%  Sitrus on it +${((rate('sitrus')-base)*100).toFixed(1)}%`);
