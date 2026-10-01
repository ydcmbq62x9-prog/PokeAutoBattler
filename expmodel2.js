/* The same three models, compared FAIRLY.
   -----------------------------------------
   Boss difficulty is priced against `powerCurve`, a line fitted to how fast a
   player grows — under the CURRENT EXP model. Change how EXP works and that
   line is wrong, so a cut model fights bosses built for a player three times
   its size and clears 0% of runs for reasons that have nothing to do with the
   design. Each model therefore gets its own fitted curve and a matching AI
   growth rate before anything is compared. */
const E = require('./engine.js');
const RUNS = Number(process.env.RUNS || 200);
const FIT_RUNS = 60;
const BASE_AI = 0.95;

const MODELS = {
  'current    unit 3/3/2': { expModel:'unit',    win:{hp:3,atk:3,spd:2}, loss:{hp:1,atk:0,spd:1} },
  'hard cut   unit 1/1/1': { expModel:'unit',    win:{hp:1,atk:1,spd:1}, loss:{hp:1,atk:0,spd:0} },
  'trainer    exp 3/3/2':  { expModel:'trainer', win:{hp:3,atk:3,spd:2}, loss:{hp:1,atk:0,spd:1} },
  'trainer    exp 2/2/1':  { expModel:'trainer', win:{hp:2,atk:2,spd:1}, loss:{hp:1,atk:0,spd:0} },
  'trainer    exp 1/1/1':  { expModel:'trainer', win:{hp:1,atk:1,spd:1}, loss:{hp:1,atk:0,spd:0} },
};

function shop(G, upgrade){
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
  let swaps = 0;
  if(upgrade && G.turn > 6 && G.team.length >= E.TUNING.maxTeam){
    for(let i = 0; i < G.daycare.length; i++){
      const s = G.daycare[i]; if(!s || s.bought) continue;
      if(G.credits < E.TUNING.costBuy) break;
      const probe = { ...s.unit }; E.trainerCatchUp(G, probe);
      let worst = 0;
      for(let k = 1; k < G.team.length; k++)
        if(E.unitPower(G.team[k]) < E.unitPower(G.team[worst])) worst = k;
      if(E.unitPower(probe) > E.unitPower(G.team[worst]) * 1.15){
        if(E.sellUnit(G, worst).ok && E.buyPokemon(G, i, G.team.length).ok) swaps++;
      }
    }
  }
  buyMart();
  let g = 0;
  while(G.credits >= E.TUNING.costRoll + 3 && g++ < 40){ if(!E.rollMart(G, true)) break; buyMart(); }
  E.endTurnEffects(G);
  return swaps;
}

/** Fit `powerCurve` to how fast THIS model actually grows a player. */
function fitCurve(){
  const xs = [], ys = [];
  for(let r = 0; r < FIT_RUNS; r++){
    const G = E.newGame(r * 13 + 3);
    E.rollShop(G, false);
    let guard = 0;
    while(!G.over && guard++ < 60){
      shop(G, false);
      xs.push(G.turn); ys.push(E.teamPower(G.team));
      const opp = E.opponentFor(G);
      // force progression so the fit is not truncated by the difficulty it is fitting
      E.applyBattleResult(G, 'win');
      if(G.over) break;
      E.nextTurn(G);
    }
  }
  const n = xs.length;
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let num = 0, den = 0;
  for(let i = 0; i < n; i++){ num += (xs[i]-mx)*(ys[i]-my); den += (xs[i]-mx)**2; }
  const perTurn = num/den, base = my - perTurn*mx;
  return { base: Math.round(base), perTurn: Math.round(perTurn) };
}

function play(){
  let cleared = 0, badges = 0, runs = 0, swaps = 0, kept = 0, keptN = 0;
  let pMons = 0, pItems = 0, pExp = 0;
  const pw = G => E.teamPower(G.team);
  for(let r = 0; r < RUNS; r++){
    const G = E.newGame(r * 7 + 1);
    E.rollShop(G, false);
    let guard = 0, t10 = null;
    while(!G.over && guard++ < 200){
      const before = pw(G);
      swaps += shop(G, true);
      const afterShop = pw(G);
      if(G.turn === 10) t10 = new Set(G.team.map(u => E.evoLine(u.id)[0]));
      const opp = E.opponentFor(G);
      E.applyBattleResult(G, E.simulateBattle(G.team, opp.team, G.seed + G.turn).result, opp);
      pItems += afterShop - before; pExp += pw(G) - afterShop;
      if(G.over) break;
      E.nextTurn(G);
    }
    if(G.over === 'won') cleared++;
    badges += G.badges; runs++;
    if(t10 && G.turn > 12){
      const end = new Set(G.team.map(u => E.evoLine(u.id)[0]));
      let k = 0; for(const x of t10) if(end.has(x)) k++;
      kept += t10.size ? k/t10.size : 1; keptN++;
    }
  }
  const tot = pItems + pExp || 1;
  return { pct: cleared/RUNS*100, badges: badges/RUNS, swaps: swaps/runs,
           kept: keptN ? kept/keptN*100 : 100, bought: pItems/tot*100, free: pExp/tot*100 };
}

const REF = MODELS['current    unit 3/3/2'];
E.TUNING.expModel = REF.expModel; E.TUNING.expGainWin = REF.win; E.TUNING.expGainLoss = REF.loss;
const refCurve = fitCurve();
console.log(`reference growth: ${refCurve.base} + ${refCurve.perTurn}/turn\n`);
console.log('model                     growth/turn  aiDiff  cleared  badges | swaps/run  team kept | bought  free');
for(const [label, cfg] of Object.entries(MODELS)){
  E.TUNING.expModel = cfg.expModel; E.TUNING.expGainWin = cfg.win; E.TUNING.expGainLoss = cfg.loss;
  E.TUNING.aiDifficulty = BASE_AI;
  const curve = fitCurve();
  E.TUNING.powerCurve = curve;
  // the AI has to grow at the player's new pace or trainer battles become a different game
  E.TUNING.aiDifficulty = BASE_AI * (curve.perTurn / refCurve.perTurn);
  const r = play();
  console.log(label.padEnd(26) + String(curve.perTurn).padStart(11) +
    E.TUNING.aiDifficulty.toFixed(2).padStart(8) +
    `${r.pct.toFixed(0)}%`.padStart(9) + r.badges.toFixed(1).padStart(8) + ' |' +
    r.swaps.toFixed(1).padStart(10) + `${r.kept.toFixed(0)}%`.padStart(12) + ' |' +
    `${r.bought.toFixed(0)}%`.padStart(8) + `${r.free.toFixed(0)}%`.padStart(6));
}
