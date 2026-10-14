/* 4.1.0: Red in the UI — dock, over screens, badge, card, summary image, transfer. */
const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(700);
  await p.evaluate(() => { localStorage.clear(); });
  const a = await p.evaluate(() => {
    G = newGame(11, { gens: [2] }); G.redFlag = 'red'; rollShop(G, false);
    G.stage = runPlan(G).findIndex(x => x.kind === 'champion'); G.badges = 8; phase = 'shop'; render();
    const before = document.querySelector('.dock') && document.querySelector('.dock').textContent;
    applyBattleResult(G, 'win', opponentFor0(G), null); nextTurn(G); render();
    const txt = t => (document.querySelector(t) || {}).textContent || '';
    return { before, dock: txt('.dock'), strip: txt('.redstrip'), art: !!document.querySelector('.dock .bossart img'), sprite: !!SPRITES.red };
  });
  check(a.sprite, 'Red has a sprite'); check(/Champion Blue|Champion Lance|Champion/.test(a.before), 'before: the Champion is next');
  check(/Red is waiting at Mt\. Silver/.test(a.dock) && /one chance/.test(a.dock) && /Challenge Red/.test(a.dock), 'dock: Red is waiting, one chance');
  check(/Mt\. Silver/.test(a.strip) && /one turn/.test(a.strip), 'shop strip tells you it is one turn to spend');
  check(a.art, 'Red’s portrait shows on the dock');
  /* lose */
  const lose = await p.evaluate(() => {
    const opp = opponentFor0(G); battle = { kind:'red', boss: opp.boss, opp, oppName: opp.name, steps:[{p:[],e:[],fx:[],lines:[]}], i:0, result:'lose', gauntlet:null };
    const lives = G.lives; applyBattleResult(G, 'lose', opp, null); battle = null; noteRunEnd(); phase = 'over'; render();
    return { html: document.body.innerText, lives, now: G.lives, rec: records().red || null };
  });
  check(/Champion!/.test(lose.html) && /Red didn.t say a word/.test(lose.html) && !/Red defeated/.test(lose.html), 'losing: Champion screen with the Mt. Silver note');
  check(lose.lives === lose.now && !lose.rec, 'losing: no life lost and no badge recorded');
  /* win */
  const win = await p.evaluate(() => {
    G = newGame(11, { gens: [2] }); G.redFlag = 'red'; rollShop(G, false);
    G.redOpen = true; G.redFlag = 'red'; G.stage = runPlan(G).length - 1; G.badges = 8;
    const opp = opponentFor0(G); applyBattleResult(G, 'win', opp, null); noteRunEnd(); phase = 'over'; render();
    const first = { html: document.body.innerText, rec: records().red, isNew: G.redNew, badge: !!document.querySelector('.redend .rdb') };
    noteRunEnd(); const again = records().red.count;
    return { first, again };
  });
  check(/Red defeated!/.test(win.first.html) && /Mt\. Silver/i.test(win.first.html) && win.first.badge, 'winning: Red Defeated screen with badge');
  check(win.first.rec.count === 1 && win.first.isNew && win.again === 1, 'badge recorded once, flagged NEW once');
  const card = await p.evaluate(() => { openTrainerCard(false); const b = document.querySelector('.sbt[data-sb="red"]'); b.click(); const t = (b.classList.contains('on') ? 'ON ' : '') + document.querySelector('.sbinfo').textContent; document.querySelectorAll('.modal').forEach(m => m.remove()); return t; });
  check(/^ON /.test(card) && /Red.s Badge/.test(card) && !/Not earned yet/.test(card), 'Trainer Card shows Red’s Badge as earned');
  const img = await p.evaluate(async () => { const bl = await runImage(); return bl ? bl.size : 0; });
  check(img > 5000, 'summary image renders with the Red banner (' + img + ' bytes)');
  /* transfer merge */
  const mg = await p.evaluate(() => JSON.stringify(mergeHardcore({ count:1, first:'2026-10-01', last:'2026-10-01' }, { count:3, first:'2026-09-01', last:'2026-10-02' })));
  check(/"count":3/.test(mg) && /2026-09-01/.test(mg), 'badge records merge across devices');
  const hc = await p.evaluate(() => { G = newGame(3, { gens:[1] }); return { open: G.redOpen, flag: G.redFlag }; });
  check(hc.flag !== 'red', 'a Gen 1 run never has Red');
  check(!errs.length, 'no page errors ' + errs.slice(0, 2).join('; '));
  await p.screenshot({ path: 'shot-red.png' });
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
