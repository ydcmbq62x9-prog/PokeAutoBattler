const E = require('./engine.js'); const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 400);
if(process.env.CAP) E.TUNING.vitaminCap = Number(process.env.CAP);
for(const med of ['first', 'stack']){
  let c = 0, r4 = 0, top = 0;
  for(let r = 0; r < RUNS; r++){ const o = B.playRun(r * 7 + 1, { reroll:true, bench:4, med });
    if(o.cleared) c++; if(o.g.reached) r4++;
    top += Math.max(...o.G.team.map(u => E.effAtk(u))); }
  console.log(`cap ${process.env.CAP || 'none'}  ${med.padEnd(6)} cleared ${(c/RUNS*100).toFixed(1)}%  reach E4 ${(r4/RUNS*100).toFixed(0)}%  top Attack ${Math.round(top/RUNS)}`);
}
