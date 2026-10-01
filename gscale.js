const E=require('./engine.js'),B=require('./botlib.js');
const sc=+process.argv[2],N=+process.argv[3]||1500; E.TUNING.gauntletRatio.forEach((x,i)=>E.TUNING.gauntletRatio[i]=x*sc);
let c=0; for(let r=0;r<N;r++) if(B.playRun(r*7+1,{reroll:true,bench:4,mods:{}}).cleared) c++;
console.log(sc,(c/N*100).toFixed(1)+'%');
