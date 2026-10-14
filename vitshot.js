const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport:{width:1100,height:900} });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(require('./pkbpaths').PAGE); await pg.waitForTimeout(300);
  await pg.evaluate(() => { G.team = [makeUnit('raichu',0)]; G.team[0].vit = { protein:10, carbos:4 }; save(); render(); });
  await pg.hover('[data-pop="team:0"]'); await pg.waitForTimeout(200);
  const t = await pg.$eval('.popup .popvit', e => e.textContent.replace(/\s+/g,' '));
  console.log(t, errs);
  await pg.screenshot({ path:'shot-vit.png' });
  await b.close();
})();
