const E=require('./engine.js'),B=require('./botlib.js');
for(const gens of [[1],[2],[1,2]]){
  const G=E.newGame(777,{gens}); E.rollShop(G,false);
  const t={}; let n=0;
  const T=(k,f)=>{const s=process.hrtime.bigint();const r=f();t[k]=(t[k]||0)+Number(process.hrtime.bigint()-s)/1e6;return r;};
  let guard=0;
  while(!G.over&&guard++<60){
    T('shop',()=>B.shop(G,{reroll:true,bench:4}));
    T('fight',()=>B.fight(G)); n++;
    if(G.over)break; T('nextTurn',()=>E.nextTurn(G));
  }
  console.log(gens.join('+'),'turns',n,Object.entries(t).map(([k,v])=>k+' '+(v/n).toFixed(1)+'ms/turn').join('  '));
}
// micro: hot helpers
for(const gens of [[1],[1,2]]){ E.setActiveGens(gens);
  let s=process.hrtime.bigint(); for(let i=0;i<2000;i++) E.evoParent('pikachu'); console.log(gens.join('+'),'evoParent x2000',(Number(process.hrtime.bigint()-s)/1e6).toFixed(1)+'ms');
  s=process.hrtime.bigint(); for(let i=0;i<2000;i++) E.evoLine('raichu'); console.log('evoLine x2000',(Number(process.hrtime.bigint()-s)/1e6).toFixed(1)+'ms');
  s=process.hrtime.bigint(); for(let i=0;i<200;i++) E.themePool(E.EVERY_BOSS[3]); console.log('themePool x200',(Number(process.hrtime.bigint()-s)/1e6).toFixed(1)+'ms'); }
