/* Step two: the GLOBAL difficulty ramp, measured against natural play.
   calib is now a per-boss theme correction measured with equal samples; this
   sweeps the one number that scales all of them together, and the target is
   the clear rate, not any individual boss's win rate. */
const E = require('./engine.js');
const RUNS = Number(process.env.RUNS || 250);
const BASE_GYM = E.TUNING.gymRatio.slice();      // whatever the engine currently says
const BASE_BOSS = { ...E.TUNING.bossRatio };

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
  let g = 0;
  while(G.credits >= E.TUNING.costRoll + 3 && g++ < 40){ if(!E.rollMart(G, true)) break; buyMart(); }
  E.endTurnEffects(G);
}

function play(reroll){
  let cleared = 0, badges = 0, turns = 0, seen = {}, won = {};
  for(let r = 0; r < RUNS; r++){
    const G = E.newGame(r * 7 + 1);
    E.rollShop(G, false);
    let guard = 0;
    while(!G.over && guard++ < 200){
      if(reroll) bot(G);
      else {
        for(let i = 0; i < G.daycare.length; i++){
          if(G.credits < E.TUNING.costBuy) break;
          const s = G.daycare[i]; if(!s || s.bought) continue;
          const d = G.team.findIndex(u => u.id === s.unit.id && E.unitLevel(u) < 3);
          const slot = d >= 0 ? d : G.team.length;
          if(d < 0 && G.team.length >= E.TUNING.maxTeam) continue;
          E.buyPokemon(G, i, slot);
        }
        for(let i = 0; i < G.mart.length; i++){
          const s = G.mart[i]; if(!s || s.bought || !G.team.length) continue;
          const def = E.defOfSlot(s); if(!def || G.credits < def.cost) continue;
          if(s.held){ if(E.bagRoom(G) > 0) E.buyHeld(G, i); continue; }
          const ok = G.team.findIndex(u => E.canUseItem(s.id, u));
          if(ok >= 0) E.buyItem(G, i, ok);
        }
        while(G.bag.length){ const f = G.team.find(u => !u.held); if(!f) break; if(!E.equipHeld(G, 0, f).ok) break; }
        E.endTurnEffects(G);
      }
      const st = E.stageOf(G), opp = E.opponentFor(G);
      const sim = E.stageBattle(G, opp), res = sim.result;
      if(st.boss && G.attempt === 0){
        seen[st.kind] = (seen[st.kind]||0)+1;
        if(res === 'win') won[st.kind] = (won[st.kind]||0)+1;
      }
      E.applyBattleResult(G, res, opp, sim);
      if(G.over) break;
      E.nextTurn(G);
    }
    if(G.over === 'won') cleared++;
    badges += G.badges; turns += G.turn;
  }
  const r = k => seen[k] ? (won[k]||0)/seen[k]*100 : 0;
  return { pct: cleared/RUNS*100, badges: badges/RUNS, turns: turns/RUNS,
           gym: r('gym'), elite: r('elite'), champ: r('champion') };
}

console.log('ramp   rerolling player           no-reroll player        gym%  elite%  champ%  turns');
for(const k of [1.00]){
  E.TUNING.gymRatio = BASE_GYM.map(x => x * k);
  E.TUNING.bossRatio = { elite: BASE_BOSS.elite * k, champion: BASE_BOSS.champion * k };
  const a = play(true), b = play(false);
  console.log(`×${k.toFixed(2)}`.padEnd(7) +
    `${a.pct.toFixed(0)}% cleared, ${a.badges.toFixed(1)}b`.padEnd(25) +
    `${b.pct.toFixed(0)}% cleared, ${b.badges.toFixed(1)}b`.padEnd(24) +
    a.gym.toFixed(0).padStart(4) + a.elite.toFixed(0).padStart(7) +
    a.champ.toFixed(0).padStart(8) + a.turns.toFixed(0).padStart(7));
}
