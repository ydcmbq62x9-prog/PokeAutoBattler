const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:1 });
  const errs=[]; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(600);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.turn = 14;
    const ids = ['snorlax','lapras','charizard','mew','pikachu','gengar']; G.team = ids.map((id, i) => { const u = makeUnit(id, 2); u.pos = i; return u; }); fixSlots(G); render(); startBattle(); });
  await p.waitForTimeout(2500); await p.evaluate(() => { const b = document.querySelector('.bstage'); battle.paused = true; });
  const sets = [['bg-gym','fl-Water','#5a8ff0'],['bg-gym','fl-Fire','#f07830'],['bg-gym','fl-Electric','#f0c830'],['bg-gym','fl-Psychic','#f06090'],['bg-dusk','fl-dusk',''],['bg-league','fl-league',''],['bg-league','fl-Ice',''],['bg-gym','fl-Fighting','#c04830'],['bg-summit','fl-summit','']];
  let n = 0;
  for(const [bg, fl, c] of sets){
    await p.evaluate(([bg, fl, c]) => { const el = document.querySelector('.bstage'); el.className = el.className.replace(/\bbg-\S+/, bg).replace(/\bfl-\S+/, fl); if(c) el.style.setProperty('--gymc', c); }, [bg, fl, c]);
    await p.waitForTimeout(150); await (await p.$('.bstage')).screenshot({ path:`fl${n++}.png` });
  }
  console.log(errs); await b.close();
})();
