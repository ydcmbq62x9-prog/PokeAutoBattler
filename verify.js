const E=require('./engine.js'),B=require('./botlib.js');
const m=JSON.parse(process.argv[2]),N=+process.argv[3]||800;let c=0;
for(let r=0;r<N;r++) if(B.playRun(r*7+1,{reroll:true,bench:4,mods:m}).cleared) c++;
console.log(process.argv[2],(c/N*100).toFixed(1)+'%');
