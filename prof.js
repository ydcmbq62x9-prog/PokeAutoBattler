const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p = await b.newPage({viewport:{width:420,height:860}});
  await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(800);
  const c = await p.context().newCDPSession(p);
  await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval',{interval:200});
  await p.evaluate(()=>{ G=newGame(31,{gens:[1,2]}); rollShop(G,false); G.badges=5; G.turn=14; rollShop(G,false); phase='shop';
    G.team=['golbat','onix','eevee','tyrogue','poliwhirl','gloom'].map((id,i)=>{const u=makeUnit(id,0);u.pos=i;return u;});
    G.pc=['scyther','chansey','seadra','pichu','cleffa','togepi'].filter(id=>SPECIES[id]).map(id=>makeUnit(id,0)); G.bag=['band','coat'];
    G.credits=50; render(); });
  await c.send('Profiler.start');
  await p.evaluate(()=>{ for(let i=0;i<150;i++){ render(); } for(let i=0;i<5;i++){ rollShop(G,false); render(); } });
  const {profile} = await c.send('Profiler.stop');
  const self={}; const dt=profile.timeDeltas; const idIdx={}; profile.nodes.forEach(n=>idIdx[n.id]=n);
  profile.samples.forEach((id,i)=>{const n=idIdx[id]; const k=n.callFrame.functionName+':'+n.callFrame.lineNumber; self[k]=(self[k]||0)+dt[i]/1000;});
  console.log(Object.entries(self).sort((a,b)=>b[1]-a[1]).slice(0,14).map(([k,v])=>k+' '+v.toFixed(0)+'ms').join('\n'));
  await b.close();
})();
