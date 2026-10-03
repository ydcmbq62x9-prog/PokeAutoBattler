// node monoprobe2.js '[gens]' N Type[,Type...]  — mono clear rate per type with current factors
const E=require('./engine.js'),B=require('./botlib.js');
const gens=JSON.parse(process.argv[2]),N=+process.argv[3],types=process.argv[4].split(',');
const out={};
for(const t of types){let c=0;for(let r=0;r<N;r++) if(B.playRun(r*7+1,{reroll:true,bench:4,gens,mods:{mono:t}}).cleared) c++;out[t]=Math.round(c/N*100);}
console.log(JSON.stringify(gens),JSON.stringify(out));
