/* Three ways to bound the whole-team X package, on the same fights. Every
   option keeps the per-pokémon cap; they differ in what bounds the TOTAL. */
const E = require('./engine.js');
const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 200);
const clone = o => JSON.parse(JSON.stringify(o));

function arriveAt(seed, stage){
  const G = E.newGame(seed); E.rollShop(G, false);
  let guard = 0;
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:0, x:'never' });
    if((G.stage || 0) === stage) return G;
    B.fight(G); if(G.over) return null;
    if(E.inGauntlet(G) && stage === E.gauntletStart() + 4) G.gauntlet = null;
    E.nextTurn(G);
  }
  return null;
}
// best-first targets: X Attack then X Speed on the hardest hitter, then the next
const plan = G => G.team.map((u, i) => i).sort((a, b) => E.effAtk(G.team[b]) - E.effAtk(G.team[a]))
  .flatMap(i => [[0, i], [1, i]]);

const OPTIONS = {
  'none':                                   { pct: 0 },
  'once per pokémon only (+25%, 24₽)':      { pct: 0.25, max: 99 },
  'A · +25%, max 3 per battle':             { pct: 0.25, max: 3 },
  'B · +25%, max 4 per battle':             { pct: 0.25, max: 4 },
  'C · +25%, price rises 2,3,4… (24₽)':      { pct: 0.25, escalate: true },
  'D · +10%, once per pokémon (24₽)':       { pct: 0.10, max: 99 },
};
function buy(G, o){
  E.TUNING.xItems.atkPct = o.pct; E.TUNING.xItems.spdPct = o.pct;
  if(!o.pct) return 0;
  let bought = 0;
  for(const [k, i] of plan(G)){
    if(o.max != null && bought >= o.max) break;
    const price = o.escalate ? 2 + bought : 2;
    if(G.credits < price) break;
    if(o.escalate) G.credits -= price - E.BATTLE_ITEMS[k].cost;   // surcharge over the engine's price
    if(E.buyBattleItem(G, k, i).ok) bought++;
  }
  return bought;
}

for(const [label, stage] of [['gym 7', 7*(E.TUNING.battlesPerBadge+1)-1],
                             ['the Champion', E.gauntletStart()+4]]){
  let n = 0; const w = {}, items = {}, spent = {};
  for(const k in OPTIONS){ w[k] = 0; items[k] = 0; spent[k] = 0; }
  for(let s = 1; n < RUNS && s < RUNS * 6; s++){
    const G0 = arriveAt(s * 11 + 3, stage); if(!G0) continue; n++;
    const opp = E.opponentFor(G0);
    for(const [k, o] of Object.entries(OPTIONS)){
      const G = clone(G0); G.credits = 24;
      items[k] += buy(G, o); spent[k] += 24 - G.credits;
      if(E.stageBattle(G, opp, 991).result === 'win') w[k]++;
    }
  }
  console.log(`${label} (n=${n}, 24₽ in hand)`);
  for(const k in OPTIONS) console.log(`  ${k.padEnd(40)} wins ${(w[k]/n*100).toFixed(0).padStart(3)}%   ${(items[k]/n).toFixed(1)} items for ${(spent[k]/n).toFixed(0)}₽`);
}
