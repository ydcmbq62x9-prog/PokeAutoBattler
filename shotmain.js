const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch();
  for (const [w,h,tag] of [[390,844,'phone'],[1250,900,'wide']]){
    const p = await b.newPage({viewport:{width:w,height:h}, deviceScaleFactor:2});
    await p.goto('file:///mnt/user-data/outputs/pokebattler.html');
    await p.waitForTimeout(800);
    await p.screenshot({path:`shots/main-${tag}.png`, fullPage:true});
    await p.click('[data-a="menu"], .menubtn, button:has-text("☰")').catch(e=>console.log('menu click fail', e.message));
    await p.waitForTimeout(400);
    await p.screenshot({path:`shots/menu-${tag}.png`});
    await p.close();
  }
  await b.close();
})();
