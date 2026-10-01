/* Clear rate of the reference player with the gauntlet ratios scaled by F. */
const F = +process.argv[2], N = +process.argv[3] || 400, OFF = +process.argv[4] || 0;
const E = require('./engine.js');
E.TUNING.gauntletRatio = E.TUNING.gauntletRatio.map(x => x * F);
const B = require('./botlib.js');
let c = 0; for(let r = OFF; r < OFF + N; r++) if(B.playRun(r * 7 + 1, { reroll:true, bench:4 }).cleared) c++;
console.log(F, OFF, c, N);
