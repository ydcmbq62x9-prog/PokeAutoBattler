const { chromium } = require('playwright');
/* 6.21.1 (Sean's phone screenshots): the Pokédex gen filter shows each region only (Gen 1 = Kanto #1–151, Gen 2 = Johto
   #152–251, Gen 3 = Hoenn #252–386); a Hoenn pokémon's card says Gen 3 runs; and on a phone the title menu lights one item,
   even when :hover has stuck to the last item tapped (it lit New run and Daily challenge together). */
const URL = require('./pkbpaths').PAGE, OUT = '_scratch';
let bad = 0; const check = (ok, m) => { console.log((ok ? '✓ ' : '✗ ') + m); if(!ok) bad++; };
(async () => {
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  require('fs').mkdirSync(OUT, { recursive:true });
  const p = await (await br.newContext({ viewport:{ width:390, height:844 }, hasTouch:true, isMobile:true })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(URL); await p.waitForTimeout(500);
  await p.evaluate(() => { document.querySelectorAll('.modal,#title').forEach(e => e.remove()); document.body.classList.remove('titled');
    PREF.set('dexseen', JSON.stringify([Object.keys(SPECIES).find(x => SPECIES[x].name === 'Treecko')])); openDex(); });
  for(const [g, lo, hi, region] of [['1', 1, 151, 'Kanto'], ['2', 152, 251, 'Johto'], ['3', 252, 386, 'Hoenn']]){
    await p.click(`.dexseg[data-f="gen"] [data-v="${g}"]`);
    const r = await p.evaluate(() => { const v = [...document.querySelectorAll('.dextile')].filter(t => !t.hidden && !t.closest('[hidden]')).map(t => NATDEX[t.dataset.id]); return { n: v.length, min: Math.min(...v), max: Math.max(...v) }; });
    check(r.n > 0 && r.min >= lo && r.max <= hi, `Gen ${g} shows only ${region}: ${r.n} pokémon, #${r.min}–#${r.max}`);
    if(g === '2') await p.screenshot({ path: OUT + '/dex-gen2.png' });
  }
  await p.click('.dexseg[data-f="gen"] [data-v="all"]');
  const all = await p.evaluate(() => [...document.querySelectorAll('.dextile')].filter(t => !t.hidden).length);
  check(all === 297, `All gens shows all ${all}`);
  const tk = await p.evaluate(() => Object.keys(SPECIES).find(x => SPECIES[x].name === 'Treecko'));
  await p.evaluate(k => document.querySelector(`.dextile[data-id="${k}"]`).click(), tk); await p.waitForSelector('.dexcardm');
  const tre = await p.textContent('.dexcardm');
  check(/Gen 3 runs/.test(tre) && !/Bosses only/.test(tre), 'Treecko\'s card says it is sold in Gen 3 runs');
  // title menu on a phone: tap an item, come back, only one item is lit
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(e => e.remove()); titleEl = null; showTitle(afterTitle); });
  await p.waitForSelector('#title .tpress'); await p.tap('#title .tpress'); await p.waitForTimeout(300);
  await p.tap('[data-t="daily"]'); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelectorAll('.modal').forEach(e => e.remove())); await p.waitForTimeout(200);
  // a phone keeps :hover on the last item tapped; force that state on Daily challenge the way the phone had it
  const cdp = await p.context().newCDPSession(p); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument'); const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-t="daily"]' });
  await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
  check(!await p.evaluate(() => matchMedia('(hover: hover)').matches), 'the test phone is a touch screen (cannot hover)');
  const lit = await p.evaluate(() => [...document.querySelectorAll('.tmi')].filter(b => { const cs = getComputedStyle(b); return cs.boxShadow !== 'none' && cs.boxShadow.includes('inset'); }).map(b => b.dataset.t));
  await p.screenshot({ path: OUT + '/title-menu.png' });
  check(lit.length === 1, `title menu on a phone: one item lit (${lit.join(', ')})`);
  check(errs.length === 0, 'no page errors ' + (errs[0] || ''));
  await br.close(); console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
})();
