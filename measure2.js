const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for(const w of [1100, 900, 430]){
    const p = await (await b.newContext({viewport:{width:w,height:1200}})).newPage();
    await p.goto(require('./pkbpaths').PAGE);
    await p.waitForTimeout(200);
    const bad = await p.evaluate(() => {
      const ids = Object.keys(SPECIES);
      const out = [];
      for(let start = 0; start < ids.length; start += 12){
        G.pc = ids.slice(start, start + 12).map(i => makeUnit(i, 0));
        render();
        document.querySelectorAll('.pcgrid .uname').forEach(el => {
          if(el.scrollWidth > el.clientWidth + 1) out.push(el.textContent + ' (' + el.scrollWidth + '>' + el.clientWidth + ')');
        });
      }
      return out;
    });
    console.log(w + 'px:', bad.length ? 'TRUNCATED -> ' + bad.slice(0,6).join(', ') : 'every name fits');
    await p.close();
  }
  await b.close();
})();
