// node verifyf.js '[gens]' N foesMultiplier  — clear rate with an overridden gensFoes
const E=require('./engine.js'),B=require('./botlib.js');
const gens=JSON.parse(process.argv[2]),N=+process.argv[3],f=+process.argv[4];
E.TUNING.gensFoes[gens.join('+')]=f;let c=0;
for(let r=0;r<N;r++) if(B.playRun(r*11+5+5000,{reroll:true,bench:4,gens}).cleared) c++;
console.log(JSON.stringify(gens),f,(c/N*100).toFixed(1));
