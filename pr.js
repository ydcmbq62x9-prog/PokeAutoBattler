const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const vp of [{width:393,height:740},{width:1250,height:900},{width:724,height:320}]){
  const p = await b.newPage({ viewport:vp });
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
  console.log(vp.width, await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); render();
    let worst = 0; for(const m of document.querySelectorAll('#world .slotmark')){ const a = m.getBoundingClientRect(), c = planeRect(m); worst = Math.max(worst, Math.abs(a.left-c.left), Math.abs(a.top-c.top), Math.abs(a.width-c.width), Math.abs(a.height-c.height)); } return worst.toFixed(2); }));
  await p.close(); }
  await b.close();
})();
