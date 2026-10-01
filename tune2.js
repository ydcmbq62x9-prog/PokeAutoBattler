/* Per-boss calibration, measured with EQUAL SAMPLES for every boss.
   ------------------------------------------------------------------
   The old tuner measured the theme correction and the global difficulty ramp
   from the same natural-play runs, and that is a feedback trap: make the Elite
   Four harder, fewer runs reach them, their win rate is then estimated from
   twenty samples, the noise pushes them harder again. It ran away to a 5% clear
   rate with every gym sitting on target.

   These are two different jobs and this file only does the first.

   `calib` is a RELATIVE correction for what a theme is worth in a fight —
   something the power score cannot see, because Erika's Grass almost never
   scores a ×2 while Lt. Surge's Lightning eats the Water half of the roster.
   To measure it, every boss is fought by the same reference player: a bot that
   arrived on schedule, forced through the earlier stages so the Champion gets
   as many samples as Brock. The global ramp (`gymRatio`, `bossRatio`) is then
   set separately against natural play, where the clear rate is what matters.  */
const E = require('./engine.js');
const BL = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 200);
const PASSES = Number(process.env.PASSES || 4);
const STEP = Number(process.env.STEP || 0.5);
const TARGET = { gym: 0.55, elite: 0.45, champion: 0.35 };

function bot(G){
  BL.pickRewards(G, BL.REWARD_ORDER);   // badge rewards, like the reference player
  const buyMart = () => {
    for(let i = 0; i < G.mart.length; i++){
      const s = G.mart[i]; if(!s || s.bought || !G.team.length) continue;
      const def = E.defOfSlot(s); if(!def || G.credits < def.cost) continue;
      if(s.held){ if(E.bagRoom(G) > 0) E.buyHeld(G, i); continue; }
      const ok = G.team.findIndex(u => E.canUseItem(s.id, u));
      if(ok >= 0) E.buyItem(G, i, ok);
    }
    while(G.bag.length){ const f = G.team.find(u => !u.held); if(!f) break; if(!E.equipHeld(G, 0, f).ok) break; }
  };
  for(let i = 0; i < G.daycare.length; i++){
    if(G.credits < E.TUNING.costBuy) break;
    const s = G.daycare[i]; if(!s || s.bought) continue;
    const d = G.team.findIndex(u => u.id === s.unit.id && E.unitLevel(u) < 3);
    const slot = d >= 0 ? d : G.team.length;
    if(d < 0 && G.team.length >= E.TUNING.maxTeam) continue;
    E.buyPokemon(G, i, slot);
  }
  buyMart();
  let g = 0;
  while(G.credits >= E.TUNING.costRoll + 3 && g++ < 40){
    if(!E.rollMart(G, true)) break;
    buyMart();
  }
  E.lineUpByRole(G);   // v28: line up by role
  E.endTurnEffects(G);
}

const PLAN = E.runPlan();
/** A player who arrived on schedule at `stage`, having won everything so far. */
function playerAt(stage, seed){
  const G = E.newGame(seed);
  E.rollShop(G, false);
  while((G.stage || 0) < stage){
    bot(G);
    E.applyBattleResult(G, 'win');     // forced: the reference is "got here on time"
    E.nextTurn(G);
  }
  bot(G);
  return G;
}

/** First-attempt win rate against one boss, same reference player every time. */
function rate(stage){
  let won = 0;
  for(let i = 0; i < RUNS; i++){
    const G = playerAt(stage, i * 7 + 1);
    const opp = E.opponentFor(G);
    if(E.stageBattle(G, opp).result === 'win') won++;
  }
  return won / RUNS;
}

const stages = [];
PLAN.forEach((p, i) => { if(p.boss) stages.push({ i, boss: p.boss, kind: p.kind }); });

for(let pass = 1; pass <= PASSES; pass++){
  const out = [];
  for(const s of stages){
    const r = rate(s.i);
    const target = TARGET[s.kind];
    // a boss that is too easy needs a BIGGER share of the player's power
    s.boss.calib = Math.max(0.35, Math.min(2.2, s.boss.calib * (1 + STEP * (r - target))));
    out.push(`${s.boss.name} ${(r*100).toFixed(0)}%→${s.boss.calib.toFixed(2)}`);
  }
  console.log(`pass ${pass} (n=${RUNS} each)\n   ` + out.join('  '));
}
console.log('\nsuggested calib values:');
for(const s of stages) console.log(`  ${s.boss.id.padEnd(9)} ${s.boss.calib.toFixed(2)}`);
