/* Refit powerCurve to the model that is actually in the engine, and report the
   aiDifficulty that keeps trainer battles at the same relative pressure. */
const E = require('./engine.js');
const BL = require('./botlib.js');
function shop(G){
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
  while(G.credits >= E.TUNING.costRoll + 3 && g++ < 40){ if(!E.rollMart(G, true)) break; buyMart(); }
  E.endTurnEffects(G);
}
function fit(){
  const xs = [], ys = [];
  for(let r = 0; r < 100; r++){
    const G = E.newGame(r * 13 + 3);
    E.rollShop(G, false);
    let guard = 0;
    while(!G.over && guard++ < 60){
      shop(G);
      xs.push(G.turn); ys.push(E.teamPower(G.team));
      E.applyBattleResult(G, 'win');
      if(G.over) break;
      E.nextTurn(G);
    }
  }
  const n = xs.length, mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let num = 0, den = 0;
  for(let i = 0; i < n; i++){ num += (xs[i]-mx)*(ys[i]-my); den += (xs[i]-mx)**2; }
  return { base: Math.round(my - (num/den)*mx), perTurn: Math.round(num/den) };
}
const c = fit();
console.log('fitted powerCurve:', JSON.stringify(c));
console.log('reference growth under the old model was 126/turn');
console.log('suggested aiDifficulty:', (0.95 * c.perTurn / 126).toFixed(2));
