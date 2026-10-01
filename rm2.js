const E = require('./engine.js'); const B = require('./botlib.js');
const RUNS = 400;
const set = JSON.parse(process.env.SET || '{}');
for(const [k,v] of Object.entries(set)) Object.assign(E.TUNING.badgeRewards[k], v);
for(const p of process.env.P.split(',')){
  let c=0; for(let r=0;r<RUNS;r++){ if(B.playRun(r*7+1,{reroll:true,bench:4,reward:p}).cleared) c++; }
  console.log(JSON.stringify(set), p, (c/RUNS*100).toFixed(1)+'%');
}
