const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport:{width:1100,height:1000} });
  await pg.goto('file://' + process.cwd() + '/artifact-reference.html');
  await pg.evaluate(() => { const e=[...document.querySelectorAll('h2')].find(x=>x.textContent.startsWith('The run')); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 10); });
  await pg.screenshot({ path:'ref-run-v25.png' });
  await pg.evaluate(() => { const e=[...document.querySelectorAll('h2')].find(x=>x.textContent.startsWith('Badge rewards')); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 10); });
  await pg.screenshot({ path:'ref-rewards-v25.png' });
  await b.close();
})();
