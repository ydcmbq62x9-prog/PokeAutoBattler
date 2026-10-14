const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p = await b.newPage({viewport:{width:420,height:860}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+String(e)+'\n'+(e.stack||''))); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(800);
  for(const gens of [[2],[1,2]]){
    await p.evaluate((gens)=>{ G=newGame(99,{gens}); rollShop(G,false); phase='shop';
      const u=makeUnit('tyrogue',0); u.pos=0; G.team=[u]; G.daycare[0]={unit:makeUnit('tyrogue',0),bought:false}; G.credits=30; render(); }, gens);
    await p.waitForTimeout(200);
    // click team slot, then daycare row
    for(const sel of ['.slot[data-i="0"]','.drow[data-i="0"]']){
      const t0=Date.now();
      await p.click(sel,{timeout:3000}).catch(e=>errs.push('click '+sel+' '+e.message.slice(0,80)));
      await p.waitForTimeout(300);
      const info = await p.evaluate(()=>({pop: !!document.querySelector('#pop,.pop,.popup')&&document.querySelector('#pop,.pop,.popup').textContent.slice(0,200), modal:document.querySelectorAll('.modal').length}));
      console.log(gens.join('+'),sel,Date.now()-t0+'ms',JSON.stringify(info));
    }
  }
  console.log('errors',errs.slice(0,6));
  await b.close();
})();
