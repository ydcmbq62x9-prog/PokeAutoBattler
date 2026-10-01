const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for(const [w,h,tag] of [[1250,1000,'wide'],[390,844,'phone']]){
    const p = await b.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:2 });
    const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(200);
    const j = await p.evaluate(() => { G.pendingRewards=[];
      const mk = id => { const u = makeUnit(id, 2); u.hp += 80; u.atk += 60; u.spd += 30; return u; };
      G.team = formationSort(['blastoise','clefable','charizard','butterfree','pidgeot','gengar'].map(mk));
      const E2 = formationSort(['snorlax','hypno','jigglypuff','raichu','vulpix','alakazam'].map(mk));
      const sim = simulateBattle(G.team, E2, 11);
      battle = { steps: sim.steps, i: 0, result: sim.result, oppName: 'Test', boss: null, kind: 'trainer',
        opp: { team: E2 }, sim, gauntlet: null, timer: null, exhibition: true };
      phase = 'battle';
      let best = 0, bi = 0;
      sim.steps.forEach((s, i) => { const n = [...s.p, ...s.e].filter(u => u.st).length + [...s.p, ...s.e].filter(u => u.shield).length; if(n > best){ best = n; bi = i; } });
      battle.i = bi; render(); return [bi, best, sim.steps.length];
    });
    await p.waitForTimeout(250);
    await p.screenshot({ path:`mv-${tag}-battle.png` });
    console.log(tag, j, errs.length ? errs : 'no errors');
    await p.close();
  }
  await b.close();
})();
