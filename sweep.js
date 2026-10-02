const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p = await b.newPage({viewport:{width:420,height:860}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+String(e))); 
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(800);
  const res = await p.evaluate(()=>{
    const bad=[]; let n=0;
    for(const gens of [[1],[2],[1,2]]){
      G=newGame(5,{gens}); rollShop(G,false); phase='shop';
      for(const id of Object.keys(SPECIES)){
        if(!inGens(id,gens) && !SPECIES[id].legendary) continue;
        try{
          const u=makeUnit(id,0); u.pos=0; G.team=[u]; G.daycare[0]={unit:makeUnit(id,0),bought:false};
          render(); popupHtml(u); n++;
          // also the dex-ish helper
          evoLineHtml(id);
        }catch(e){ bad.push(gens.join('+')+':'+id+' '+e.message); }
      }
    }
    return {n,bad};
  });
  console.log(JSON.stringify(res)); console.log('pageerrors',errs.slice(0,5));
  await b.close();
})();
