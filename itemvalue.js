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
const N = +process.argv[2] || 500, BUMP = +process.argv[3] || 8;
function winRate(mut){ let w = 0, d = 0;
  for(let i = 0; i < N; i++){ const a = clone(team(i*2+1, 6, BUMP)), b = clone(team(i*2+2, 6, BUMP)); if(mut) mut(a);
    const r = E.simulateBattle(a, b, i*7919+13); if(r.result === 'win') w++; else if(r.result==='draw') d++; }
  return w / N; }
const t0 = Date.now();
const base = winRate(null);
console.log(`baseline ${(base*100).toFixed(1)}%  (N=${N}, bump ${BUMP})`);
const rows = [];
const test = (name, cost, fn) => { const per = [0,1,2,3,4,5].map(h => winRate(t => fn(t[h]))); 
  rows.push([name, cost, Math.max(...per) - base, per.reduce((a,b)=>a+b)/6 - base]); };
for(const k of Object.keys(E.HELD_ITEMS)) if(E.HELD_ITEMS[k].kind !== 'economy' && (!process.env.ONLY || process.env.ONLY.split(',').includes(k))) test(E.HELD_ITEMS[k].name, E.HELD_ITEMS[k].cost, u => { u.held = k; });
if(!process.env.ONLY || process.env.MED) test('Protein x1 (+9 atk)', 3, u => { u.atk += 9; });
if(!process.env.ONLY) test('HP Up x1 (+8 hp)', 3, u => { u.hp += 8; });
if(!process.env.ONLY) test('Carbos x1 (+10 spd)', 3, u => { u.spd += 10; });
console.log('item                      cost   best holder   avg holder   best per ₽');
for(const [n,c,b,a] of rows) console.log(n.padEnd(24), String(c+'₽').padStart(4), ((b*100).toFixed(1)+'%').padStart(12), ((a*100).toFixed(1)+'%').padStart(12), ((b/c*100).toFixed(2)+'%').padStart(11));
console.log(`${((Date.now()-t0)/1000).toFixed(0)}s`);
