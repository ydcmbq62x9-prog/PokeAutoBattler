const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport:{width:430,height:900}, deviceScaleFactor:2 });
  const page = await ctx.newPage(); await page.goto('file:///mnt/user-data/outputs/pokebattler.html'); await page.waitForTimeout(250);
  await page.evaluate(() => { G.stage = TUNING.battlesPerBadge; G.turn = 4; G.team = [makeUnit('squirtle',0), makeUnit('pikachu',0)]; save(); render(); });
  await page.waitForTimeout(200);
  const r = await page.$eval('.speech .who img', i => { const b = i.getBoundingClientRect(); const cs = getComputedStyle(i.parentElement); return { w:b.width, h:b.height, nat:i.naturalWidth, par:i.parentElement.className, bg:cs.backgroundImage.slice(0,40), pos:cs.position }; });
  console.log(JSON.stringify(r));
  const el = await page.$('.speech'); await el.screenshot({ path:'dockshot.png' });
  await b.close();
})();
