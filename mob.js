const { chromium, devices } = require('playwright');
const land = process.argv[2] === 'land';
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const dev = { ...devices['iPhone 14 Pro Max'] };
  if(land) dev.viewport = { width: dev.viewport.height, height: dev.viewport.width };
  const ctx = await b.newContext(dev); const p = await ctx.newPage();
  const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_WIPE = true; });
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(700);
  const tag = land ? 'L' : 'P';
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[2] }); sessionBattles = 9; G.turn = 24; G.credits = 22; G.badges = 5;
    G.stage = runPlan().findIndex((s, i) => s.kind === 'gym' && s.badge === 5) ; if(G.stage < 0) G.stage = runPlan().findIndex(s => s.kind === 'gym');
    const ids = ['umbreon','noctowl','togetic','meganium','hitmonlee','raichu']; G.team = ids.map((id, i) => { const u = makeUnit(id, 3); u.pos = i; return u; });
    G.team[0].held = 'claw'; fixSlots(G); rollShop(G, false); render(); });
  await p.waitForTimeout(500); await p.screenshot({ path:`m${tag}_1shop.png` });
  // pick a mart item (picking state)
  const mi = await p.$('.martrow[data-act="mart"]'); if(mi){ await mi.tap(); await p.waitForTimeout(500); await p.screenshot({ path:`m${tag}_2pick.png` }); }
  await p.evaluate(() => { sel = null; render(); window.scrollTo(0, 120); });
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-act=endturn]').click());
  await p.waitForTimeout(3600); await p.screenshot({ path:`m${tag}_3battle.png` });
  await p.evaluate(() => { battle.result = 'win'; finishPlayback(); });
  await p.waitForTimeout(3900); await p.screenshot({ path:`m${tag}_4line.png` });
  await p.waitForTimeout(2600); await p.screenshot({ path:`m${tag}_5badge.png` });
  await p.evaluate(() => document.querySelector('[data-act=afterbattle]').click());
  await p.waitForTimeout(1300); await p.screenshot({ path:`m${tag}_6cards.png` });
  console.log(errs);
  await b.close();
})();
