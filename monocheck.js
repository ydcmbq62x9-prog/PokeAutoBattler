const E=require('./engine.js'),B=require('./botlib.js');
const gens=JSON.parse(process.argv[2]),N=+process.argv[3]||250;
const out=[];for(const t of E.monoTypesFor(gens)){let c=0;for(let r=0;r<N;r++) if(B.playRun(r*13+3+4000,{reroll:true,bench:4,gens,mods:{mono:t}}).cleared) c++;out.push(t+' '+(c/N*100).toFixed(0));}
console.log(JSON.stringify(gens),out.join(' | '));
