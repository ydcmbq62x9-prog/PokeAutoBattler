const E=require('./engine.js');
for(const b of E.ELITE_FOUR){ let un=0,tot=0,sz=0; const names={};
  for(let seed=1;seed<=200;seed++){ const t=E.generateAiTeam({turn:26+(seed%8),seed,badges:8,boss:b,kind:'elite',tier:6,size:6});
    sz+=t.team.length; for(const u of t.team){ tot++; if(E.evoNext(u.id).length) un++; names[u.id]=(names[u.id]||0)+1; } }
  console.log(b.name,'unevolved',un,'/',tot,'avg size',(sz/200).toFixed(1),Object.entries(names).sort((a,c)=>c[1]-a[1]).map(e=>e[0]+e[1]).join(' ')); }
