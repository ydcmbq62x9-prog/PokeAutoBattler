const E = require('./engine.js'); if(process.argv[2] !== 'map') E.TUNING.mods.monoFoes = Object.fromEntries(Object.keys(E.TYPES).map(t => [t, +process.argv[2]]));
const B = require('./botlib.js'); const N = +process.argv[3] || 200;
const types = Object.keys(E.TYPES); let c = 0, n = 0; const per = {};
for(const t of types){ let ct = 0; for(let r = 0; r < N; r++){ const out = B.playRun(r * 7 + 1, { reroll:true, bench:4, mods:{ mono:t } }); if(out.cleared){ c++; ct++; } n++; } per[t] = Math.round(ct / N * 100); }
console.log(process.argv[2], 'all types', (c / n * 100).toFixed(1) + '%', JSON.stringify(per));
