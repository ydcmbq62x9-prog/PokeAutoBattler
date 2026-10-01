const E = require(process.env.ENG || './engine.js');
const finals = [...new Set(E.BUYABLE.map(k => { const l = E.evoLine(k); return l[l.length-1]; }))];
function rnd(s){ let x = s>>>0||1; return () => { x^=x<<13; x>>>=0; x^=x>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }
const mk = id => { const u = E.makeUnit(id, E.TUNING.expForLevel2); E.growUnit(u, {hp:48,atk:48,spd:24}); return u; };
const c = { win:0, lose:0, draw:0 };
for(let i = 0; i < 400; i++){ const r = rnd(i*131+7); const p = () => finals[Math.floor(r()*finals.length)];
  const A = E.formationSort([p(),p(),p(),p(),p(),p()].map(mk)), B = E.formationSort([p(),p(),p(),p(),p(),p()].map(mk));
  c[E.simulateBattle(A, B, i+1).result]++; }
console.log(JSON.stringify(c));
