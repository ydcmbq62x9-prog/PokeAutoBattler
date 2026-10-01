const { chromium } = require('playwright');
const fs=require('fs');
(async () => {
  const b = await chromium.launch();
  for(const [name,scheme,w] of [['ref-light','light',900],['ref-dark','dark',430]]){
    const p = await (await b.newContext({viewport:{width:w,height:1100},colorScheme:scheme,deviceScaleFactor:2})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
    await p.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">'
      + fs.readFileSync('artifact-reference.html','utf8') + '</body></html>', {waitUntil:'networkidle'});
    await p.waitForTimeout(400);
    await p.screenshot({path:name+'.png'});
    const ov = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    await p.fill('#q','thunder'); await p.waitForTimeout(150);
    const shown = await p.evaluate(()=>[...document.querySelectorAll('.fam')].filter(f=>!f.hidden).length);
    await p.fill('#q',''); await p.click('.filt[data-t="Fire"]'); await p.waitForTimeout(150);
    const fire = await p.evaluate(()=>[...document.querySelectorAll('.fam')].filter(f=>!f.hidden).length);
    console.log(name, '| overflow', ov, '| "thunder" ->', shown, 'fams | Fire ->', fire, '| errors:', errs.length?errs:'none');
    await p.close();
  }
  await b.close();
})();
