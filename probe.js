const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:844}});
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(400);
  await p.evaluate(()=>{ phase='battle'; });
  const r = await p.evaluate(()=>{ const out=[]; for(const x of [195]) for(const y of [835,840,843]){ const el=document.elementFromPoint(x,y); out.push(y+': '+(el? el.tagName+'.'+el.className+' '+(el.id||''):'none')); } return out; });
  console.log(r);
  const r2 = await p.evaluate(()=>[...document.body.children].map(e=>e.tagName+'.'+e.className+' hidden='+e.hidden+' '+JSON.stringify(e.getBoundingClientRect())));
  console.log(r2.join('\n'));
  await b.close();
})();
