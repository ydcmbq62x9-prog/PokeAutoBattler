const E=require('./engine.js'),B=require('./botlib.js');
const gens=JSON.parse(process.argv[2]),mods=JSON.parse(process.argv[3]||'{}'),N=+process.argv[4]||300;let c=0;
for(let r=0;r<N;r++) if(B.playRun(r*11+5+9000,{reroll:true,bench:mods.nopc?0:4,gens,mods}).cleared) c++;
console.log(JSON.stringify(gens),JSON.stringify(mods),(c/N*100).toFixed(1)+'%');
