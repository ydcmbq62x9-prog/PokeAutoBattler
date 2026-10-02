/* 4.4.0: Secret Gauntlet, Gauntlet Badge, secret-boss streak. */
const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(700);
  await p.evaluate(() => localStorage.clear());
  const e = await p.evaluate(() => {
    const g = newGame(1, { gens: [1, 2], mods: { secrets: true } }), g1 = newGame(1, { gens: [1], mods: { secrets: true } });
    return { s: g.secrets, mod: !!g.mods.secrets, bad: !!g1.mods.secrets && !!g1.secrets }; });
  check(e.s && e.s.join() === 'red,oak' && e.mod && !e.bad, 'Secret Gauntlet needs Gen 1 + 2 and queues Red then Oak');
  const flow = await p.evaluate(() => {
    G = newGame(11, { gens: [1, 2], mods: { secrets: true } }); rollShop(G, false);
    const plan0 = runPlan(G).length;
    G.stage = runPlan(G).findIndex(x => x.kind === 'champion'); G.badges = 8; phase = 'shop';
    applyBattleResult(G, 'win', opponentFor0(G), null); nextTurn(G);
    const plan1 = runPlan(G), kinds = plan1.slice(-3).map(x => x.kind + ':' + (x.boss && x.boss.id));
    const o1 = secretBoss().id; const r1 = applyBattleResult(G, 'win', opponentFor0(G), null);
    const afterRed = { over: G.over, now: secretBoss().id, wins: G.secWon.join(), kind: stageOf(G).kind };
    nextTurn(G);
    applyBattleResult(G, 'win', opponentFor0(G), null);
    noteRunEnd(); const R = records();
    return { plan0, len: plan1.length, kinds, o1, afterRed, over: G.over, won: G.secWon.join(), R: { red: R.red && R.red.count, oak: R.oak && R.oak.count, g: R.gauntlet && R.gauntlet.count, st: R.secStreak, tk: R.tickets }, reached: reachedStage(), planLen: runPlan(G).length }; });
  check(flow.len === flow.plan0 + 2 && flow.kinds.join() === 'champion:' + flow.kinds[0].split(':')[1] + ',red:red,red:oak', 'plan has two secret stages after the Champion: ' + flow.kinds.join());
  check(!flow.afterRed.over && flow.afterRed.now === 'oak' && flow.afterRed.kind === 'red', 'beating Red moves on to Oak without ending the run');
  check(flow.over === 'won' && flow.won === 'red,oak', 'beating Oak ends the run as a clear');
  check(flow.R.red === 1 && flow.R.oak === 1 && flow.R.g === 1 && flow.R.st.best === 2 && flow.R.st.cur === 2 && flow.R.tk.red === 1 && flow.R.tk.oak === 1, 'both badges, a ticket each, the Gauntlet Badge and a streak of 2: ' + JSON.stringify(flow.R));
  check(flow.reached === flow.planLen, 'reached stage counts both wins');
  const lose = await p.evaluate(() => { localStorage.clear();
    G = newGame(12, { gens: [1, 2], mods: { secrets: true } }); rollShop(G, false);
    G.stage = runPlan(G).findIndex(x => x.kind === 'champion'); G.badges = 8;
    applyBattleResult(G, 'win', opponentFor0(G), null); nextTurn(G);
    applyBattleResult(G, 'win', opponentFor0(G), null); nextTurn(G);
    applyBattleResult(G, 'lose', opponentFor0(G), null); noteRunEnd(); noteRunEnd(); const R = records();
    phase = 'over'; render(); const txt = document.body.innerText;
    return { over: G.over, red: R.red && R.red.count, oak: R.oak && R.oak.count, g: R.gauntlet && R.gauntlet.count, st: R.secStreak, txt: /OAK|Oak/.test(txt) }; });
  check(lose.over === 'won' && lose.red === 1 && !lose.oak && !lose.g && lose.st.cur === 0 && lose.st.best === 1, 'win Red, lose Oak: Red badge only, streak resets: ' + JSON.stringify(lose));
  /* UI: New Run toggle */
  const ui = await p.evaluate(async () => { localStorage.clear(); G = newGame(3, { gens: [1] }); rollShop(G, false); phase = 'shop'; render();
    PREF.set('gens', [1, 2]); openNewRun();
    const locked1 = document.querySelector('[data-mod="secrets"]').classList.contains('off') && /Locked/.test(document.querySelector('[data-mod="secrets"]').innerText);
    document.querySelectorAll('.modal').forEach(m => m.remove());
    const r = records(); r.tickets = { red: 1, oak: 1 }; saveRecords(r); openNewRun();
    const bt = document.querySelector('[data-mod="secrets"]'); const unlocked = !bt.classList.contains('off'); bt.click(); const on = bt.classList.contains('on');
    document.querySelector('[data-n="go"]').click(); await new Promise(r => setTimeout(r, 200));
    return { locked1, unlocked, on, secrets: G.secrets && G.secrets.join(), tk: records().tickets, label: modsLabel(G) }; });
  check(ui.locked1 && ui.unlocked && ui.on && ui.secrets === 'red,oak' && ui.tk.red === 0 && ui.tk.oak === 0 && /Secret Gauntlet/.test(ui.label), 'New Run: locked without tickets, unlocked with them, spends both: ' + JSON.stringify(ui));
  const card = await p.evaluate(() => { openTrainerCard(false); const t = document.querySelector('.tcard, .trainer').innerText; document.querySelectorAll('.modal').forEach(m => m.remove()); return t; });
  check(/Gauntlet Badge/.test(card), 'Trainer Card shows the Gauntlet Badge row');
  const dock = await p.evaluate(() => { G = newGame(11, { gens: [1, 2], mods: { secrets: true } }); rollShop(G, false); G.stage = runPlan(G).findIndex(x => x.kind === 'champion'); G.badges = 8; phase = 'shop';
    applyBattleResult(G, 'win', opponentFor0(G), null); nextTurn(G); render(); const a = document.querySelector('.dock').innerText;
    applyBattleResult(G, 'win', opponentFor0(G), null); nextTurn(G); render(); return { a, b: document.querySelector('.dock').innerText }; });
  check(/Red/.test(dock.a) && /Oak/.test(dock.b), 'dock names Red, then Oak');
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
