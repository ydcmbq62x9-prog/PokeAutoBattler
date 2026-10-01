// species value vs realistic late-run parties: regular pokémon at L3 (level-ups + L3 move power); legendaries stay L1 but grow ×legend.growth
const E = require('./engine.js');
const ids = process.argv[2].split(','); const P = JSON.parse(process.argv[3] || '{}');
for(const k in P) Object.assign(E.SPECIES[k], P[k]);
if(process.env.LG) E.TUNING.legend.growth = +process.env.LG;
const N = +process.env.N || 800, TURN = 22;
const finals = Object.keys(E.SPECIES).filter(k => !E.evoNext(k).length && !E.SPECIES[k].legendary);
function mk(id){ const u = E.makeUnit(id, 0);
  if(!E.isLegend(u)){ u.exp = E.TUNING.expForLevel3; E.applyLevelUp(null, u); E.applyLevelUp(null, u); }
  E.growUnit(u, {hp:TURN*2,atk:TURN*2,spd:TURN}); return u; }
function rnd(s){ let x = s>>>0||1; return () => { x^=x<<13; x>>>=0; x^=x>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }
for(const X of ids){ let w = 0;
for(let i = 0; i < N; i++){ const r = rnd(i*131+7); const pick = () => finals[Math.floor(r()*finals.length)];
  const A = E.formationSort([mk(X), mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick())]);
  const B = E.formationSort([mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick())]);
  const o = E.simulateBattle(A, B, i+1).result; w += o === 'win' ? 1 : o === 'draw' ? 0.5 : 0; }
console.log(X.padEnd(10), (w/N*100).toFixed(1) + '%'); }
