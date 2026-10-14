/* 5.7.0: compare triangles when a Daycare pokémon is picked, growth on the triangle, opponents by shape. */
const { chromium, devices } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const br = await chromium.launch();
  for(const [tag, dev] of [['phone', devices['iPhone 13']], ['wide', { viewport: { width: 1280, height: 860 } }]]){
    const ctx = await br.newContext(dev); await ctx.addInitScript(() => { window.PKB_TITLE = false; });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); G.credits = 30;
      G.team = ['charizard','pikachu','snorlax'].map((id,i)=>{const u=makeUnit(id,2); u.pos=i; return u;}); fixSlots(G); render();
      const o = { before: document.querySelectorAll('.pfield .stri .c').length };
      sel = { kind:'dc', idx:0 }; render(); o.during = document.querySelectorAll('.pfield .stri .c').length;
      sel = null; render(); o.after = document.querySelectorAll('.pfield .stri .c').length;
      G.team[0].atk += 5; render(); o.was = document.querySelectorAll('.pfield .stri .was').length;
      const d = document.createElement('div'); d.innerHTML = popupHtml(makeUnit('gengar', 2), true);
      o.enemyTri = !!d.querySelector('.etri .stri'); o.enemyBars = d.querySelectorAll('.sbar').length; o.enemyNums = /Attack \d/.test(d.innerHTML);
      d.innerHTML = popupHtml(makeUnit('gengar', 2)); o.mineBars = d.querySelectorAll('.sbar').length;
      return o; });
    check(r.before === 0 && r.during === 3 && r.after === 0, `${tag}: picking a Daycare pokémon shows its shape on every party triangle (${r.during})`);
    check(r.was === 1, `${tag}: a stat that grew shows the old shape fading on the triangle`);
    check(r.enemyTri && r.enemyBars === 0 && !r.enemyNums && r.mineBars === 3, `${tag}: opponents show a triangle with no numbers; yours keep the bars`);
    check(!errs.length, `${tag}: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  await br.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
