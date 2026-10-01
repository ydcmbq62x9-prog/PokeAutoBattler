const { chromium } = require('playwright');
const fs=require('fs');
(async () => {
  const b = await chromium.launch();
  for(const [name,w] of [['mock-wide',1000],['mock-phone',430]]){
    const p = await (await b.newContext({viewport:{width:w,height:1200},deviceScaleFactor:2})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL/.test(m.text()))errs.push(m.text())});
    await p.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">'
      + fs.readFileSync('artifact-mockup.html','utf8') + '</body></html>', {waitUntil:'networkidle'});
    await p.waitForTimeout(350);
    await p.screenshot({path:name+'.png', fullPage:true});
    const ov = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    // the storage panel must actually update
    const before = await p.evaluate(()=>document.querySelector('.sumname').textContent);
    await p.click('.cell[data-id="lapras"]').catch(()=>{});
    await p.waitForTimeout(120);
    const after = await p.evaluate(()=>document.querySelector('.sumname').textContent);
    console.log(name,'| overflow',ov,'| summary',before,'->',after,'| errors:',errs.length?errs:'none');
    await p.close();
  }
  await b.close();
})();
