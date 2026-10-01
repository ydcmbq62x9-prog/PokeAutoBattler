/* Sweep the Mart's medicine shelf. Two bots on every shape: the one that never
   rerolls and the one that rerolls exhaustively. What we want is the GAP to
   close — a wide enough shelf means rerolling buys you little, because what you
   would have rerolled for is already on display — while the rerolling bot stays
   near the 30–35% clear rate the run is balanced around. */
const E = require('./engine.js');
const RUNS = Number(process.env.RUNS || 250);

function play(reroll){
  let cleared = 0, badges = 0, n = 0, med = 0, left = 0, burnt = 0, rolls = 0;
  for(let r = 0; r < RUNS; r++){
    const G = E.newGame(r * 7 + 1);
    E.rollShop(G, false);
    let guard = 0;
    while(!G.over && guard++ < 200){
      const buyMart = () => {
        for(let i = 0; i < G.mart.length; i++){
          const s = G.mart[i]; if(!s || s.bought || !G.team.length) continue;
          const def = E.defOfSlot(s); if(!def || G.credits < def.cost) continue;
          if(s.held){ if(E.bagRoom(G) > 0) E.buyHeld(G, i); continue; }
          const ok = G.team.findIndex(u => E.canUseItem(s.id, u));
          if(ok >= 0 && E.buyItem(G, i, ok).ok) med++;
        }
        while(G.bag.length){ const f = G.team.find(u => !u.held); if(!f) break; if(!E.equipHeld(G, 0, f).ok) break; }
      };
      for(let i = 0; i < G.daycare.length; i++){
        const s = G.daycare[i]; if(!s || s.bought) continue;
        if(G.credits < E.TUNING.costBuy) break;
        const d = G.team.findIndex(u => u.id === s.unit.id && E.unitLevel(u) < 3);
        const slot = d >= 0 ? d : G.team.length;
        if(d < 0 && G.team.length >= E.TUNING.maxTeam) continue;
        E.buyPokemon(G, i, slot);
      }
      buyMart();
      if(reroll){ let g2 = 0;
        while(G.credits >= E.TUNING.costRoll + 3 && g2++ < 40){
          if(!E.rollMart(G, true)) break; rolls++; buyMart(); } }
      E.endTurnEffects(G);
      left += G.credits; burnt += Math.max(0, G.credits - E.TUNING.maxCarryOver); n++;
      const opp = E.opponentFor(G);
      E.applyBattleResult(G, E.simulateBattle(G.team, opp.team, G.seed + G.turn).result, opp);
      if(G.over) break;
      E.nextTurn(G);
    }
    if(G.over === 'won') cleared++;
    badges += G.badges;
  }
  return { pct: cleared/RUNS*100, badges: badges/RUNS, med: med/n,
           left: left/n, burnt: burnt/n, rolls: rolls/n };
}

const SHAPES = {
  'today   2,3,3,3,3,3': [2,3,3,3,3,3],
  'gentle  2,3,3,4,4,5': [2,3,3,4,4,5],
  'wide    2,3,4,5,6,7': [2,3,4,5,6,7],
  'wider   3,4,5,6,7,8': [3,4,5,6,7,8],
  'widest  3,4,6,8,9,10': [3,4,6,8,9,10],
};
console.log('mart shelf            no reroll        rerolling        gap    med/t  left  burnt  rolls/t');
for(const [label, table] of Object.entries(SHAPES)){
  E.TUNING.martSlots = table;
  const a = play(false), b = play(true);
  console.log(label.padEnd(22) +
    `${a.pct.toFixed(0)}% (${a.badges.toFixed(1)}b)`.padEnd(17) +
    `${b.pct.toFixed(0)}% (${b.badges.toFixed(1)}b)`.padEnd(17) +
    `${(b.pct-a.pct).toFixed(0)}pt`.padStart(5) +
    b.med.toFixed(1).padStart(8) + a.left.toFixed(0).padStart(6) +
    a.burnt.toFixed(1).padStart(7) + b.rolls.toFixed(1).padStart(8));
}
