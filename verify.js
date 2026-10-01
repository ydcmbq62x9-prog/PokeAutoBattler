const E=require('./engine.js'),B=require('./botlib.js');
const gens=JSON.parse(process.argv[2]),N=+process.argv[3];let c=0;
for(let r=0;r<N;r++) if(B.playRun(r*11+5+5000,{reroll:true,bench:4,gens}).cleared) c++;
console.log(JSON.stringify(gens),(c/N*100).toFixed(1));
