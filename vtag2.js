const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  await pg.goto(require('./pkbpaths').PAGE);
  await pg.click('[data-act="dc"][data-i="0"]'); await pg.click('[data-act="team"][data-i="0"]');
  await pg.click('[data-act="endturn"]'); await pg.waitForTimeout(300);
  console.log('battle:', await pg.$eval('.vtag', e => e.textContent));
  await pg.click('[data-act="skip"]'); await pg.click('[data-act="afterbattle"]'); await pg.waitForTimeout(300);
  await pg.click('[data-act="team"][data-i="0"]'); await pg.waitForTimeout(200);
  const r = await pg.evaluate(() => { window.scrollTo(0, 99999);
    const t = document.querySelector('.vtag').getBoundingClientRect(), c = document.querySelector('.ctxbar').getBoundingClientRect();
    return { tagBottom: t.bottom, barTop: c.top, overlap: t.bottom > c.top }; });
  console.log('phone with action bar:', JSON.stringify(r));
  await b.close();
})();
