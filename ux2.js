const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p = await b.newPage({viewport:{width:390,height:844}});
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(800);
  await p.evaluate(()=>{ G=newGame(31,{gens:[1,2]}); rollShop(G,false); phase='shop';
    G.team=['tyrogue','golbat','gloom'].map((id,i)=>{const u=makeUnit(id,0);u.pos=i;return u;}); render(); });
  await p.click('.slot[data-i="0"]'); await p.waitForTimeout(500);
  console.log(await p.evaluate(()=>[...document.body.querySelectorAll('*')].filter(e=>e.children.length<4&&/^Tyrogue/.test(e.textContent.trim())&&e.getBoundingClientRect().left>250).map(e=>e.tagName+'.'+e.className+' parent:'+e.parentElement.className+' '+JSON.stringify(e.getBoundingClientRect())).slice(0,4)));
  console.log(await p.evaluate(()=>{ const e=document.elementFromPoint(360,355); let x=e; const chain=[]; while(x&&x!==document.body&&chain.length<5){chain.push(x.tagName+'.'+x.className+'#'+x.id); x=x.parentElement;} return chain.join(' < '); }));
  await b.close();
})();
