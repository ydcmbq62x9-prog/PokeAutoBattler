const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; localStorage.setItem('pkb_prefs', JSON.stringify({ tutorial:'done' }));
    localStorage.setItem('pkb_records', JSON.stringify({ runs:12, cleared:5, best:20, hardcore:{count:2, first:'2026-10-01', last:'2026-10-04'},
      red:{count:1, first:'2026-10-02', last:'2026-10-02'}, chal:{ mono:{count:3, gold:1, types:['Fire','Water','Grass'], first:'2026-10-01', last:'2026-10-05'}, tight:{count:1, first:'2026-10-05', last:'2026-10-05'}, hardgyms:{count:1, gold:1, first:'2026-10-05', last:'2026-10-05'} } })); });
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(800);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); openNewRun(); });
  await p.waitForTimeout(200);
  await p.evaluate(() => { ['onelife','noitems','tight'].forEach(k => document.querySelector(`[data-mod="${k}"]`).click()); });
  const nr = await p.$('.modal.newrun'); await nr.evaluate(e => e.scrollTop = 99999);
  await p.screenshot({ path:'shot_newrun.png' });
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); openTrainerCard(); });
  await p.waitForTimeout(200);
  await p.click('[data-sb="mono"]'); await p.waitForTimeout(100);
  const tc = await p.$('.modal.trainer'); await tc.evaluate(e => { const s = e.querySelector('.sbinfo'); s.scrollIntoView({block:'end'}); });
  await p.screenshot({ path:'shot_trainer.png' });
  // end screen with awards
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ mods:{ onelife:true, noitems:true, tight:true } }); G.over = 'won'; G.badges = 8; phase = 'over'; noteRunEnd(); render(); });
  await p.waitForTimeout(300); await p.screenshot({ path:'shot_over.png' });
  await p.evaluate(() => { showTitle(); document.querySelector("[data-t=start]") && document.querySelector("[data-t=start]").click(); }).catch(e => errs.push('title fn: ' + e));
  await p.waitForTimeout(600); await p.screenshot({ path:'shot_title.png' });
  console.log('errs', errs);
  await b.close();
})();
