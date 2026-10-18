/* 6.22.0 — finds gauntletFoes for one gen mix: the value where the reference bot clears a Gauntlet run (beats the Champion)
   as often as it clears a normal run of the same gens. A report (no assertions).   node gauntlettune.js [runs] [gens json] */
const E = require('./engine.js'), B = require('./botlib.js');
const N = +process.argv[2] || 300, gens = JSON.parse(process.argv[3] || '[1]'), key = gens.join('+');
const rate = mods => { let c = 0; for(let r = 0; r < N; r++) if(B.playRun(r * 7 + 1, { gens, mods, reroll:true, bench:4 }).cleared) c++; return c / N * 100; };
const target = rate({});
const by = E.TUNING.mods.byGens = E.TUNING.mods.byGens || {}; by[key] = by[key] || {};
let lo = 0.6, hi = 1.0, best = null;
for(let i = 0; i < 7; i++){
  const f = (lo + hi) / 2; by[key].gauntletFoes = f; const g = rate({ gauntlet:true });
  if(!best || Math.abs(g - target) < Math.abs(best.g - target)) best = { f, g };
  if(g > target) lo = f; else hi = f;
}
console.log(JSON.stringify({ gens:key, normal:+target.toFixed(1), gauntletFoes:+best.f.toFixed(3), gauntlet:+best.g.toFixed(1) }));
