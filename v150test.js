/* 1.5.0: stone preview — on the shelf and in the message box, before you buy. */
const { chromium, devices } = require('playwright');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const br = await chromium.launch();
  for(const [tag, dev] of [['phone', devices['iPhone 13']], ['wide', { viewport:{ width:1250, height:950 } }]]){
    const p = await (await br.newContext(dev)).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      PREF.set('text', 'instant'); G.turn = 14; G.badges = 4; G.credits = 40;
      G.team = [makeUnit('eevee', 0), makeUnit('pikachu', 0), makeUnit('machop', 0)]; G.pc = [makeUnit('eevee', 0)]; G.pc[0].box = 0; fixSlots(G);
      G.mart = [{ id:'thunderstone', held:false }, { id:'waterstone', held:false }, { id:'firestone', held:false }, { id:'moonstone', held:false }, { id:'protein', held:false }];
      sel = null; inspect = null; render();
      const row = i => (document.querySelector(`.martrow[data-act="mart"][data-i="${i}"] .mprev`) || {}).textContent || '';
      const out = { thunder: row(0), water: row(1), fire: row(2), moon: row(3), protein: row(4) };
      document.querySelector('.martrow[data-act="mart"][data-i="0"]').click();
      out.ins = [...document.querySelectorAll('#inspect .sprev')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
      // it follows what you own: evolve the party Eevee, and the preview drops it
      document.querySelectorAll('.modal').forEach(m => m.remove()); sel = null; inspect = null;
      buyItem(G, 0, 0, 'team'); render();
      out.after = (document.querySelector('.martrow[data-act="mart"][data-i="1"] .mprev') || {}).textContent || '';
      out.over = document.documentElement.scrollWidth > innerWidth + 1;
      return out; });
    check(/Eevee ×2 → Jolteon/.test(r.thunder) && /Pikachu → Raichu/.test(r.thunder), `${tag}: Thunder Stone’s row: “${r.thunder}”`);
    check(/Eevee ×2 → Vaporeon/.test(r.water) && /Eevee ×2 → Flareon/.test(r.fire), `${tag}: Water and Fire Stones show Vaporeon and Flareon`);
    check(!r.moon && !r.protein, `${tag}: nothing shows where nothing you own would evolve (Moon Stone, Protein)`);
    check(r.ins.length === 3 && r.ins.some(t => /Eevee \(PC\).*Jolteon.*Electric.*Cannon/.test(t)) && r.ins.some(t => /Raichu/.test(t)),
      `${tag}: tapping it lists each pokémon, party and PC, with the new type and role`);
    check(r.ins.every(t => /◆[+−]\d+ ♥[+−]\d+ »[+−]\d+/.test(t)), `${tag}: …and how the stats change (${r.ins[0]})`);
    check(/^Yours: Eevee → Vaporeon/.test(r.after) && !/×2/.test(r.after), `${tag}: after one Eevee evolves, the others’ previews update (“${r.after}”)`);
    check(!r.over, `${tag}: it fits`);
    check(!errs.length, `${tag}: no errors${errs.length ? ' — ' + errs[0] : ''}`);
  }
  await br.close();
  console.log(fails ? `${fails} FAILED` : '1.5.0 passed');
  process.exit(fails ? 1 : 0);
})();
