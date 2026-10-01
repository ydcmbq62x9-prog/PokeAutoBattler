/* Three EXP models, measured on the thing that actually matters.
   ---------------------------------------------------------------
   Clear rate is NOT the comparison here — any of these can be re-tuned to hit
   a clear rate. The question is whether the middle of the run has decisions in
   it, so the instrument is an UPGRADE-SEEKING bot: one that will sell its
   weakest pokémon to buy a better one. Under a model where your turn-3 team is
   permanent it will never find a trade worth making, and the Daycare, the PC
   and the scouting report are all dead weight behind that fact. */
const E = require('./engine.js');
const RUNS = Number(process.env.RUNS || 250);

const MODELS = {
  'current    unit 3/3/2': { expModel:'unit',    win:{hp:3,atk:3,spd:2}, loss:{hp:1,atk:0,spd:1} },
  'hard cut   unit 1/1/1': { expModel:'unit',    win:{hp:1,atk:1,spd:1}, loss:{hp:1,atk:0,spd:0} },
  'trainer    exp 3/3/2':  { expModel:'trainer', win:{hp:3,atk:3,spd:2}, loss:{hp:1,atk:0,spd:1} },
  'trainer    exp 1/1/1':  { expModel:'trainer', win:{hp:1,atk:1,spd:1}, loss:{hp:1,atk:0,spd:0} },
};

function play(cfg){
  E.TUNING.expModel = cfg.expModel;
  E.TUNING.expGainWin = cfg.win;
  E.TUNING.expGainLoss = cfg.loss;

  let cleared = 0, badges = 0, runs = 0;
  let swaps = 0, considered = 0, keptFromT10 = 0, teamsAtT10 = 0;
  let pMons = 0, pItems = 0, pExp = 0;
  const pw = G => E.teamPower(G.team);

  for(let r = 0; r < RUNS; r++){
    const G = E.newGame(r * 7 + 1);
    E.rollShop(G, false);
    let guard = 0, t10 = null;

    while(!G.over && guard++ < 200){
      const before = pw(G);
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

      // fill the party / merge copies, exactly as the balance bot does
      for(let i = 0; i < G.daycare.length; i++){
        if(G.credits < E.TUNING.costBuy) break;
        const s = G.daycare[i]; if(!s || s.bought) continue;
        const d = G.team.findIndex(u => u.id === s.unit.id && E.unitLevel(u) < 3);
        const slot = d >= 0 ? d : G.team.length;
        if(d < 0 && G.team.length >= E.TUNING.maxTeam) continue;
        E.buyPokemon(G, i, slot);
      }

      /* THE INSTRUMENT. Party full: is anything on the shelf better than the
         worst pokémon I own? Price the offer as it would ARRIVE — caught up if
         the trainer banks the EXP, bare if the pokémon does. */
      if(G.turn > 6 && G.team.length >= E.TUNING.maxTeam){
        for(let i = 0; i < G.daycare.length; i++){
          const s = G.daycare[i]; if(!s || s.bought) continue;
          if(G.credits < E.TUNING.costBuy) break;
          considered++;
          const probe = { ...s.unit };
          E.trainerCatchUp(G, probe);
          const offer = E.unitPower(probe);
          let worst = 0;
          for(let k = 1; k < G.team.length; k++)
            if(E.unitPower(G.team[k]) < E.unitPower(G.team[worst])) worst = k;
          // only trade up by a clear margin — churning for 1% is not a decision
          if(offer > E.unitPower(G.team[worst]) * 1.15){
            if(E.sellUnit(G, worst).ok && E.buyPokemon(G, i, G.team.length).ok) swaps++;
          }
        }
      }

      const afterMons = pw(G);
      buyMart();
      let g2 = 0;
      while(G.credits >= E.TUNING.costRoll + 3 && g2++ < 40){ if(!E.rollMart(G, true)) break; buyMart(); }
      const afterShop = pw(G);
      E.endTurnEffects(G);

      if(G.turn === 10) t10 = new Set(G.team.map(u => E.evoLine(u.id)[0]));

      const opp = E.opponentFor(G);
      E.applyBattleResult(G, E.simulateBattle(G.team, opp.team, G.seed + G.turn).result, opp);
      pMons += afterMons - before; pItems += afterShop - afterMons; pExp += pw(G) - afterShop;
      if(G.over) break;
      E.nextTurn(G);
    }
    if(G.over === 'won') cleared++;
    badges += G.badges; runs++;
    if(t10 && G.turn > 12){
      const end = new Set(G.team.map(u => E.evoLine(u.id)[0]));
      let kept = 0; for(const k of t10) if(end.has(k)) kept++;
      keptFromT10 += t10.size ? kept / t10.size : 1; teamsAtT10++;
    }
  }
  const tot = pMons + pItems + pExp || 1;
  return { pct: cleared/RUNS*100, badges: badges/RUNS,
           swaps: swaps/runs, considered: considered/runs,
           kept: teamsAtT10 ? keptFromT10/teamsAtT10*100 : 100,
           mons: pMons/tot*100, items: pItems/tot*100, exp: pExp/tot*100 };
}

console.log('model                    cleared  badges | swaps/run  team kept from t10 | power: mons  items   EXP');
for(const [label, cfg] of Object.entries(MODELS)){
  const r = play(cfg);
  console.log(label.padEnd(25) +
    `${r.pct.toFixed(0)}%`.padStart(6) + r.badges.toFixed(1).padStart(9) + ' |' +
    r.swaps.toFixed(1).padStart(10) + `${r.kept.toFixed(0)}%`.padStart(20) + ' |' +
    `${r.mons.toFixed(0)}%`.padStart(12) + `${r.items.toFixed(0)}%`.padStart(7) + `${r.exp.toFixed(0)}%`.padStart(6));
}
