const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p = await b.newPage({viewport:{width:420,height:860}});
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(800);
  const c = await p.context().newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate',{rate:6});
  const r = await p.evaluate(async()=>{
    const out={}; const T=(k,f)=>{const t=performance.now(); const r=f(); out[k]=+(performance.now()-t).toFixed(0); return r;};
    G=newGame(31,{gens:[1,2]}); rollShop(G,false); phase='shop'; render();
    out.gsize=JSON.stringify(G).length;
    T('stringify',()=>{ for(let i=0;i<10;i++) JSON.stringify(G); });
    T('save',()=>{ for(let i=0;i<10;i++) save(); });
    T('render',()=>{ for(let i=0;i<10;i++) render(); });
    T('openDex',()=>{ openDex(); });
    document.querySelectorAll('.modal').forEach(m=>m.remove());
    T('openNewRun',()=>{ openNewRun(()=>{}); }); document.querySelectorAll('.modal').forEach(m=>m.remove());
    T('openTrainer',()=>{ openTrainerCard(false); }); document.querySelectorAll('.modal').forEach(m=>m.remove());
    return out;
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
