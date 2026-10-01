const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch(); const errs=[];
  const p = await b.newPage({viewport:{width:1100,height:1000}, deviceScaleFactor:1});
  p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('file://'+process.cwd()+'/shop-looks.html'); await p.waitForTimeout(700);
  await p.click('#A .spot[data-k="0"]'); await p.click('#B .spot[data-k="4"]'); await p.waitForTimeout(1500);
  await p.screenshot({path:'shots/looks-1.png', fullPage:false, clip:{x:0,y:120,width:1100,height:880}});
  await p.click('.bar[data-for="A"] [data-act="menu"]'); await p.click('.bar[data-for="B"] [data-act="trainer"]'); await p.click('.bar[data-for="B"] [data-act="menu"]'); await p.waitForTimeout(500);
  await p.screenshot({path:'shots/looks-2.png', clip:{x:0,y:120,width:1100,height:880}});
  await p.click('.bar[data-for="A"] [data-act="card"]'); await p.click('.bar[data-for="B"] [data-act="card"]'); await p.waitForTimeout(500);
  await p.screenshot({path:'shots/looks-3.png', clip:{x:0,y:120,width:1100,height:880}});
  const p2 = await b.newPage({viewport:{width:390,height:844}});
  await p2.goto('file://'+process.cwd()+'/shop-looks.html'); await p2.waitForTimeout(500);
  console.log('overflow', await p2.evaluate(()=>document.documentElement.scrollWidth));
  console.log(errs);
  await b.close();
})();
