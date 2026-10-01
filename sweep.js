const fs=require('fs');
const src=fs.readFileSync('engine.js','utf8');
function build(diff, sizeExpr, lvlChance){
  const mod={exports:{}};
  let t=src.replace(/const AI_DIFFICULTY = [\d.]+;/, `const AI_DIFFICULTY = ${diff};`);
  t=t.replace(/const size = Math\.max\(1, Math\.min\(TUNING\.maxTeam, [^;]+\);/,
              `const size = Math.max(1, Math.min(TUNING.maxTeam, ${sizeExpr}));`);
  if(lvlChance) t=t.replace(/rnd\(\) < 0\.35\) exp = TUNING\.expForLevel2/, `rnd() < ${lvlChance[0]}) exp = TUNING.expForLevel2`)
                   .replace(/rnd\(\) < 0\.22\) exp = TUNING\.expForLevel3/, `rnd() < ${lvlChance[1]}) exp = TUNING.expForLevel3`);
  new Function('module','exports',t)(mod,mod.exports);
  return mod.exports;
}
function run(E, n){
  let w=0,l=0,d=0,b=0,cleared=0,maxS=0,turns=0;
  for(let run=0;run<n;run++){
    const G=E.newGame(run+1); E.rollShop(G,false); let g=0;
    while(!G.over && g++<60){
      for(let i=0;i<G.daycare.length;i++){
        if(G.credits<E.TUNING.costBuy) break;
        const s=G.daycare[i]; if(!s||s.bought) continue;
        const dup=G.team.findIndex(u=>u.id===s.unit.id&&E.unitLevel(u)<3);
        const slot=dup>=0?dup:G.team.length;
        if(dup<0&&G.team.length>=E.TUNING.maxTeam) continue;
        E.buyPokemon(G,i,slot);
      }
      for(let i=0;i<G.mart.length;i++){
        const s=G.mart[i]; if(!s||s.bought||!G.team.length) continue;
        if(G.credits<E.ITEMS[s.id].cost) continue;
        const ok=G.team.findIndex(u=>E.canUseItem(s.id,u)); if(ok>=0) E.buyItem(G,i,ok);
      }
      if(G.credits>=6&&G.team.length) E.buyBattleItem(G,0,0);
      G.team.sort((a,b)=>b.hp-a.hp);
      const opp=E.generateAiTeam(G.turn,G.seed);
      const r=E.simulateBattle(G.team,opp.team,G.seed+G.turn);
      maxS=Math.max(maxS,r.steps.length);
      if(r.result==='win')w++; else if(r.result==='lose')l++; else d++;
      E.applyBattleResult(G,r.result); b++;
      if(G.over) break;
      E.nextTurn(G);
    }
    if(G.over==='won') cleared++;
    turns+=G.turn;
  }
  return {w,l,d,b,cleared,maxS,turns};
}
const sizes = {
  'slow  floor(t/2)+1': 'Math.floor(turn / 2) + 1 + (rnd() < 0.35 ? 1 : 0)',
  'med   floor(t/1.6)+1': 'Math.floor(turn / 1.6) + 1 + (rnd() < 0.35 ? 1 : 0)',
  'fast  floor(t/1.2)+1': 'Math.floor(turn / 1.2) + 1 + (rnd() < 0.35 ? 1 : 0)',
};
for(const [label, expr] of Object.entries(sizes)){
  for(const diff of [0.45, 0.65, 0.85]){
    const E=build(diff, expr, [0.45,0.3]);
    const r=run(E,150);
    console.log(`${label} | diff ${diff}: win ${(r.w/r.b*100).toFixed(1)}%  cleared ${r.cleared}/150  avg run ${(r.turns/150).toFixed(1)}t  maxSteps ${r.maxS}`);
  }
}
