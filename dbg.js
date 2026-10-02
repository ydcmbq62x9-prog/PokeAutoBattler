const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage(); await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
  console.log(JSON.stringify(await p.evaluate(() => { localStorage.clear();
    G = newGame(11, { gens: [1, 2], mods: { secrets: true } }); rollShop(G, false);
    G.stage = runPlan(G).findIndex(x => x.kind === 'champion'); G.badges = 8;
    applyBattleResult(G, 'win', opponentFor0(G), null); nextTurn(G);
    applyBattleResult(G, 'win', opponentFor0(G), null);
    const a = { over: G.over, now: secretBoss().id, k: stageOf(G).kind, idx: G.secIdx };
    PREF.set('gens', [1, 2]); const r = records(); r.tickets = { red: 1, oak: 1 }; saveRecords(r); openNewRun();
    const bt = document.querySelector('[data-mod="secrets"]');
    return { a, cls: bt.className, txt: bt.innerText, gens: PREF.get('gens'), t: ticketCount('red') }; })));
  await b.close(); })();
