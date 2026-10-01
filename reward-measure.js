/* What is each badge reward worth? The reference player takes reward X whenever
   it is offered (falling back to REWARD_ORDER), against 'none' and 'random'.
   Seeded shops make this a paired comparison: same seeds, same luck. */
const E = require('./engine.js');
const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 400);
function measure(reward){
  let cleared = 0, reached = 0, badges = 0, turns = 0;
  for(let r = 0; r < RUNS; r++){
    const out = B.playRun(r * 7 + 1, { reroll:true, bench:4, reward });
    if(out.cleared) cleared++; if(out.g.reached) reached++;
    badges += out.badges; turns += out.turns;
  }
  return `cleared ${(cleared/RUNS*100).toFixed(1).padStart(5)}%  reach E4 ${(reached/RUNS*100).toFixed(0).padStart(3)}%  badges ${(badges/RUNS).toFixed(2)}`;
}
const policies = (process.env.P || 'none,random,' + E.BADGE_REWARDS.map(r => r.id).join(',')).split(',');
for(const p of policies){
  const pol = p === 'none' || p === 'random' || p.startsWith('only:') ? p : p === 'order' ? B.REWARD_ORDER : [p];
  console.log(p.padEnd(10), measure(pol));
}
