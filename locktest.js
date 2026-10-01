/* What does losing the second move cost each species? Lock alone, no Attack bonus. */
const E = require('./engine.js');
E.HELD_ITEMS.choice.pct = {};
const ROSTER = E.BUYABLE.filter(k => E.SPECIES[k].tier <= 4);
function rng(seed){ let s = seed>>>0; return () => (s = (s*1664525+1013904223)>>>0)/4294967296; }
function mk(id, r){ const u = E.makeUnit(id, 0); const b = 10 + Math.floor(r()*8); u.hp += b*3; u.atk += b*3; u.spd += b*2; return u; }
const clone = t => t.map(u => Object.assign({}, u));
const N = +process.argv[2] || 300;
const out = [];
const species = [...new Set(Object.keys(E.SPECIES).filter(k => E.SPECIES[k].move2))];
for(const sp of species){
  let a = 0, b = 0;
  for(let i = 0; i < N; i++){ const r = rng(i*13+5);
    const t = []; for(let k = 0; k < 6; k++){ const u = mk(ROSTER[Math.floor(r()*ROSTER.length)], r); u.pos = k; t.push(u); }
    const idx = Math.floor(r()*6); t[idx] = Object.assign(mk(sp, r), { pos: idx });
    const e = []; for(let k = 0; k < 6; k++){ const u = mk(ROSTER[Math.floor(r()*ROSTER.length)], r); u.pos = k; e.push(u); }
    if(E.simulateBattle(clone(t), clone(e), i*7919+1).result === 'win') a++;
    const t2 = clone(t); t2[idx].held = 'choice';
    if(E.simulateBattle(t2, clone(e), i*7919+1).result === 'win') b++; }
  out.push([sp, (b - a) / N, E.SPECIES[sp].move2.name]);
}
out.sort((x, y) => y[1] - x[1]);
const avg = out.reduce((n, x) => n + x[1], 0) / out.length;
console.log(`average effect of the lock alone: ${(avg*100).toFixed(1)}%  (${out.length} species)`);
console.log('helps most:', out.slice(0, 8).map(x => `${x[0]} ${(x[1]*100).toFixed(1)}% (${x[2]})`).join(', '));
console.log('hurts most:', out.slice(-8).map(x => `${x[0]} ${(x[1]*100).toFixed(1)}% (${x[2]})`).join(', '));
console.log('share that the lock helps:', (out.filter(x => x[1] > 0.01).length / out.length).toFixed(2), ' hurts:', (out.filter(x => x[1] < -0.01).length / out.length).toFixed(2));
