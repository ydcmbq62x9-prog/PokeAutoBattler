/* 5.2.1: Release lets go of the pokémon you tapped, wherever it stands on the field. */
const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => { const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  for(const [tag, o] of [['phone', { viewport:{ width:390, height:844 }, hasTouch:true, isMobile:true }], ['desktop', { viewport:{ width:1250, height:900 } }]]){
    const ctx = await b.newContext(o); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.PKB_TITLE = false; });
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(500);
    await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[1] }); G.credits = 0;
      G.team = [['snorlax', 3], ['pikachu', 5], ['charmander', 0]].map(([id, pos]) => { const u = makeUnit(id, 1); u.pos = pos; return u; }); render(); });
    const tap = async sel => { const l = p.locator(sel); if(o.hasTouch) await l.tap(); else await l.click(); await p.waitForTimeout(250); };
    await tap('[data-act="team"][data-i="5"]');
    await tap('[data-act="sell"]');
    const r = await p.evaluate(() => ({ ids: G.team.map(u => u.id).sort().join(','), cr: G.credits }));
    check(r.ids === 'charmander,snorlax' && r.cr > 0, `${tag}: releasing the pokémon on spot 6 lets Pikachu go (left: ${r.ids}, +${r.cr}₽)`);
    await tap('[data-act="team"][data-i="3"]');
    await tap('[data-act="sell"]');
    check(await p.evaluate(() => G.team.map(u => u.id).join(',')) === 'charmander', `${tag}: and the one on spot 4 lets Snorlax go`);
    await p.evaluate(() => { G.team[0].held = 'claw'; G.bag = Array(bagCap(G)).fill('claw'); render(); });
    await tap('[data-act="team"][data-i="0"]');
    await tap('[data-act="sell"]');
    check(await p.evaluate(() => G.team.length === 1 && /Bag is full/.test(document.body.textContent)), `${tag}: with a full Bag it says why instead of doing nothing`);
    check(!errs.length, `${tag}: no errors ${errs.join('; ')}`);
    await ctx.close(); }
  await b.close(); console.log(fails ? `${fails} FAILED` : 'releasetest passed'); process.exit(fails ? 1 : 0); })();
