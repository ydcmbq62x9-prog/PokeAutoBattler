const E = require('./engine.js');
if(process.env.MT) { const o = JSON.parse(process.env.MT); for(const k in o) E.TUNING.mods[k] = typeof o[k] === 'object' ? Object.assign(E.TUNING.mods[k], o[k]) : o[k]; }
const B = require('./botlib.js');
const mods = JSON.parse(process.argv[2] || '{}'), N = +process.argv[3] || 500;
let c = 0; for(let r = 0; r < N; r++){ const out = B.playRun(r * 7 + 1, { reroll:true, bench:4, mods }); if(out.cleared) c++; }
console.log(process.env.MT || '', JSON.stringify(mods), 'cleared', (c / N * 100).toFixed(1) + '%');
