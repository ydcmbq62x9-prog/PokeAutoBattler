const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const [w,h,touch] of [[390,844,true],[1250,900,false],[844,390,true]]){
  const ctx = await b.newContext({ viewport:{ width:w, height:h }, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] });
    G.team = ['snorlax','pikachu'].map((id, i) => { const u = makeUnit(id, 1); u.pos = i; return u; }); fixSlots(G); render(); });
  const t = p.locator('[data-act="team"][data-i="0"]');
  if(touch) await t.tap(); else await t.click();
  await p.waitForTimeout(300);
  const info = await p.evaluate(() => { const r = document.querySelector('[data-act="sell"]'); if(!r) return 'no button, sel=' + JSON.stringify(sel); const q = r.getBoundingClientRect(); const e = document.elementFromPoint(q.left + q.width/2, q.top + q.height/2);
    return JSON.stringify({ q:[q.left|0,q.top|0,q.width|0,q.height|0], hit: e && e.className, vis: getComputedStyle(r).visibility, pe: getComputedStyle(r).pointerEvents }); });
  console.log(w, info);
  const r = p.locator('[data-act="sell"]');
  try{ if(touch) await r.tap({ timeout: 3000 }); else await r.click({ timeout: 3000 }); }catch(e){ console.log('click fail', e.message.split('\n')[0]); }
  await p.waitForTimeout(300);
  console.log(w, 'team now', await p.evaluate(() => G.team.length));
  await ctx.close(); }
  await b.close();
})();
