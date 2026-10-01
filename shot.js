const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:390,height:800} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(500);
  await p.evaluate(()=>{ openHelp(); });
  await p.waitForTimeout(300);
  await p.evaluate(()=>{ const t=document.querySelector('.tchart'); if(t) t.scrollIntoView(); });
  await p.screenshot({path:'help.png'});
  await p.evaluate(()=>{ document.querySelectorAll('.modal').forEach(m=>m.remove()); openNewRun && openNewRun(); });
  await p.waitForTimeout(300); await p.screenshot({path:'newrun.png'});
  console.log('errors',errs);
  await b.close();
})();
