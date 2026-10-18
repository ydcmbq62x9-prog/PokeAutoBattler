/* 6.22.0 — how often the reference bot clears a Gauntlet run (bosses only), next to a normal run and Rich & Ruthless.
   A report (no assertions). "champion" = beat the Champion (the run counts as cleared); "all" = also beat every
   secret boss (the Gauntlet Badge).
     node gauntletreport.js [runs] [gens json] [modes: normal,rich,gauntlet]      GFOES=1.05 tries a gauntletFoes value; SEED=100000 plays different runs */
const E = require('./engine.js'), B = require('./botlib.js');
const N = +process.argv[2] || 200, gens = JSON.parse(process.argv[3] || '[1]'), modes = (process.argv[4] || 'normal,rich,gauntlet').split(',');
if(process.env.GFOES){ E.TUNING.mods.gauntletFoes = +process.env.GFOES; delete ((E.TUNING.mods.byGens || {})[gens.join('+')] || {}).gauntletFoes; }
for(const m of modes){
  let champ = 0, all = 0, fights = 0; const t0 = Date.now();
  for(let r = 0; r < N; r++){
    const out = B.playRun(r * 7 + 1 + (+process.env.SEED || 0), { gens, mods: m === 'normal' ? {} : { [m]: true }, reroll:true, bench:4 });
    if(out.cleared) champ++;
    if(out.G.secrets && (out.G.secWon || []).length >= out.G.secrets.length) all++;
    fights += out.G.stage || 0;
  }
  console.log(`gens ${gens.join('+').padEnd(6)} ${m.padEnd(9)} champion ${(champ / N * 100).toFixed(1).padStart(5)}%${m === 'gauntlet' ? `   all secret bosses too ${(all / N * 100).toFixed(1).padStart(5)}%` : ''}   (${N} runs, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
