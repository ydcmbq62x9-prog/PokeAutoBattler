const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
  const p = await b.newPage({viewport:{width:420,height:860}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.addInitScript(()=>{window.PKB_TITLE=true;});
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(1800);
  await p.screenshot({path:'/tmp/s1.png'});
  await p.click('.tpress'); await p.waitForTimeout(500);
  await p.screenshot({path:'/tmp/s2.png'});
  await p.click('[data-t="dex"]'); await p.waitForTimeout(500);
  await p.screenshot({path:'/tmp/s3.png'});
  await p.click('.dextile[data-id="noctowl"]'); await p.waitForTimeout(300);
  await p.screenshot({path:'/tmp/s4.png'});
  console.log('errors',errs);
  await b.close();
})();
