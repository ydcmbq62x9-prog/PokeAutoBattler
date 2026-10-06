const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{ width:393, height:740 }, hasTouch:true, isMobile:true, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.PKB_TITLE = false; window.PKB_WIPE = true; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(700);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[2] }); G.stage = runPlan().findIndex(s => s.kind === 'gym');
    G.team = ['quilava','chikorita','azumarill','spinarak','hoothoot'].map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); fixSlots(G); render(); });
  await p.evaluate(() => document.querySelector('[data-act=endturn]').click());
  await p.waitForTimeout(2300);
  console.log(await p.evaluate(() => { const w = document.querySelector('#world .walkout'), S = battle.stage.el; const a = w.getBoundingClientRect(), e = S.getBoundingClientRect(), img = w.querySelector('img').getBoundingClientRect();
    const marks = [...S.querySelectorAll('.slotmark.e')].map(m => m.getBoundingClientRect()); const cx = (Math.min(...marks.map(m=>m.left)) + Math.max(...marks.map(m=>m.right)))/2;
    return { stageCx: e.left + e.width/2, marksCx: cx, walkCx: a.left + a.width/2, imgCx: img.left + img.width/2, imgW: img.width, w: a.width, nat: w.querySelector('img').naturalWidth + 'x' + w.querySelector('img').naturalHeight }; }));
  await p.screenshot({ path:'bp.png' });
  await b.close();
})();
