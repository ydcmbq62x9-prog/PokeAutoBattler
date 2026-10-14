const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p = await b.newPage({viewport:{width:390,height:844}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(800);
  await p.evaluate(()=>{ G=newGame(31,{gens:[1,2]}); rollShop(G,false); phase='shop';
    const ids=['tyrogue','golbat','gloom']; G.team=ids.map((id,i)=>{const u=makeUnit(id,0);u.pos=i;return u;});
    G.focus=G.focus; render(); });
  await p.waitForTimeout(400);
  await p.screenshot({path:'/tmp/u1.png',fullPage:true});
  await p.click('.slot[data-i="0"]'); await p.waitForTimeout(2600);
  await p.screenshot({path:'/tmp/u2.png'});
  await p.evaluate(()=>{ openNewRun(()=>{}); }); await p.waitForTimeout(300);
  await p.screenshot({path:'/tmp/u3.png'});
  console.log('errors',errs);
  await b.close();
})();
