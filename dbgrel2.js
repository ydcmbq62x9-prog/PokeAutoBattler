const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const [w,h,touch] of [[720,800,false],[900,700,false],[1000,650,false],[1100,600,false],[768,1024,true],[1024,768,true],[1366,700,false],[430,932,true]]){
  const ctx = await b.newContext({ viewport:{ width:w, height:h }, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] });
    G.team = ['snorlax','pikachu','charmander','squirtle'].map((id, i) => { const u = makeUnit(id, 1); u.pos = i; return u; }); G.team[0].held = 'claw'; fixSlots(G); render(); });
  const t = p.locator('[data-act="team"][data-i="0"]');
  try{ if(touch) await t.tap({timeout:3000}); else await t.click({timeout:3000}); }catch(e){ console.log(w,h,'slot click fail', e.message.split('\n')[0]); }
  await p.waitForTimeout(900);
  const info = await p.evaluate(() => { const r = document.querySelector('[data-act="sell"]'); if(!r) return 'no button, sel=' + JSON.stringify(sel); const q = r.getBoundingClientRect(); const e = document.elementFromPoint(q.left + q.width/2, q.top + q.height/2);
    return JSON.stringify({ q:[q.left|0,q.top|0,q.width|0,q.height|0], vh: innerHeight, hit: e && e.className }); });
  const r = p.locator('[data-act="sell"]');
  try{ if(touch) await r.tap({ timeout: 3000 }); else await r.click({ timeout: 3000 }); }catch(e){ console.log(w,h,'click fail', e.message.split('\n')[0]); }
  await p.waitForTimeout(300);
  console.log(w, h, info, 'team now', await p.evaluate(() => G.team.length));
  await ctx.close(); }
  await b.close();
})();
