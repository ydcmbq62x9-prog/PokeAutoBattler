// whole-run value of a bench: reference player with bench 0/4/8
const B = require('./botlib.js'); const RUNS = Number(process.env.RUNS || 600);
for(const bench of [0, 4, 8]){ let c = 0; for(let r = 0; r < RUNS; r++) if(B.playRun(r*7+1, { reroll:true, bench }).cleared) c++;
  console.log('bench', bench, (c/RUNS*100).toFixed(0) + '%'); }
