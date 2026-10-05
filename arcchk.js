const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:1250, height:850 } });
  const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.turn = 14;
    const ids = ['charizard','lapras','venusaur','mew','pikachu','gengar']; G.team = ids.map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); fixSlots(G); render(); startBattle();
    window.__seen = { shot:0, arc:0, pt:new Set() };
    new MutationObserver(ms => { for(const m of ms) for(const n of m.addedNodes){ if(!n.classList) continue;
      if(n.classList.contains('shot')){ __seen.shot++; const k = n.getAnimations()[0]; if(k){ const f = k.effect.getKeyframes(); if(f.length > 5) __seen.arc++; } }
      if(n.classList.contains('pt')) __seen.pt.add([...n.classList].filter(c => c !== 'fx' && c !== 'pt').join()); } }).observe(document.body, { subtree:true, childList:true }); });
  await p.waitForTimeout(12000);
  console.log(await p.evaluate(() => JSON.stringify({ shot: __seen.shot, arc: __seen.arc, pt: [...__seen.pt] })), errs);
  await b.close();
})();
