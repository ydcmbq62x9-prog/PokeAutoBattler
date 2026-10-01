// node modsw.js richFoes 1.1,1.15,1.2 '{"rich":true}' [N]   |   node modsw.js mono:Grass 0.6,0.7 ...
const E = require('./engine.js'); const B = require('./botlib.js');
const [key, list, modsJson, nArg] = process.argv.slice(2); const N = +nArg || 400;
for(const v of list.split(',').map(Number)){
  let mods;
  if(key.startsWith('mono:')){ const t = key.split(':')[1]; E.TUNING.mods.monoFoes[t] = v; mods = { mono: t }; }
  else { E.TUNING.mods[key] = v; mods = JSON.parse(modsJson); }
  let c = 0; for(let r = 0; r < N; r++) if(B.playRun(r * 7 + 1, { reroll:true, bench:4, mods }).cleared) c++;
  console.log(key, v, (c / N * 100).toFixed(1) + '%');
}
