const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [name, vp, scheme] of [['desk', {width:1100,height:900}, 'light'], ['phone', {width:390,height:844}, 'dark']]) {
    const pg = await b.newPage({ viewport: vp, colorScheme: scheme });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('file://' + process.cwd() + '/artifact-reference.html');
    await pg.waitForTimeout(500);
    const ov = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(name, 'overflow', ov, errs);
    for (const h of ['The run', 'Battle counter — next battle only', 'The numbers']) {
      const el = await pg.locator('h2', { hasText: h }).first();
      await el.scrollIntoViewIfNeeded();
      await pg.evaluate(t => { const e=[...document.querySelectorAll('h2')].find(x=>x.textContent.startsWith(t)); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 10); }, h);
      await pg.screenshot({ path: `ref-${name}-${h.split(' ')[0]}${h.split(' ')[1]||''}.png` });
    }
  }
  await b.close();
})();
