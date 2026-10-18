/* 6.22.0 (Sean): the Gauntlet run rule — "boss rush" here, since gauntlettest.js is the Elite Four gauntlet — (bosses only, then every gen's secret boss) and the reworked badges:
   one Secret Boss Badge for any secret boss (lists who, gold for all three) and the Gauntlet Badge for a full clear. */
const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(700);
  await p.evaluate(() => { localStorage.clear(); document.querySelectorAll('.modal,#title').forEach(e => e.remove()); document.body.classList.remove('titled'); });
  /* the plan: bosses only, every gen's secret boss in gen order */
  const plans = await p.evaluate(() => [[1], [2], [3], [1, 2], [1, 2, 3]].map(gens => { const g = newGame(5, { gens, mods: { gauntlet: true } });
    return { gens: gens.join('+'), kinds: runPlan(g).map(x => x.kind[0]).join(''), sec: g.secrets.join(','), turn: g.turn, cr: g.credits, e4: gauntletStart(g) }; }));
  for(const x of plans) check(x.kinds === 'ggggggggeeeec' && x.e4 === 8, `Gen ${x.gens}: 8 gyms, the Elite Four and the Champion, no trainers (${x.kinds})`);
  check(plans[0].sec === 'oak' && plans[1].sec === 'red' && plans[2].sec === 'steven' && plans[4].sec === 'oak,red,steven', 'each gen sends its own secret boss, in gen order: ' + plans.map(x => x.sec).join(' | '));
  check(plans[0].turn === 4 && plans[0].cr === 40, `the run opens with a big turn: turn ${plans[0].turn}, ${plans[0].cr}₽`);
  const normal = await p.evaluate(() => { const g = newGame(5, { gens: [1] }); return { len: runPlan(g).length, turn: g.turn, cr: g.credits, sec: g.secrets }; });
  check(normal.len === 37 && normal.turn === 1 && normal.cr === 10 && !normal.sec, 'a normal run is unchanged (37 stages, turn 1, 10₽)');
  /* big turns: after a gym win (another gym next) the clock jumps and the pay and EXP come four times over; a retry does not */
  const turns = await p.evaluate(() => {
    G = newGame(21, { gens: [1], mods: { gauntlet: true } }); rollShop(G, false); buyPokemon(G, 0); phase = 'shop';
    const t0 = G.turn, exp0 = JSON.stringify(G.trainerExp);
    G.credits = 0; applyBattleResult(G, 'lose', opponentFor0(G), null); nextTurn(G);
    const afterLoss = { turn: G.turn - t0, cr: G.credits };
    const t1 = G.turn; G.credits = 0; applyBattleResult(G, 'win', opponentFor0(G), null); const exp1 = G.trainerExp.atk; nextTurn(G);
    const inc = G.income;
    return { afterLoss, winTurn: G.turn - t1, credits: G.credits, rush: inc.rush, earned: inc.total - inc.carry - inc.rush, expGain: exp1, exp0 }; });
  check(turns.afterLoss.turn === 1, `a gym loss is an ordinary turn (+${turns.afterLoss.turn})`);
  check(turns.winTurn === 4 && turns.rush === 3 * turns.earned && turns.credits === turns.earned * 4, `a gym win makes the next turn big: +${turns.winTurn} turns, ${turns.credits}₽ (4 × ${turns.earned})`);
  const e4 = await p.evaluate(() => { G = newGame(22, { gens: [1], mods: { gauntlet: true } }); rollShop(G, false); buyPokemon(G, 0);
    G.stage = 7; G.badges = 7; applyBattleResult(G, 'win', opponentFor0(G), null); const big = !!G.rushBig, at = stageOf(G).kind;
    nextTurn(G); G.stage = 10; G.gauntlet = { hpFrac: {} }; applyBattleResult(G, 'lose', opponentFor0(G), null); return { big, at, back: G.stage }; });
  check(!e4.big && e4.at === 'elite', 'the 8th gym leads straight to the Elite Four, with no big turn (none is skipped)');
  check(e4.back === 8, `losing in the Elite Four sends you back to its first member (stage ${e4.back})`);
  /* the secret bosses, the badges */
  const flow = await p.evaluate(() => { localStorage.clear();
    G = newGame(23, { gens: [1, 2, 3], mods: { gauntlet: true } }); rollShop(G, false);
    G.stage = runPlan(G).findIndex(x => x.kind === 'champion'); G.badges = 8; phase = 'shop';
    applyBattleResult(G, 'win', opponentFor0(G), null); nextTurn(G);
    const order = []; for(let k = 0; k < 3; k++){ order.push(secretBoss().id); applyBattleResult(G, 'win', opponentFor0(G), null); if(!G.over) nextTurn(G); }
    noteRunEnd(); const R = records();
    return { order: order.join(), over: G.over, R: { oak: R.oak && R.oak.count, red: R.red && R.red.count, steven: R.steven && R.steven.count, g: R.gauntlet && R.gauntlet.count, streak: R.secStreak && R.secStreak.best },
      tickets: R.tickets, label: modsLabel(G) }; });
  check(flow.order === 'oak,red,steven' && flow.over === 'won', 'after the Champion: Oak, Red and Steven back to back, then the run is won (' + flow.order + ')');
  check(flow.R.oak === 1 && flow.R.red === 1 && flow.R.steven === 1 && flow.R.g === 1 && flow.R.streak === 3, 'each secret boss is recorded, plus the Gauntlet Badge: ' + JSON.stringify(flow.R));
  check(/Gauntlet/.test(flow.label), 'the run is labelled Gauntlet (' + flow.label + ')');
  const card = await p.evaluate(() => { openTrainerCard(false); const out = {};
    for(const id of ['secret', 'gauntlet']){ const bt = document.querySelector(`.sbt[data-sb="${id}"]`); bt.click(); out[id] = { on: bt.classList.contains('on'), gold: bt.classList.contains('gold'), txt: document.querySelector('.sbinfo').textContent }; }
    out.old = !!document.querySelector('.sbt[data-sb="red"], .sbt[data-sb="oak"]'); document.querySelectorAll('.modal').forEach(m => m.remove()); return out; });
  check(card.secret.on && card.secret.gold && /✔ Oak/.test(card.secret.txt) && /✔ Red/.test(card.secret.txt) && /✔ Steven/.test(card.secret.txt), 'Trainer Card: one Secret Boss Badge, gold, ticks Oak, Red and Steven');
  check(card.gauntlet.on && !card.old, 'Trainer Card: the Gauntlet Badge is earned, and the old Red/Oak badges are gone');
  const part = await p.evaluate(() => { localStorage.clear();
    G = newGame(24, { gens: [1, 2], mods: { gauntlet: true } }); rollShop(G, false);
    G.stage = runPlan(G).findIndex(x => x.kind === 'champion'); G.badges = 8;
    applyBattleResult(G, 'win', opponentFor0(G), null); nextTurn(G);
    applyBattleResult(G, 'win', opponentFor0(G), null); nextTurn(G); applyBattleResult(G, 'lose', opponentFor0(G), null); noteRunEnd();
    const R = records(); openTrainerCard(false); const bt = document.querySelector('.sbt[data-sb="secret"]'); bt.click();
    const txt = document.querySelector('.sbinfo').textContent, gold = bt.classList.contains('gold'); document.querySelectorAll('.modal').forEach(m => m.remove());
    return { over: G.over, g: R.gauntlet && R.gauntlet.count, oak: R.oak && R.oak.count, red: R.red && R.red.count, txt, gold }; });
  check(part.over === 'won' && part.oak === 1 && !part.red && !part.g && !part.gold && /✔ Oak/.test(part.txt) && /– Red/.test(part.txt), 'beat Oak, lose to Red: the Secret Boss Badge (not gold), no Gauntlet Badge');
  /* New Run: the Gauntlet toggle, no tickets needed or spent; a ticket cannot be combined with it */
  const ui = await p.evaluate(async () => { localStorage.clear(); const r = records(); r.tickets = { red: 1 }; saveRecords(r);
    G = newGame(3, { gens: [1] }); rollShop(G, false); phase = 'shop'; render(); PREF.set('gens', [3]); openNewRun();
    const bt = document.querySelector('[data-mod="gauntlet"]'); const old = !!document.querySelector('[data-mod="secrets"]'); bt.click(); const on = bt.classList.contains('on');
    document.querySelector('[data-n="go"]').click(); await new Promise(r => setTimeout(r, 200));
    return { old, on, rush: !!(G.mods && G.mods.gauntlet), sec: G.secrets && G.secrets.join(), tk: records().tickets }; });
  check(ui.on && !ui.old && ui.rush && ui.sec === 'steven' && ui.tk.red === 1, 'New Run: Gauntlet works in a Gen 3 run with no tickets, and spends none: ' + JSON.stringify(ui));
  /* a run already on the old two-boss Secret Gauntlet finishes as it was */
  const old = await p.evaluate(() => { G = newGame(25, { gens: [1, 2] }); G.mods = { secrets: true }; G.secrets = ['red', 'oak']; G.secIdx = 0; G.secWon = []; G.redFlag = 'red';
    return { len: runPlan(G).length, e4: gauntletStart(G) }; });
  check(old.len === 37 && old.e4 === 32, 'a saved run on the old Secret Gauntlet keeps its normal schedule');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
