#!/usr/bin/env node
/* One door for balance measurements, so a balance patch is "run, read the table, edit a number, run again".
     node bal.js items [N]            every held item on every role, flagged against its rarity's target band
     node bal.js vit [N]              every consumable stat boost on one holder per role
     node bal.js econ [N] [variants]  bot runs with a gift: base inc1 inc2 inc4 egg share1 share3 candy1 candy3
     node bal.js rate [N] [gens]      bot clear rate, e.g.  node bal.js rate 300 [1,2,3]
   Set PATCH='{"scope":{"pct":{"atk":0.7}}}' to try a held-item change without editing engine.js.
   Reads its targets from TARGET below: edit there when the design intent changes. */
const E = require('./engine.js'), cp = require('child_process');
if(process.env.PATCH){ const P = JSON.parse(process.env.PATCH); for(const k in P) Object.assign(E.HELD_ITEMS[k] || E.ITEMS[k], P[k]); }
const ROLES = ['tank', 'bruiser', 'support', 'cannon'];
/* points of win rate an item should add on its best holder, by rarity */
const TARGET = { common:[2.5, 5], uncommon:[4, 6.5], rare:[5, 7.5], veryrare:[6, 8.5] };
const [cmd = 'help', ...rest] = process.argv.slice(2);

const ROSTER = E.BUYABLE.filter(k => E.SPECIES[k].tier <= 4);
function team(seed, size = 6, bumpBase = 8){
  let s = seed >>> 0; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const out = [];
  for(let i = 0; i < size; i++){ const u = E.makeUnit(ROSTER[Math.floor(rnd() * ROSTER.length)], 0);
    const bump = bumpBase + Math.floor(rnd() * 8); u.hp += bump * 3; u.atk += bump * 3; u.spd += bump * 2; u.pos = i; out.push(u); }
  return out;
}
const clone = t => t.map(u => Object.assign({}, u));
/** Paired comparison: same teams, same seeds, with and without `mod(unit)` on one holder of `role`. */
function gain(N, role, mod){
  let base = 0, w = 0, n = 0;
  for(let i = 0; i < N; i++){
    const A = team(i * 2 + 1), B = team(i * 2 + 2); const h = A.findIndex(u => E.roleOf(u.id) === role); if(h < 0) continue; n++;
    const a0 = clone(A), a1 = clone(A); mod(a1[h]);
    if(E.simulateBattle(a0, clone(B), i * 7919 + 13).result === 'win') base++;
    if(E.simulateBattle(a1, clone(B), i * 7919 + 13).result === 'win') w++;
  }
  return n ? (w - base) / n * 100 : NaN;
}
const f1 = x => (isNaN(x) ? '  -  ' : (x >= 0 ? ' ' : '') + x.toFixed(1)).padStart(5);

if(cmd === 'items'){
  const N = +rest[0] || 1200;
  console.log('item'.padEnd(13) + 'rarity'.padEnd(10) + ROLES.map(r => r.padStart(8)).join('') + '   best  band');
  for(const [k, d] of Object.entries(E.HELD_ITEMS)){
    if(d.kind === 'economy'){ console.log(k.padEnd(13) + (d.rarity || 'common').padEnd(10) + '  (economy: use  bal.js econ)'); continue; }
    const g = ROLES.map(r => (d.role && d.role !== r) ? NaN : gain(N, r, u => { u.held = k; }));
    const best = Math.max(...g.filter(x => !isNaN(x))), [lo, hi] = TARGET[d.rarity || 'common'];
    console.log(k.padEnd(13) + (d.rarity || 'common').padEnd(10) + g.map(x => f1(x).padStart(8)).join('') + f1(best).padStart(7) + '  ' + (best < lo ? 'LOW  (want ' + lo + '-' + hi + ')' : best > hi ? 'HIGH (want ' + lo + '-' + hi + ')' : 'ok'));
  }
} else if(cmd === 'vit'){
  const N = +rest[0] || 1200;
  console.log('boost'.padEnd(13) + ROLES.map(r => r.padStart(8)).join(''));
  for(const [k, d] of Object.entries(E.ITEMS)){
    const b = d.boost || d.train; if(!b) continue;
    const g = ROLES.map(r => (d.role && d.role !== r) ? NaN : gain(N, r, u => { for(const s in b) u[s] += b[s]; }));
    console.log(k.padEnd(13) + g.map(x => f1(x).padStart(8)).join(''));
  }
} else if(cmd === 'econ'){
  const N = rest[0] || '700', vs = (rest[1] || 'base inc1 inc2 egg share1 candy1').split(/[ ,]+/);
  const ps = vs.map(v => new Promise(res => cp.exec(`node expval.js ${N} ${v}`, (e, o) => res(o.trim()))));
  Promise.all(ps.reduce((acc, p, i) => { acc.push(i % 2 ? acc[i - 1].then(() => p) : p); return acc; }, [])).then(o => console.log(o.join('\n')));
} else if(cmd === 'rate'){
  const r = cp.spawnSync('node', ['rate.js', rest[0] || '300', rest[1] || '[1,2,3]'], { stdio:'inherit' });
} else console.log(require('fs').readFileSync(__filename, 'utf8').split('\n').slice(1, 8).join('\n'));
