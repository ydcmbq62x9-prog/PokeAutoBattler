// How much one pokémon adds: a random mixed five + X, against a random mixed six. Same turn, no normalisation.
const E = require(process.env.ENG || './engine.js');
if(process.env.TUNE) Object.assign(E.TUNING, JSON.parse(process.env.TUNE));
if(process.env.ROLES){ const o = JSON.parse(process.env.ROLES); for(const r in o) Object.assign(E.TUNING.roles[r], o[r]); }
const N = Number(process.env.N || 300), TURN = 4;
const finals = E.BUYABLE.filter(k => E.SPECIES[k].tier <= 3);
function mk(id){ const u = E.makeUnit(id, 0); E.growUnit ? E.growUnit(u, {hp:TURN*2,atk:TURN*2,spd:TURN}) : (u.hp+=TURN*2,u.atk+=TURN*2,u.spd+=TURN); return u; }
function rnd(s){ let x = s>>>0||1; return () => { x^=x<<13; x>>>=0; x^=x>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }
const sort = t => E.formationSort ? E.formationSort(t) : t;
const res = [];
for(const X of finals){ let w = 0;
  for(let i = 0; i < N; i++){ const r = rnd(i*131+7); const pick = () => finals[Math.floor(r()*finals.length)];
    const A = sort([mk(X), mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick())]);
    const B = sort([mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick()), mk(pick())]);
    const o = E.simulateBattle(A, B, i+1).result; w += o === 'win' ? 1 : o === 'draw' ? 0.5 : 0; }
  res.push([X, E.roleOf ? E.roleOf(X) : '', E.SPECIES[X].tier, w/N]); }
res.sort((a,b)=>b[3]-a[3]);
for(const [x,r,t,v] of res) console.log(x.padEnd(11), (r||'').padEnd(8), 'T'+t, (v*100).toFixed(0)+'%');
const by = {}; for(const [x,r,t,v] of res){ (by[r]=by[r]||[]).push(v); }
for(const r in by) console.log('avg', r, (by[r].reduce((a,b)=>a+b,0)/by[r].length*100).toFixed(0)+'%');
