/* X items, as a regression test.
   -------------------------------
   They used to add a flat, turn-scaled amount to ONE pokémon and stack without
   limit: a dozen X Attacks on Zapdos, whose Thunder hits every enemy, one-shot
   whole teams. A per-pokémon cap stopped that but one of each on all six still
   took an 82% gym to 98%. They are now party-wide, +5% of each pokémon's own
   stat per use, at most 3 of each per battle.

   This guards the FIGHT-level swing on a coin-flip boss — where buying a fight
   shows up. The run level is guarded elsewhere (they cost medicine, so they
   are a tool, not a strategy). Paired: same arrivals at the Champion, same
   seed, with and without the maximum package. */
const { chromium } = require('playwright');
const E = require('./engine.js');
const B = require('./botlib.js');
const RUNS = Number(process.env.RUNS || 150);
const errors = [];
const check = (ok, m) => { if(!ok) errors.push(m); else console.log('… ' + m); };
const clone = o => JSON.parse(JSON.stringify(o));

function arrive(seed){
  const G = E.newGame(seed); E.rollShop(G, false);
  const stage = E.gauntletStart() + 4;
  let guard = 0;
  while(!G.over && guard++ < 220){
    B.shop(G, { reroll:true, bench:0, x:'never' });
    if((G.stage || 0) === stage) return G;
    B.fight(G); if(G.over) return null;
    if(E.inGauntlet(G)) G.gauntlet = null;     // price a FRESH Champion fight
    E.nextTurn(G);
  }
  return null;
}
/* v28: a fresh Champion (full HP, no gauntlet wounds) is no longer close for
   the reference player at the current prices, so the fight is priced up until
   it is a coin flip again — this measures X items, not the difficulty. */
// v53: 1.38 → 1.34. The Champion now carries a Very rare item, and at 1.38 the
// no-X side only won 33% — no longer a coin flip. 1.34 measures 46%.
const HARDER = Number(process.env.HARDER || 1.45);   // 6.6.0: was 1.34; Training Manuals grow with badges, so late teams are a little stronger and the old setting saturated at 99%
const BASE_GR = E.TUNING.gauntletRatio.slice();
let n = 0, none = 0, maxed = 0, dump = 0;
for(let s = 1; n < RUNS && s < RUNS * 6; s++){
  E.TUNING.gauntletRatio = BASE_GR;
  const G0 = arrive(s * 11 + 3); if(!G0) continue; n++;
  E.TUNING.gauntletRatio = BASE_GR.map(x => x * HARDER);
  const opp = E.opponentFor(G0);
  if(E.stageBattle(clone(G0), opp, 991).result === 'win') none++;
  const G = clone(G0); G.credits = 99;
  for(let k = 0; k < E.TUNING.xItems.perBattle + 5; k++){ E.buyBattleItem(G, 0); E.buyBattleItem(G, 1); }
  if(E.stageBattle(G, opp, 991).result === 'win') maxed++;
  // the reported exploit, attempted: everything into X Attack
  const D = clone(G0); D.credits = 99;
  let g = 0; while(g++ < 40 && E.buyBattleItem(D, 0).ok);
  if(E.stageBattle(D, opp, 991).result === 'win') dump++;
}
const pct = x => x / n * 100;
console.log(`   ${n} Champion fights · no X ${pct(none).toFixed(0)}% · max package ${pct(maxed).toFixed(0)}% · all-in X Attack ${pct(dump).toFixed(0)}%`);
check(pct(maxed) > pct(none), `X items are worth using (${pct(none).toFixed(0)}% → ${pct(maxed).toFixed(0)}%)`);
// v28: 30 → 36. Fights are longer since roles, so any stat edge decides more of
// them — the same +9% swings a coin flip further than it did. Measured +33 at 3%
// (it was +40 at the old 5%, which is why the item was cut).
// v53: 36 → 40. Sean put X items back to +5% in v50 knowing it was cut for this
// reason; measured +37 at a true coin flip (3 uses). The guard now holds the line
// at his design rather than the old 3%: it still fails if they grow any further.
// (2 uses a battle at +5% measures +29, if that's ever wanted.)
// v54: back to 36 — Sean took the 2-uses option (+29 measured at v53).
check(pct(maxed) - pct(none) < 36, `but the maximum can't buy a coin-flip boss fight: +${(pct(maxed)-pct(none)).toFixed(0)} points (under 36)`);
check(pct(dump) <= pct(maxed) + 3, 'going all-in on X Attack is no better than the capped package — the stack is gone');
const z = E.newGame(1); E.rollShop(z, false); z.credits = 99;
z.team = [E.makeUnit('zapdos', 0)]; const a0 = z.team[0].atk;
let bought = 0; while(bought < 40 && E.buyBattleItem(z, 0).ok) bought++;
check(bought === E.TUNING.xItems.perBattle && z.team[0].tmpAtk <= Math.ceil(a0 * E.TUNING.xItems.pct * bought) + bought,
  `forty tries buy ${bought} X Attacks: Zapdos gets +${z.team[0].tmpAtk} Attack, not +${Math.round(a0*9)}`);

/* ---------- browser: the flow with no target to pick ---------- */
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport:{ width:1200, height:1000 } })).newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    G.turn = 12; G.credits = 30; G.stage = 1; G.gauntlet = null;
    G.team = ['zapdos','onix','snorlax'].map(i => makeUnit(i, 0));
    save(); render();
  });
  await page.waitForTimeout(150);
  await page.click('.martrow[data-act="bitem"][data-i="0"]'); await page.waitForTimeout(120);
  const bar = await page.$eval('.ctxbar', e => e.textContent.replace(/\s+/g,' ').trim()).catch(() => '');
  check(/whole party/.test(bar) && new RegExp(`0 of ${E.TUNING.xItems.perBattle} used`).test(bar), `selecting X Attack explains it: "${bar.slice(0, 80)}"`);
  const targets = await page.$$eval('.formation .slot.valid', e => e.length);
  check(targets === 0, 'no party slot lights up as a target — there is nothing to pick');
  for(let k = 0; k < E.TUNING.xItems.perBattle; k++){ await page.click('[data-act="usex"]'); await page.waitForTimeout(120); }
  const after = await page.evaluate(() => ({
    pips: document.querySelectorAll('.martrow[data-i="0"] .xpips i.on').length,
    maxed: !!document.querySelector('.martrow.maxed[data-i="0"]'),
    off: document.querySelector('[data-act="usex"]').disabled,
    boosted: G.team.every(u => u.tmpAtk > 0), credits: G.credits }));
  check(after.pips === E.TUNING.xItems.perBattle && after.maxed && after.off, `${E.TUNING.xItems.perBattle} uses fill the pips, grey the row and disable the button`);
  check(after.boosted && after.credits === 30 - E.TUNING.xItems.perBattle * E.TUNING.xItems.cost, 'every party member is boosted, and it cost those uses');
  await page.setViewportSize({ width:390, height:860 }); await page.waitForTimeout(200);
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!over, 'fits a phone');
  await browser.close();
  if(errors.length){
    console.log('\n' + errors.length + ' FAILURES:');
    [...new Set(errors)].forEach(e => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('\nX items passed');
})();
