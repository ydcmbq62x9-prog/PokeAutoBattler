const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for(const [w,tag] of [[1100,'wide'],[430,'phone']]){
    const p = await b.newPage({ viewport:{width:w,height:1200}, deviceScaleFactor:2 });
    p.on('pageerror', e => errs.push(tag+' pageerror: '+e.message));
    p.on('console', m => { if(m.type()==='error' && !/fonts.g/.test(m.text()) && !/ERR_TUNNEL/.test(m.text())) errs.push(tag+' console: '+m.text()); });
    await p.goto('file://'+process.cwd()+'/artifact-bag.html');
    await p.waitForTimeout(600);
    // exercise the live demo
    if(tag==='wide'){
      await p.click('.bagpanel .bcell:first-child').catch(()=>{});
      await p.waitForTimeout(100);
      await p.click('.screen .form .pcard:nth-child(2)').catch(()=>{});
      await p.waitForTimeout(100);
    }
    const ow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if(ow) errs.push(tag+': horizontal overflow');
    await p.screenshot({ path:`bag-${tag}.png`, fullPage:true });
    await p.close();
  }
  await b.close();
  if(errs.length){ errs.forEach(e=>console.log('  - '+e)); process.exit(1); }
  console.log('mockup renders clean at both widths');
})();
