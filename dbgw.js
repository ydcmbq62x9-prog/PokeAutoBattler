const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:1250, height:900 } });
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(600);
  console.log(await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); render();
    const o = {}; for(const s of ['.pfield','.pfield .formation','.panel.party','.pfield .slot']){ const e=document.querySelector(s); const c=getComputedStyle(e); o[s]=[e.getBoundingClientRect().width, c.maxWidth, c.gridTemplateColumns, c.width]; } return JSON.stringify(o,null,1); }));
  await b.close();
})();
