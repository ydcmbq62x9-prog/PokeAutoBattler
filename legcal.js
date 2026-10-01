const E = require('./engine.js');
if(process.env.LEG) Object.assign(E.TUNING.legend, JSON.parse(process.env.LEG));
if(process.env.GF) E.TUNING.gauntletRatio = E.TUNING.gauntletRatio.map(x => x * +process.env.GF);
const B = require('./botlib.js');
const N = +process.argv[2] || 600; let c = 0, rec = 0, offered = 0;
for(let r = 0; r < N; r++){ const out = B.playRun(r * 7 + 1, { reroll:true, bench:4 }); if(out.cleared) c++; }
console.log(process.env.LEG || 'default', process.env.GF || '', 'cleared', (c / N * 100).toFixed(1) + '%');
