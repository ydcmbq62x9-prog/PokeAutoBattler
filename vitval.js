// node vitval.js N  — win-rate gain of one consumable's stat boost on one holder of each role (same teams as itemvalue2)
const E = require('./engine.js');
const ROSTER = E.BUYABLE.filter(k => E.SPECIES[k].tier <= 4);
function team(seed, size = 6, bumpBase = 8){
  let s = seed >>> 0; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const out = [];
  for(let i = 0; i < size; i++){ const u = E.makeUnit(ROSTER[Math.floor(rnd() * ROSTER.length)], 0);
    const bump = bumpBase + Math.floor(rnd() * 8); u.hp += bump * 3; u.atk += bump * 3; u.spd += bump * 2; u.pos = i; out.push(u); }
  return out;
}
const clone = t => t.map(u => Object.assign({}, u));
const N = +process.argv[2] || 1500;
const BOOST = { protein:{atk:12}, hpup:{hp:8}, carbos:{spd:10}, ironvit:{hp:12}, calcium:{atk:15}, zinc:{hp:5,spd:6}, energyroot:{hp:5,atk:5,spd:5}, manual:{hp:6,atk:6,spd:6} };
const ROLES = ['tank','bruiser','support','cannon'];
const only = { ironvit:'tank', calcium:'cannon', zinc:'support', energyroot:'bruiser' };
for(const [k, b] of Object.entries(BOOST)){
  const out = [];
  for(const role of ROLES){
    if(only[k] && only[k] !== role){ out.push('   -  '); continue; }
    let base = 0, w = 0, n = 0;
    for(let i = 0; i < N; i++){
      const A = team(i*2+1), B = team(i*2+2); const h = A.findIndex(u => E.roleOf(u.id) === role); if(h < 0) continue; n++;
      const a0 = clone(A), a1 = clone(A); for(const s in b) a1[h][s] += b[s];
      if(E.simulateBattle(a0, clone(B), i*7919+13).result === 'win') base++;
      if(E.simulateBattle(a1, clone(B), i*7919+13).result === 'win') w++;
    }
    out.push(((w - base) / n * 100).toFixed(1).padStart(5));
  }
  console.log(k.padEnd(11), ROLES.map((r, i) => r.slice(0,4) + ':' + out[i]).join(' '));
}
