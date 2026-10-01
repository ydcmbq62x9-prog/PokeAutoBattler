const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for(const [w,h,tag] of [[1250,1000,'wide'],[390,844,'phone']]){
    const p = await b.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:2 });
    const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(200);
    await p.evaluate(() => { localStorage.setItem('pkb_seen_version','v30'); G.pendingRewards=[]; render(); });
    const dot1 = !!(await p.$('.menudot'));
    await p.click('[data-act="menu"]'); await p.waitForTimeout(200);
    await p.screenshot({ path:`news-${tag}-menu.png` });
    await p.click('[data-m="news"]'); await p.waitForTimeout(250);
    await p.screenshot({ path:`news-${tag}.png` });
    const open = await p.$$eval('.clog details[open]', e => e.map(x => x.querySelector('summary b').textContent));
    await p.click('.modal [data-m="close"]'); await p.waitForTimeout(150);
    const dot2 = !!(await p.$('.menudot'));
    const sw = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    console.log(tag, errs.length?errs:'ok', 'dot before', dot1, 'after', dot2, 'open', open.join(','), 'noscroll', sw);
    await p.close();
  }
  await b.close();
})();
