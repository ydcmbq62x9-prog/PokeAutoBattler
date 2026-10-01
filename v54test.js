/* v54: rarity sparkle, X items at 2 uses, the Choice Band sprite. */
const E = require('./engine.js');
const { chromium, devices } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
check(E.TUNING.xItems.perBattle === 2 && E.TUNING.xItems.pct === 0.05, 'X items: +5%, 2 uses a battle');
(async () => {
  const br = await chromium.launch();
  for(const [tag, dev] of [['phone', devices['iPhone 13']], ['wide', { viewport: { width: 1250, height: 950 } }]]){
    const ctx = await br.newContext(dev); await ctx.addInitScript(() => { window.PKB_SOUND = true; });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///mnt/user-data/outputs/pokebattler.html'); await p.waitForTimeout(250);
    // a restock with one rare and one very rare
    const r = await p.evaluate(async () => {
      G.turn = 20; G.badges = 6; G.credits = 50; G.team = [makeUnit('machamp', 0)]; fixSlots(G);
      G.mart = [{ id:'protein', held:false }, { id:'hpup', held:false }, { id:'band', held:true }, { id:'claw', held:true }]; render();
      const n0 = SFX.log.length;
      G.mart = [{ id:'protein', held:false }, { id:'expshare', held:false }, { id:'band', held:true }, { id:'orb', held:true }]; render();
      const row = i => document.querySelector(`.martrow[data-act="mart"][data-i="${i}"]`);
      const out = { rare: row(1).classList.contains('fx-rare'), vrare: row(3).classList.contains('fx-vrare'),
        plain: !row(0).className.match(/fx-v?rare/) && !row(2).className.match(/fx-v?rare/),
        sound: SFX.log.slice(n0), anim: getComputedStyle(row(3), '::after').animationName,
        glow: getComputedStyle(row(1), '::before').animationName };
      // a redraw with the same stock doesn't sparkle again
      const n1 = SFX.log.length; render();
      out.again = !!document.querySelector('.fx-rare,.fx-vrare'); out.again2 = SFX.log.slice(n1).filter(x => /sparkle/.test(x)).length;
      // a rare item that was already there isn't new
      G.mart = [{ id:'hpup', held:false }, { id:'expshare', held:false }, { id:'claw', held:true }, { id:'orb', held:true }]; render();
      out.stay = !document.querySelector('.fx-rare,.fx-vrare');
      out.choice = !!SPRITES.choice && SPRITES.choice.length > 100;
      return out; });
    check(r.rare && r.vrare && r.plain, `${tag}: the new Rare and Very rare rows sparkle, common rows don't`);
    check(r.anim === 'rareshine' && r.glow === 'rareglow', `${tag}: shine and glow run (${r.anim}, ${r.glow})`);
    check(r.sound.includes('sparkle2') && !r.sound.includes('deal'), `${tag}: the Very rare chime plays instead of the plain deal sound (${r.sound.join(',')})`);
    check(!r.again && r.again2 === 0, `${tag}: redrawing the same shelf doesn't sparkle again`);
    check(r.stay, `${tag}: a rare item that stays on the shelf across a restock doesn't re-sparkle`);
    check(r.choice, `${tag}: Choice Band has a sprite`);
    check(!errs.length, `${tag}: no errors${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }
  await br.close();
  console.log(fails ? `${fails} FAILED` : 'v54 passed');
  process.exit(fails ? 1 : 0);
})();
