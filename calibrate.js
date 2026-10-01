/* What is a player's team actually worth, turn by turn? Everything about boss
   difficulty should be expressed against this curve rather than guessed. */
const E = require('./engine.js');

const byTurn = {}, sizeByTurn = {}, atkByTurn = {};
const bossPow = {}, bossSize = {}, bossAtk = {}, bossWin = {};
const playerAtkAt = {}, playerSizeAt = {}, bossSpd = {}, bossHp = {};
const playerSpdAt = {}, playerHpAt = {};
function record(map, k, v){ (map[k] = map[k] || []).push(v); }

for(let run = 0; run < 250; run++){
  const G = E.newGame(run + 1);
  E.rollShop(G, false);
  let guard = 0;
  while(!G.over && guard++ < 160){
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
      if(s.held){ E.buyHeld(G, i); continue; }
      const ok = G.team.findIndex(u => E.canUseItem(s.id, u));
      if(ok >= 0) E.buyItem(G, i, ok);
    }
    while(G.bag.length){ const f = G.team.find(u => !u.held); if(!f) break; if(!E.equipHeld(G, 0, f).ok) break; }
    E.endTurnEffects(G);
    record(byTurn, G.turn, E.teamPower(G.team));
    record(sizeByTurn, G.turn, G.team.length);
    record(atkByTurn, G.turn, G.team.reduce((n,u)=>n+E.effAtk(u),0));
    const st = E.stageOf(G), opp = E.opponentFor(G);
    if(st.boss){
      record(bossPow, st.boss.id, E.teamPower(opp.team));
      record(bossSize, st.boss.id, opp.team.length);
      record(bossAtk, st.boss.id, opp.team.reduce((n,u)=>n+E.effAtk(u),0));
      record(bossSpd, st.boss.id, opp.team.reduce((n,u)=>n+E.effSpd(u),0)/opp.team.length);
      record(bossHp,  st.boss.id, opp.team.reduce((n,u)=>n+E.effHp(u),0));
      record(bossWin, st.boss.id, 0);
    }
    const r = E.simulateBattle(G.team, opp.team, G.seed + G.turn);
    if(st.boss){ bossWin[st.boss.id][bossWin[st.boss.id].length-1] = r.result === 'win' ? 1 : 0;
      record(playerAtkAt, st.boss.id, G.team.reduce((n,u)=>n+E.effAtk(u),0));
      record(playerSizeAt, st.boss.id, G.team.length);
      record(playerSpdAt, st.boss.id, G.team.reduce((n,u)=>n+E.effSpd(u),0)/G.team.length);
      record(playerHpAt,  st.boss.id, G.team.reduce((n,u)=>n+E.effHp(u),0)); }
    E.applyBattleResult(G, r.result, opp);
    if(G.over) break;
    E.nextTurn(G);
  }
}
const mean = a => a.reduce((x,y)=>x+y,0) / a.length;
console.log('player power by turn (the curve bosses should be priced against)');
const gymTurns = [];
for(let b = 0; b < E.TUNING.badgesToWin; b++) gymTurns.push((b + 1) * (E.TUNING.battlesPerBadge + 1));
for(const t of [1,2,4,6,8,12,16,20,24,28,32,34,36,37]){
  if(!byTurn[t]) continue;
  console.log(`  turn ${String(t).padStart(2)}  ${mean(byTurn[t]).toFixed(0).padStart(5)}` +
    `  (n=${byTurn[t].length})${gymTurns.includes(t) ? '   <- gym' : ''}`);
}
console.log('\nboss vs player, at the moment they meet');
console.log('  leader      win%   bodies      sum ATK        power');
for(const b of [...E.GYMS, ...E.ELITE_FOUR, E.CHAMPION]){
  if(!bossPow[b.id]) continue;
  const w = (mean(bossWin[b.id]) * 100).toFixed(0) + '%';
  console.log(`  ${b.name.padEnd(10)} ${w.padStart(5)}` +
    `   ${mean(playerSizeAt[b.id]).toFixed(1)}v${mean(bossSize[b.id]).toFixed(1)}` +
    `   ${mean(playerAtkAt[b.id]).toFixed(0).padStart(4)}v${mean(bossAtk[b.id]).toFixed(0).padStart(4)}` +
    `   ${mean(playerHpAt[b.id]).toFixed(0).padStart(4)}v${mean(bossHp[b.id]).toFixed(0).padStart(4)}` +
    `   ${mean(playerSpdAt[b.id]).toFixed(0).padStart(3)}v${mean(bossSpd[b.id]).toFixed(0).padStart(3)}` +
    `   ${mean(bossPow[b.id]).toFixed(0).padStart(5)}`);
}
