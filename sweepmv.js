// usage: node sweepmv.js id  '<js expr replacing move>' ...   evaluates value with sv3-like harness using replaced move
const E = require('./engine.js'); const id = process.argv[2]; const N = +process.env.N || 1500, TURN = 22;
const finals = Object.keys(E.SPECIES).filter(k => !E.evoNext(k).length && !E.SPECIES[k].legendary);
function mk(i){ const u = E.makeUnit(i, 0); if(!E.isLegend(u)){ u.exp = E.TUNING.expForLevel3; E.applyLevelUp(null, u); E.applyLevelUp(null, u); } E.growUnit(u, {hp:TURN*2,atk:TURN*2,spd:TURN}); return u; }
function rnd(s){ let x = s>>>0||1; return () => { x^=x<<13; x>>>=0; x^=x>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }
const val = () => { let w = 0; for(let i = 0; i < N; i++){ const r = rnd(i*131+7); const pick = () => finals[Math.floor(r()*finals.length)];
  const A = E.formationSort([mk(id), mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick())]);
  const B = E.formationSort([mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick())]);
  const o = E.simulateBattle(A, B, i+1).result; w += o === 'win' ? 1 : o === 'draw' ? 0.5 : 0; } return (w/N*100).toFixed(1); };
const sp = E.SPECIES[id], m0 = sp.move, m20 = sp.move2;
for(const cfg of process.argv.slice(3)){ const c = JSON.parse(cfg); Object.assign(sp, c.stats || {}); if(c.move) sp.move = c.move; if(c.move2) sp.move2 = c.move2; console.log(cfg.slice(0, 90).padEnd(92), val()); sp.move = m0; sp.move2 = m20; }
