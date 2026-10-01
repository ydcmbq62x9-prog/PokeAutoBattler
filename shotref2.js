const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p = await b.newPage({viewport:{width:900,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+process.cwd()+'/artifact-reference.html'); await p.waitForTimeout(800);
  const h = await p.evaluate(()=>{ const x=[...document.querySelectorAll('h2')].find(e=>/^Generations/.test(e.textContent)); x.scrollIntoView(); return x.getBoundingClientRect().top; });
  await p.screenshot({path:'/tmp/ref1.png'});
  console.log('errs',errs);
  await b.close();
})();
