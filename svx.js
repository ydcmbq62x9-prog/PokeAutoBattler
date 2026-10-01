// usage: node svx.js variants.js   (variants.js exports {id: [ {label, set:(S,M,on)=>{...}} ]})
const E = require('./engine.js');
const V = require(require('path').resolve(process.argv[2]));
const N = +process.env.N || 800, TURN = 22, {M, on, SPECIES:S} = E;
const finals = Object.keys(S).filter(k => !E.evoNext(k).length && !S[k].legendary);
function mk(id){ const u = E.makeUnit(id, 0);
  if(!E.isLegend(u)){ u.exp = E.TUNING.expForLevel3; E.applyLevelUp(null, u); E.applyLevelUp(null, u); }
  E.growUnit(u, {hp:TURN*2,atk:TURN*2,spd:TURN}); return u; }
function rnd(s){ let x = s>>>0||1; return () => { x^=x<<13; x>>>=0; x^=x>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }
function val(X){ let w = 0;
  for(let i = 0; i < N; i++){ const r = rnd(i*131+7); const pick = () => finals[Math.floor(r()*finals.length)];
    const A = E.formationSort([mk(X), mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick())]);
    const B = E.formationSort([mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick())]);
    const o = E.simulateBattle(A, B, i+1).result; w += o === 'win' ? 1 : o === 'draw' ? 0.5 : 0; }
  return w/N*100; }
for(const id of Object.keys(V)){
  const orig = { ...S[id] }; const line = [];
  for(const v of V[id]){
    Object.keys(S[id]).forEach(k => delete S[id][k]); Object.assign(S[id], orig);
    if(v.set) v.set(S[id], M, on);
    if(v.move2 !== undefined) S[id].move2 = v.move2;
    line.push(v.label + ' ' + val(id).toFixed(1));
  }
  Object.keys(S[id]).forEach(k => delete S[id][k]); Object.assign(S[id], orig);
  console.log(id.padEnd(10), line.join(' | '));
}
