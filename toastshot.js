const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for(const [nm,dark] of [['light',false],['dark',true]]){
  const p = await (await b.newContext({...devices['iPhone 13'], colorScheme: dark?'dark':'light'})).newPage();
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(300);
  await p.evaluate(() => { G.credits=0; rollShop(G,false); save(); render(); });
  const h0 = await p.evaluate(()=>document.documentElement.scrollHeight);
  await p.tap('.drow'); await p.waitForTimeout(150);
  const buy = await p.$('[data-act="buy"], .btn.buy'); 
  await p.evaluate(()=>say("Not enough ₽ — you need 3₽."));
  await p.waitForTimeout(300);
  const h1 = await p.evaluate(()=>({h:document.documentElement.scrollHeight, t:document.querySelector('.toastbox')?.textContent, insp: document.querySelector('#inspect').textContent.slice(0,40)}));
  console.log(nm, h0, JSON.stringify(h1));
  await p.screenshot({path:`toast-${nm}.png`, clip:{x:0,y:0,width:390,height:160}});
  await p.waitForTimeout(2000);
  console.log('after', await p.evaluate(()=>!!document.querySelector('.toastbox')));
  }
  await b.close();
})();
