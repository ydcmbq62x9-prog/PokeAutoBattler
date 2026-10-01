const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [name, vp, touch] of [['phone', {width:390,height:844}, true], ['desk', {width:1100,height:900}, false]]) {
    const pg = await b.newPage({ viewport: vp, hasTouch: touch, isMobile: touch });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('file:///mnt/user-data/outputs/pokebattler.html');
    await pg.waitForTimeout(400);
    const tag = await pg.$eval('.vtag', e => { const r = e.getBoundingClientRect(); return {t:e.textContent, y:r.bottom, doc:document.documentElement.scrollHeight, sw:document.documentElement.scrollWidth}; });
    console.log(name, JSON.stringify(tag), errs);
    await pg.evaluate(() => window.scrollTo(0, 99999));
    await pg.screenshot({ path: `vtag-${name}.png` });
    if (name === 'phone') { await pg.click('[data-act="menu"]'); await pg.waitForTimeout(200); await pg.screenshot({ path: 'vtag-menu.png' }); }
  }
  await b.close();
})();
