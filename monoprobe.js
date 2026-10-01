const E = require('./engine.js'); const S = +process.env.SCALE || 1; E.TUNING.gauntletRatio = E.TUNING.gauntletRatio.map(x => x / 1.01 * S);
const B = require('./botlib.js'); const N = +process.argv[2] || 300;
const types = process.argv[3] ? process.argv[3].split(',') : Object.keys(E.TYPES); const per = {};
for(const t of types){ let ct = 0; for(let r = 0; r < N; r++){ if(B.playRun(r * 7 + 1, { reroll:true, bench:4, mods:{ mono:t } }).cleared) ct++; } per[t] = Math.round(ct / N * 100); }
console.log('scale', S, JSON.stringify(per));
