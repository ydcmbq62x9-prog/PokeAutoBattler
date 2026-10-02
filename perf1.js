const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p = await b.newPage({viewport:{width:420,height:860}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(800);
  for(const gens of [[1],[1,2]]){
    const r = await p.evaluate((gens)=>{
      G = newGame(4242,{gens}); rollShop(G,false); phase='shop'; render();
      const t0=performance.now(); for(let i=0;i<20;i++) render(); const t1=performance.now();
      // give a party of 6 incl evolved
      const ids = gens.length>1?['golbat','onix','eevee','tyrogue','poliwhirl','gloom']:['pidgey','onix','eevee','poliwhirl','gloom','abra'];
      G.team = ids.map((id,i)=>{const u=makeUnit(id,0);u.pos=i;return u;}); G.pc=[]; render();
      const t2=performance.now(); for(let i=0;i<20;i++) render(); const t3=performance.now();
      return {gens:gens.join('+'), emptyRender:((t1-t0)/20).toFixed(1), fullRender:((t3-t2)/20).toFixed(1)};
    }, gens);
    console.log(JSON.stringify(r));
  }
  console.log('errors',errs);
  await b.close();
})();
