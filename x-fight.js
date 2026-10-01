/* The exploit as reported: standing at a boss with a spread attacker in the
   party and credits in hand. Same fights, same seeds; only what the credits buy
   changes. */
const E = require('./engine.js');
const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 200);
const clone = o => JSON.parse(JSON.stringify(o));
const NEW = E.BATTLE_ITEMS.map(d => d.apply);
const OLD = [ (u, t) => { u.tmpAtk = (u.tmpAtk||0) + 9 + Math.floor(t*2.7); },
              (u, t) => { u.tmpSpd = (u.tmpSpd||0) + 10 + Math.floor(t*1.3); } ];
const rules = w => { E.BATTLE_ITEMS.forEach((d,i) => d.apply = w === 'old' ? OLD[i] : NEW[i]);
                     E.TUNING.xItems.perMon = w === 'old' ? 999 : 1; };

// reach the Nth gym, then put a caught-up Zapdos in for the weakest member
function arrive(seed, gym){
  const G = E.newGame(seed); E.rollShop(G, false);
  const target = (gym + 1) * (E.TUNING.battlesPerBadge + 1) - 1;
  let guard = 0;
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:0, x:'never' });
    if((G.stage || 0) === target) break;
    B.fight(G); if(G.over) return null; E.nextTurn(G);
  }
  if(G.over || (G.stage || 0) !== target) return null;
  const z = E.trainerCatchUp(G, E.makeUnit('zapdos', 0));
  let w = 0; G.team.forEach((u, i) => { if(E.unitPower(u) < E.unitPower(G.team[w])) w = i; });
  G.team[w] = z;
  return { G, zi: w };
}
function fight(G){ const opp = E.opponentFor(G); return E.stageBattle(G, opp, 991).result === 'win'; }

for(const gym of [3, 6]){
  let n = 0; const w = { none:0, oldDump:0, newDump:0, newAll:0 }; let spent = 0;
  for(let s = 1; n < RUNS && s < RUNS * 5; s++){
    const a = arrive(s * 7 + 1, gym); if(!a) continue; n++;
    const credits = 24;                 // a turn's pay, saved
    // no X items
    { const G = clone(a.G); if(fight(G)) w.none++; }
    // OLD rules: every credit into X Attack on Zapdos
    { rules('old'); const G = clone(a.G); G.credits = credits;
      while(G.credits >= 2) E.buyBattleItem(G, 0, a.zi);
      spent += a.G.team[a.zi] ? G.team[a.zi].tmpAtk : 0;
      if(fight(G)) w.oldDump++; rules('new'); }
    // NEW rules: try the same — the cap stops it after one
    { const G = clone(a.G); G.credits = credits;
      let g = 0; while(G.credits >= 2 && g++ < 30) if(!E.buyBattleItem(G, 0, a.zi).ok) break;
      if(fight(G)) w.newDump++; }
    // NEW rules: the intended use — one of each for everyone
    { const G = clone(a.G); G.credits = credits;
      for(let i = 0; i < G.team.length; i++) for(let k = 0; k < 2; k++) E.buyBattleItem(G, k, i);
      if(fight(G)) w.newAll++; }
  }
  const p = k => `${(w[k]/n*100).toFixed(0)}%`.padStart(5);
  console.log(`gym ${gym+1} (n=${n}, 24₽ in hand, Zapdos in the party)`);
  console.log(`  no X items                           ${p('none')}`);
  console.log(`  OLD: 12× X Attack on Zapdos          ${p('oldDump')}   (+${Math.round(spent/n)} Attack on one pokémon)`);
  console.log(`  NEW: tries the same, capped at 1     ${p('newDump')}`);
  console.log(`  NEW: one of each for all six         ${p('newAll')}`);
}
