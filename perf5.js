const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p = await b.newPage({viewport:{width:420,height:860}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(800);
  const c = await p.context().newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate',{rate:6});
  for(const gens of [[1],[1,2]]){
    const r = await p.evaluate(async(gens)=>{
      window.__lt=[]; try{ new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lt.push(Math.round(e.duration)))).observe({entryTypes:['longtask']}); }catch(e){}
      G=newGame(31,{gens}); rollShop(G,false); phase='shop';
      G.team=E_ids(gens).map((id,i)=>{const u=makeUnit(id,0);u.pos=i;return u;}); render();
      const t=performance.now(); await startBattle(); const dt=performance.now()-t;
      return {gens:gens.join('+'), total:Math.round(dt), longtasks:window.__lt.slice(0,12), phase};
      function E_ids(g){ return BUYABLE.filter(k=>SPECIES[k].tier<=2).slice(0,6); }
    }, gens);
    console.log(JSON.stringify(r));
  }
  console.log('errors',errs.slice(0,3));
  await b.close();
})();
