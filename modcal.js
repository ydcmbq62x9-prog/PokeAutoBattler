const E = require('./engine.js');
if(process.env.RF) E.TUNING.mods.richFoes = +process.env.RF;
const B = require('./botlib.js');
const mods = JSON.parse(process.argv[2] || '{}'), N = +process.argv[3] || 500;
let c = 0, badges = 0; for(let r = 0; r < N; r++){ const out = B.playRun(r * 7 + 1, { reroll:true, bench:4, mods }); if(out.cleared) c++; }
console.log(JSON.stringify(mods), process.env.RF || '', 'cleared', (c / N * 100).toFixed(1) + '%');
