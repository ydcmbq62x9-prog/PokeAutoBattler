/* One bot, one accounting. Every credit is categorised, and the categories must
   sum to what came in — if they don't, the harness is lying and no conclusion
   drawn from it is worth anything. */
const E = require('./engine.js');
const RUNS = Number(process.env.RUNS || 200);
const REROLL = process.env.REROLL !== '0';
const T = 45;
const z = () => new Array(T).fill(0);
const a = { n:z(), income:z(), mons:z(), med:z(), held:z(), rolls:z(), rollSpend:z(),
            left:z(), burnt:z(), nMed:z(), nMons:z() };

for(let run = 0; run < RUNS; run++){
  const G = E.newGame(run * 7 + 1);
  E.rollShop(G, false);
  let guard = 0;
  while(!G.over && guard++ < 200){
    const t = Math.min(T-1, G.turn);
    const opened = G.credits;
    let cMons = 0, cMed = 0, cHeld = 0, cRoll = 0, rolls = 0, nMed = 0, nMons = 0;

    const buyMons = () => {
      for(let i = 0; i < G.daycare.length; i++){
        const s = G.daycare[i]; if(!s || s.bought) continue;
        if(G.credits < E.TUNING.costBuy) break;
        const d = G.team.findIndex(u => u.id === s.unit.id && E.unitLevel(u) < 3);
        const slot = d >= 0 ? d : G.team.length;
        if(d < 0 && G.team.length >= E.TUNING.maxTeam) continue;
        const b = G.credits; if(E.buyPokemon(G, i, slot).ok){ cMons += b - G.credits; nMons++; }
      }
    };
    const buyMart = () => {
      for(let i = 0; i < G.mart.length; i++){
        const s = G.mart[i]; if(!s || s.bought || !G.team.length) continue;
        const def = E.defOfSlot(s); if(!def || G.credits < def.cost) continue;
        const b = G.credits;
        if(s.held){ if(E.bagRoom(G) > 0 && E.buyHeld(G, i).ok) cHeld += b - G.credits; continue; }
        const ok = G.team.findIndex(u => E.canUseItem(s.id, u));
        if(ok >= 0 && E.buyItem(G, i, ok).ok){ cMed += b - G.credits; nMed++; }
      }
      while(G.bag.length){ const f = G.team.find(u => !u.held); if(!f) break; if(!E.equipHeld(G, 0, f).ok) break; }
    };

    buyMons(); buyMart();
    if(REROLL){
      let g2 = 0;
      while(G.credits >= E.TUNING.costRoll + 3 && g2++ < 40){
        const b = G.credits;
        if(!E.rollMart(G, true)) break;
        cRoll += b - G.credits; rolls++;
        buyMart();
      }
    }
    E.endTurnEffects(G);

    a.income[t] += opened; a.mons[t] += cMons; a.med[t] += cMed; a.held[t] += cHeld;
    a.rollSpend[t] += cRoll; a.rolls[t] += rolls; a.left[t] += G.credits;
    a.burnt[t] += Math.max(0, G.credits - E.TUNING.maxCarryOver);
    a.nMed[t] += nMed; a.nMons[t] += nMons; a.n[t]++;

    const opp = E.opponentFor(G);
    E.applyBattleResult(G, E.simulateBattle(G.team, opp.team, G.seed + G.turn).result, opp);
    if(G.over) break;
    E.nextTurn(G);
  }
}
const v = (x,t) => a.n[t] ? x[t]/a.n[t] : 0;
console.log(`rerolling: ${REROLL}\nturn  runs  opened   mons    med   held  rolls(₽)   left  burnt |  #med  #mons  balance`);
for(let t = 1; t < T; t++){
  if(!a.n[t] || (t % 4 && t !== 1)) continue;
  const bal = v(a.income,t) - (v(a.mons,t)+v(a.med,t)+v(a.held,t)+v(a.rollSpend,t)+v(a.left,t));
  console.log(String(t).padStart(4) + String(a.n[t]).padStart(6) +
    v(a.income,t).toFixed(1).padStart(8) + v(a.mons,t).toFixed(1).padStart(7) +
    v(a.med,t).toFixed(1).padStart(7) + v(a.held,t).toFixed(1).padStart(7) +
    v(a.rollSpend,t).toFixed(1).padStart(10) + v(a.left,t).toFixed(1).padStart(7) +
    v(a.burnt,t).toFixed(1).padStart(7) + ' |' +
    v(a.nMed,t).toFixed(1).padStart(6) + v(a.nMons,t).toFixed(1).padStart(7) +
    bal.toFixed(2).padStart(9));
}
