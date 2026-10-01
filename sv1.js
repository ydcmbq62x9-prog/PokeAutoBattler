const E = require('./engine.js');
const X = process.argv[2]; const P = JSON.parse(process.argv[3] || '{}');
const s = E.SPECIES[X]; if(P.move) s.move = eval('E.M.' + P.move); Object.assign(s, P.stats || {}); if(P.move2 !== undefined) s.move2 = P.move2 ? eval('E.' + P.move2) : null;
const N = 800, TURN = 24;
const finals = Object.keys(E.SPECIES).filter(k => !E.evoNext(k).length);
function mk(id){ const u = E.makeUnit(id, E.TUNING.expForLevel2); E.growUnit(u, {hp:TURN*2,atk:TURN*2,spd:TURN}); return u; }
function rnd(s){ let x = s>>>0||1; return () => { x^=x<<13; x>>>=0; x^=x>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }
let w = 0;
for(let i = 0; i < N; i++){ const r = rnd(i*131+7); const pick = () => finals[Math.floor(r()*finals.length)];
  const A = E.formationSort([mk(X), mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick())]);
  const B = E.formationSort([mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick())]);
  const o = E.simulateBattle(A, B, i+1).result; w += o === 'win' ? 1 : o === 'draw' ? 0.5 : 0; }
console.log(X, process.argv[3] || '', (w/N*100).toFixed(1) + '%');
