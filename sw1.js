const E = require('./engine.js'); const M = E.M, on = E.on;
const cfgs = [];
const N = +process.env.N || 1500, TURN = 22;
const finals = Object.keys(E.SPECIES).filter(k => !E.evoNext(k).length && !E.SPECIES[k].legendary);
function mk(i){ const u = E.makeUnit(i, 0); if(!E.isLegend(u)){ u.exp = E.TUNING.expForLevel3; E.applyLevelUp(null, u); E.applyLevelUp(null, u); } E.growUnit(u, {hp:TURN*2,atk:TURN*2,spd:TURN}); return u; }
function rnd(s){ let x = s>>>0||1; return () => { x^=x<<13; x>>>=0; x^=x>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }
const val = id => { let w = 0; for(let i = 0; i < N; i++){ const r = rnd(i*131+7); const pick = () => finals[Math.floor(r()*finals.length)];
  const A = E.formationSort([mk(id), mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick())]);
  const B = E.formationSort([mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick())]);
  const o = E.simulateBattle(A, B, i+1).result; w += o === 'win' ? 1 : o === 'draw' ? 0.5 : 0; } return (w/N*100).toFixed(1); };
module.exports = { E, M, on, val };
if(require.main === module){
  const sp = E.SPECIES.blastoise, m0 = sp.move, b0 = sp.move2;
  for(const [hp, ba, bs, bp] of [[2.1,1.1,1.1,10],[2.3,1.15,1.1,10],[2.5,1.2,1.2,12],[2.5,1.2,1.3,14]]){
    sp.move = M.charge('Hydro Pump', hp, 'Water Gun', ba); sp.move2 = on('every', M.slow('Bubble', bs, bp), { n:3 });
    console.log('blastoise hydro', hp, ba, 'bubble', bs, bp, val('blastoise')); }
  sp.move = m0; sp.move2 = b0;
  const v = E.SPECIES.venusaur, v0 = v.move, v20 = v.move2;
  for(const [gd, gh, pp] of [[1.35,0.6,0.5],[1.5,0.6,0.5],[1.5,0.6,0.7],[1.6,0.65,0.7]]){
    v.move = M.drain('Giga Drain', gd, gh); v.move2 = on('every', M.afflict('Poison Powder', pp, 'psn', 1, 'front'), { n:3 });
    console.log('venusaur giga', gd, gh, 'poison', pp, val('venusaur')); }
}
