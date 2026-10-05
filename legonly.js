const E=require('./engine.js'),B=require('./botlib.js');
const gens=JSON.parse(process.argv[2]),only=process.argv[3],N=+process.argv[4]||400;
E.TUNING.legend.chance=1;
if(only!=='all') for(const k in E.SPECIES) if(E.SPECIES[k].legendary&&k!==only) E.SPECIES[k].legendary=false;
let c=0;for(let r=0;r<N;r++) if(B.playRun(r*11+5+7000,{reroll:true,bench:4,gens}).cleared) c++;
console.log(JSON.stringify(gens),only,(c/N*100).toFixed(1)+'%');
