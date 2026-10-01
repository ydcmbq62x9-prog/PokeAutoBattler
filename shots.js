const { chromium } = require('playwright');
const setup = `
    G = newGame(7); G.turn = 9; G.credits = 14; G.trophies = 5; G.lives = 3;
    G.streak = 3; G.lastResult = 'win';
    G.team = [
      (()=>{const u=makeUnit('onix',0); u.hp+=22; u.exp=2; return u;})(),
      makeUnit('golem',2), makeUnit('charmeleon',2),
      (()=>{const u=makeUnit('pikachu',0); u.tmpAtk=11; return u;})(),
      makeUnit('kadabra',2), makeUnit('staryu',0),
    ];
    rollShop(G, false);
    G.pc = ['charmeleon','charmander','machop','staryu','pidgeotto','gastly','magikarp']
      .map(i=>makeUnit(i,0));
    G.daycare[0] = { unit: makeUnit('squirtle',0), bought:false };
    G.daycare[1] = { unit: makeUnit('machop',0), bought:false };
    G.mart[0] = { id:'thunderstone', reserved:false, bought:false };
    G.mart[1] = { id:'candy', reserved:true, bought:false };
    inspect = null; sel = null; phase='shop'; render();`;
(async () => {
  const b = await chromium.launch();
  for(const [name,w,h] of [['v5-phone',430,1400], ['v5-wide',1100,1100]]){
    const p = await (await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,
      hasTouch: w < 700, isMobile: w < 700})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
    await p.goto('file:///mnt/user-data/outputs/pokebattler.html');
    await p.waitForTimeout(250);
    await p.evaluate(setup);
    await p.waitForTimeout(120);
    if(w >= 700){ await p.hover('.wall .cell[data-pop]'); await p.waitForTimeout(200); }
    else { await p.click('.wall .cell[data-pop]'); await p.waitForTimeout(200); }
    await p.screenshot({path:name+'.png'});
    const ov = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    const pop = await p.evaluate(()=>{const e=document.querySelector('.popup'); return e && !e.hidden;});
    console.log(name,'| overflow',ov,'| popup',pop,'| errors:',errs.length?errs:'none');
    await p.close();
  }
  await b.close();
})();
