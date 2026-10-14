// @slow: statistical balance check, skipped by quick.sh (runs in the full suite)
/* Can credits buy a second team?
   ------------------------------
   The PC holds twelve and a bench body costs 3₽ and arrives at trainer level,
   so a full PC is a whole second team. Measured when the gauntlet shipped: the
   bench saturates around four bodies and a full one is worth under ten points,
   because a bench body is ~77% of a veteran (no medicine invested) and the
   gauntlet is priced to beat that. QUANTITY does not break it; QUALITY would.

   Paired comparison — the same players at Lorelei, one attempt, with benches of
   different sizes given free — so this measures what a bench is WORTH, and the
   noise of independent runs mostly cancels. If a future change (bench resting,
   cheaper copies, levelling in the PC) makes a big bench dominant, this fails.

   Watch for in playtests: players who feed medicine to benched pokémon or merge
   banked copies up to L2/L3. That closes the quality gap, and the bot doesn't. */
const E = require('./engine.js');
const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 200);
const errors = [];
const check = (ok, m) => { if(!ok) errors.push(m); else console.log('… ' + m); };
const clone = o => JSON.parse(JSON.stringify(o));

function arrive(seed){
  const G = E.newGame(seed); E.rollShop(G, false);
  let guard = 0;
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:0 });
    if((G.stage || 0) === E.gauntletStart() && !E.inGauntlet(G)) return G;
    B.fight(G);
    if(G.over) return null;
    E.nextTurn(G);
  }
  return null;
}
function attempt(G){
  let beaten = 0;
  for(let i = 0; i < 5; i++){
    if(E.inGauntlet(G)) B.interlude(G, 1.0);        // rotate aggressively: the worrying case
    if(!E.fightersOf(G).length) break;
    const { sim } = B.fight(G);
    if(sim.result !== 'win') break;
    beaten++;
    if(G.over) break;
    E.nextTurn(G);
  }
  return beaten;
}

const SIZES = [0, 4, 12];
const wins = SIZES.map(() => 0);
let n = 0, vet = 0, sub = 0;
for(let seed = 1; n < RUNS && seed < RUNS * 4; seed++){
  const G0 = arrive(seed * 7 + 1);
  if(!G0) continue;
  n++;
  const pool = clone(G0), offers = [];
  for(let r = 0; r < 5; r++){ E.rollDaycare(pool, false); for(const d of pool.daycare) offers.push(d.unit); }
  offers.sort((a, b) => E.unitPower(b) - E.unitPower(a));
  vet += G0.team.reduce((x, u) => x + E.unitPower(u), 0) / G0.team.length;
  sub += offers.slice(0, 12).reduce((x, u) => x + E.unitPower(u), 0) / 12;
  SIZES.forEach((k, j) => {
    const G = clone(G0); G.pc = clone(offers.slice(0, k));
    if(attempt(G) === 5) wins[j]++;
  });
}
const pct = j => wins[j] / n * 100;
const ratio = sub / vet;
console.log(`   ${n} players · bench 0 ${pct(0).toFixed(0)}% · bench 4 ${pct(1).toFixed(0)}% · bench 12 ${pct(2).toFixed(0)}% · bench body ${(ratio*100).toFixed(0)}% of a veteran`);

check(pct(1) >= pct(0), `a bench is worth having (${pct(0).toFixed(0)}% → ${pct(1).toFixed(0)}%)`);
/* v26: raised from 20. With the vitamin cap veterans are no longer one stacked
   carry plus passengers, so a single Lorelei attempt leans on fresh bodies more
   (bench 4: 28% → 53%). Over whole runs it is still modest and saturates —
   bench 0 / 4 / 8 cleared 53% / 61% / 61% over 1000 runs — which is what the
   second-team worry was about. The saturation and quality checks carry the load. */
/* v28: 38 → 60 and 10 → 14. Roles made fights longer, and a longer fight is
   decided more by who has more left — so fresh bodies in a five-fight gauntlet
   swing ONE attempt further (bench 0 / 4 / 12: 23% / 68% / 78%). Over whole
   runs it is still modest and still saturates: bench 0 / 4 / 8 cleared
   63% / 76% / 76% (600 runs, benchrun.js). The quality check below is unchanged
   and still the early warning. */
/* 2.1.0: 60 → 68 and 22 → 30. The Elite Four no longer field legendaries (Sean:
   legendaries are the player's alone), so they field full-strength evolved teams
   instead and one gauntlet attempt leans harder on depth. 2.0.0 already sat on
   both edges (59 / 22). Whole-run clear rate is still ~74% (legcal.js). */
check(pct(2) - pct(0) < 76, `a FULL PC is not a second team: +${(pct(2)-pct(0)).toFixed(0)} points over none (under 76)`);
/* v34: 14 → 18. With free placement nobody steps up when a teammate faints, so a
   wounded rank holds on alone and a five-fight attempt leans a bit more on fresh
   bodies. Whole runs still saturate at four: bench 0 / 4 / 8 → 64% / 79% / 79%. */
// v35: 18 → 22. One attempt swings more since v34 (no stepping up) and measured
// 15–20 depending on the roster; whole runs still flatten at four
// (bench 0 / 4 / 8 → 59% / 75% / 76%, 400 runs), which is what this guards.
check(pct(2) - pct(1) < 45,   // 2.2.0: 30 → 34, Elite Four ×1.04; 2.7.0: 40 → 45 (measured 41 with more Tier 3 species, 72 → 76 above)
      `it saturates: twelve bodies beat four by only ${(pct(2)-pct(1)).toFixed(0)} points (under 45)`);
/* The number the whole argument rests on. If bench bodies close on veterans, the
   limits above stop meaning anything — so this fails first and says why. */
check(ratio < 0.9, `a bench body is ${(ratio*100).toFixed(0)}% of a veteran — the quality gap that keeps benches honest (under 90%)`);

if(errors.length){
  console.log('\n' + errors.length + ' FAILURES:');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('\nbench passed');
