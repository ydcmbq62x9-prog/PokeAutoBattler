const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const p = await b.newPage({ viewport:{width:1100,height:1000}, deviceScaleFactor:2 });
  p.on('pageerror', e => errs.push('pageerror: '+e.message));
  p.on('console', m => { if(m.type()==='error' && !/fonts|ERR_TUNNEL/.test(m.text())) errs.push('console: '+m.text()); });
  await p.goto('file://'+process.cwd()+'/artifact-reference.html');
  await p.waitForTimeout(500);
  // the search filter must still work (it broke once before on a class collision)
  await p.fill('#q', 'pikachu'); await p.waitForTimeout(250);
  const shown = await p.$$eval('#fams > section:not([hidden])', e => e.length);
  if(shown < 1 || shown > 3) errs.push('search returned '+shown+' families for "pikachu"');
  await p.fill('#q', ''); await p.waitForTimeout(200);
  const held = await p.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find(x => /Held items/.test(x.textContent));
    if(!h) return null;
    const tbl = h.parentElement.querySelector('h2 ~ .scroller table') ||
                h.nextElementSibling.nextElementSibling.querySelector('table');
    return tbl ? tbl.querySelectorAll('tbody tr').length : null;
  });
  if(!held) errs.push('no held-item table on the reference page');
  const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if(over) errs.push('horizontal overflow');
  const y = await p.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find(x => /Held items/.test(x.textContent));
    return h ? h.getBoundingClientRect().top + window.scrollY : 0;
  });
  await p.evaluate(v => window.scrollTo(0, v - 20), y);
  await p.waitForTimeout(300);
  await p.screenshot({ path:'ref-held.png' });
  await b.close();
  if(errs.length){ errs.forEach(e=>console.log('  - '+e)); process.exit(1); }
  console.log('reference page ok, held rows:', held);
})();
