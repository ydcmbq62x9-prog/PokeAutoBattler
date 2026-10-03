// node monotune.js '[gens]' N target  — re-tunes the Mono foe factor of every Mono type for these gens
const E=require('./engine.js'),B=require('./botlib.js');
const gens=JSON.parse(process.argv[2]),N=+process.argv[3]||120,target=+process.argv[4]||75,gk=gens.join('+');
const M=E.TUNING.mods; const tbl=gk==='1'?M.monoFoes:(M.monoFoesByGens[gk]=M.monoFoesByGens[gk]||{});
const types=E.monoTypesFor(gens);
const rate=t=>{let c=0;for(let r=0;r<N;r++) if(B.playRun(r*7+1,{reroll:true,bench:4,gens,mods:{mono:t}}).cleared) c++;return c/N*100;};
const out={};
for(const t of types){ let f=tbl[t]||1, best=null;
  for(let it=0;it<4;it++){ tbl[t]=f; const r=rate(t); if(!best||Math.abs(r-target)<Math.abs(best.r-target)) best={f,r};
    if(Math.abs(r-target)<=4) break;
    f=Math.max(0.5,Math.min(1.5,f+(r-target)/420)); }
  out[t]=+best.f.toFixed(3); tbl[t]=out[t];
  console.log(gk,t,'factor',out[t],'rate',best.r.toFixed(0)); }
console.log('RESULT',gk,JSON.stringify(out));
