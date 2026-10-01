// quick X-swing probe: env DR (damageRoll), H (harder)
const E = require('./engine.js'); const B = require('./botlib.js');
E.TUNING.damageRoll = Number(process.env.DR || 0);
const H = Number(process.env.H || 1.35), RUNS = 150, BASE = E.TUNING.gauntletRatio.slice();
const clone = o => JSON.parse(JSON.stringify(o));
function arrive(seed){ const G = E.newGame(seed); E.rollShop(G, false); const stage = E.gauntletStart() + 4; let g = 0;
  while(!G.over && g++ < 220){ B.shop(G, { reroll:true, bench:0, x:'never' }); if((G.stage||0) === stage) return G;
    B.fight(G); if(G.over) return null; if(E.inGauntlet(G)) G.gauntlet = null; E.nextTurn(G); } return null; }
let n=0, none=0, maxed=0;
for(let s = 1; n < RUNS && s < RUNS*6; s++){ E.TUNING.gauntletRatio = BASE; const G0 = arrive(s*11+3); if(!G0) continue; n++;
  E.TUNING.gauntletRatio = BASE.map(x => x*H); const opp = E.opponentFor(G0);
  for(let k=0;k<5;k++){ if(E.stageBattle(clone(G0), opp, 991+k).result === 'win') none += 0.2;
    const G = clone(G0); G.credits = 99; for(let j=0;j<6;j++){ E.buyBattleItem(G,0); E.buyBattleItem(G,1); }
    if(E.stageBattle(G, opp, 991+k).result === 'win') maxed += 0.2; } }
console.log(`DR ${E.TUNING.damageRoll} H ${H}: none ${(none/n*100).toFixed(0)}% max ${(maxed/n*100).toFixed(0)}% (+${((maxed-none)/n*100).toFixed(0)})`);
