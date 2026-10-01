const E=require('./engine.js');
E.GYMS.forEach((b,i)=>{ const badges=i; const names={}; let n=0;
  for(let seed=1;seed<=200;seed++){ const turn=4+i*3.4|0; const t=E.generateAiTeam({turn:Math.round(6+i*3.6)+(seed%3),seed,badges,boss:b,kind:'gym',tier:Math.min(6,1+Math.floor(i*0.7)+1)});
    for(const u of t.team){ names[u.id]=(names[u.id]||0)+1; n++; } }
  const pool=E.themePool(b); const guardSet=new Set(b.guards||[]);
  const off=Object.keys(names).filter(k=>!pool.includes(k));
  console.log(b.name.padEnd(9), 'off-theme seen:', off.map(k=>k+names[k]).join(' ')||'-'); });
