const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p = await b.newPage({viewport:{width:420,height:860}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(800);
  const r = await p.evaluate(()=>{
    const out={};
    const T=(k,f)=>{const t=performance.now(); f(); out[k]=+(performance.now()-t).toFixed(1);};
    G = newGame(4242,{gens:[1,2]}); rollShop(G,false); phase='shop'; render();
    T('openDex',()=>{ openDex(); document.querySelectorAll('.modal').forEach(m=>m.remove()); });
    T('openDex2',()=>{ openDex(); document.querySelectorAll('.modal').forEach(m=>m.remove()); });
    T('rollShop',()=>{ for(let i=0;i<10;i++) rollShop(G,false); });
    G.team=['golbat','onix','eevee','tyrogue','poliwhirl','gloom'].map((id,i)=>{const u=makeUnit(id,0);u.pos=i;return u;}); render();
    T('render',()=>{ for(let i=0;i<10;i++) render(); });
    return out;
  });
  console.log(JSON.stringify(r)); console.log('errors',errs);
  await b.close();
})();
