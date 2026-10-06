const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:390, height:844 } });
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(800);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); render(); openTrainerCard(); });
  await p.waitForTimeout(2000);
  console.log(await p.evaluate(() => { const bx = document.querySelector('.modal .box'); const out=[]; let e=document.querySelector('.tcard .facts'); while(e && e!==document.body){ const c=getComputedStyle(e); out.push(e.className+' bg='+c.backgroundColor+' op='+c.opacity+' bf='+c.backdropFilter); e=e.parentElement;} return out.join('\n'); }));
  await p.screenshot({ path:'tc2.png', clip:{x:0,y:0,width:390,height:300} });
  await b.close();
})();
