/* Derive each leader's `calib` from measured first-attempt win rates.
   A theme's fighting value is not something the power score can see, so we
   measure it and correct, rather than guessing multipliers by hand. */
const E = require('./engine.js');

/* These targets are the CURRENT MEASURED AVERAGES, not an aspiration — this
   pass flattens the spread between leaders without moving the overall
   difficulty, which is ramp.js's job. Setting them to some nicer-looking number
   here would silently re-tune the whole run and invalidate the ramp. Re-measure
   them with ramp.js whenever the ramp moves. */
const TARGET = {
  gym:      Number(process.env.T_GYM || 0.72),
  elite:    Number(process.env.T_ELITE || 0.76),
  champion: Number(process.env.T_CHAMP || 0.57),
};
const STEP = 0.55;                 // how hard to chase the target each pass
const RUNS = Number(process.env.RUNS || 220);
const PASSES = Number(process.env.PASSES || 4);

const calib = {};
for(const b of [...E.GYMS, ...E.ELITE_FOUR, E.CHAMPION]) calib[b.id] = b.calib || 1;

/* The reference player. This bot REROLLS the Mart, and that is not a detail:
   measured over 250 runs, rerolling was worth 34% → 78% of runs cleared, because
   a 1₽ reroll bypassed the three-slot medicine shelf that was supposed to be the
   limit on how fast you grow. Every calib below was once fitted against a bot
   that did not know the move, so the game as actually played was far easier than
   these numbers claimed. Tune against the strongest available play. */
function bot(G){
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
  let guard = 0;
  while(G.credits >= E.TUNING.costRoll + 3 && guard++ < 40){
    if(!E.rollMart(G, true)) break;
    buyMart();
  }
  E.endTurnEffects(G);
}

function measure(){
  const seen = {}, won = {}, first = {};
  let cleared = 0, badges = 0;
  for(let run = 0; run < RUNS; run++){
    const G = E.newGame(run * 7 + 1);
    E.rollShop(G, false);
    let guard = 0;
    while(!G.over && guard++ < 160){
      bot(G);
      const st = E.stageOf(G), opp = E.opponentFor(G);
      const r = E.stageBattle(G, opp);
      if(st.boss && G.attempt === 0){        // first attempts only — retries are easier by design
        seen[st.boss.id] = (seen[st.boss.id] || 0) + 1;
        if(r.result === 'win') won[st.boss.id] = (won[st.boss.id] || 0) + 1;
        first[st.boss.id] = st.kind;
      }
      E.applyBattleResult(G, r.result, opp, r);
      if(G.over) break;
      E.nextTurn(G);
    }
    if(G.over === 'won') cleared++;
    badges += G.badges;
  }
  return { seen, won, first, cleared, badges };
}

for(let pass = 1; pass <= PASSES; pass++){
  // push the current calibration into the engine's boss definitions
  for(const b of [...E.GYMS, ...E.ELITE_FOUR, E.CHAMPION]) b.calib = calib[b.id];
  const { seen, won, first, cleared, badges } = measure();
  const line = [];
  for(const b of [...E.GYMS, ...E.ELITE_FOUR, E.CHAMPION]){
    const n = seen[b.id] || 0;
    if(n < 25){ line.push(`${b.name}:n${n}`); continue; }   // too few to trust
    const rate = (won[b.id] || 0) / n;
    const target = TARGET[first[b.id]] || 0.5;
    calib[b.id] = Math.max(0.35, Math.min(2.2, calib[b.id] * (1 + STEP * (rate - target))));
    line.push(`${b.name} ${(rate*100).toFixed(0)}%→${calib[b.id].toFixed(2)}`);
  }
  console.log(`pass ${pass}: cleared ${cleared}/${RUNS}, avg ${(badges/RUNS).toFixed(1)} badges`);
  console.log('   ' + line.join('  '));
}
console.log('\nsuggested calib values:');
for(const b of [...E.GYMS, ...E.ELITE_FOUR, E.CHAMPION])
  console.log(`  ${b.id.padEnd(9)} ${calib[b.id].toFixed(2)}`);
