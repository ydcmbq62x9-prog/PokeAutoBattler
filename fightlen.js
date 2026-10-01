const E = require(process.env.ENG || './engine.js');
const finals = [...new Set(E.BUYABLE.map(k => { const l = E.evoLine(k); return l[l.length-1]; }))];
function rnd(s){ let x = s>>>0||1; return () => { x^=x<<13; x>>>=0; x^=x>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }
const mk = id => { const u = E.makeUnit(id, E.TUNING.expForLevel2); E.growUnit(u, {hp:48,atk:48,spd:24}); return u; };
let acts = 0, rounds = 0, n = 300, cnt = {};
for(let i = 0; i < n; i++){ const r = rnd(i*31+5); const p = () => finals[Math.floor(r()*finals.length)];
  const A = E.formationSort([p(),p(),p(),p(),p(),p()].map(mk)), B = E.formationSort([p(),p(),p(),p(),p(),p()].map(mk));
  const s = E.simulateBattle(A, B, i+1); acts += s.actions; rounds += s.rounds;
  for(const l of s.steps.flatMap(x => x.lines)){ const m = l.match(/(asleep|was burned|was poisoned|paralysed!|confused!|flinched!|barrier \(|teleported|Rest|regained|pumped)/); if(m) cnt[m[1]] = (cnt[m[1]]||0)+1; } }
console.log('avg actions', (acts/n).toFixed(1), 'avg rounds', (rounds/n).toFixed(1), JSON.stringify(cnt));
