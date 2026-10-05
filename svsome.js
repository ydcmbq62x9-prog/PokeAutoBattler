const E = require(process.env.ENG || './engine.js'); E.setActiveGens([1,2]);
const N = +process.env.N || 400, TURN = 24, list = process.argv.slice(2);
const finals = Object.keys(E.SPECIES).filter(k => !E.evoNext(k).length && !E.SPECIES[k].legendary);
function mk(id){ const u = E.makeUnit(id, E.TUNING.expForLevel2); E.growUnit(u, {hp:TURN*2,atk:TURN*2,spd:TURN}); return u; }
function rnd(s){ let x = s>>>0||1; return () => { x^=x<<13; x>>>=0; x^=x>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }
const out = [];
for(const X of list){ let w = 0;
  for(let i = 0; i < N; i++){ const r = rnd(i*131+7); const pick = () => finals[Math.floor(r()*finals.length)];
    const A = E.formationSort([mk(X), mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick())]);
    const B = E.formationSort([mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick())]);
    const o = E.simulateBattle(A, B, i+1).result; w += o === 'win' ? 1 : o === 'draw' ? 0.5 : 0; }
  out.push(X + ' ' + Math.round(w / N * 100)); }
console.log(out.join(' | '));
