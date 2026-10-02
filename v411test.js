/* 4.0.1: every pokémon's card opens in every mix of gens (Tyrogue, Gloom and Poliwhirl crashed it), and the Pokédex opens fast. */
const { chromium } = require('playwright');
let fails = 0; const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html'); await p.waitForTimeout(700);
  const res = await p.evaluate(() => {
    const bad = []; let n = 0;
    for(const gens of [[1], [2], [1, 2]]){
      G = newGame(5, { gens }); rollShop(G, false); phase = 'shop';
      for(const id of Object.keys(SPECIES)){
        if(!inGens(id, gens) && !SPECIES[id].legendary) continue;
        try{ const u = makeUnit(id, 0); u.pos = 0; G.team = [u]; G.daycare[0] = { unit: makeUnit(id, 0), bought: false };
          render(); popupHtml(u); evoLineHtml(id); n++; }catch(e){ bad.push(gens.join('+') + ':' + id + ' ' + e.message); }
      }
    }
    return { n, bad };
  });
  check(res.n > 300 && !res.bad.length, `${res.n} pokémon cards build in Gen 1, Gen 2 and Gen 1+2 (${res.bad.slice(0, 3).join('; ')})`);
  const ty = await p.evaluate(() => { G = newGame(7, { gens: [1, 2] }); setActiveGens([1, 2]); return [evoLineHtml('tyrogue'), evoLineHtml('gloom'), evoLineHtml('eevee')].map(h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')); });
  check(/Hitmonlee/.test(ty[0]) && /Hitmonchan/.test(ty[0]) && /Hitmontop/.test(ty[0]) && /highest stat/.test(ty[0]), 'Tyrogue’s line says its highest stat decides');
  check(/Vileplume/.test(ty[1]) && /Bellossom/.test(ty[1]) && /Sun Stone/.test(ty[1]), 'Gloom’s line shows the level up and the Sun Stone');
  check(/Stone decides/.test(ty[2]), 'Eevee still says a stone decides');
  /* the Pokédex builds no cards until you tap one, and opens quickly even at phone speed */
  const c = await p.context().newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const dex = await p.evaluate(() => { G = newGame(9, { gens: [1, 2] }); rollShop(G, false); phase = 'shop'; render();
    const t = performance.now(); openDex(); const ms = performance.now() - t;
    const tiles = document.querySelectorAll('.dextile').length; document.querySelector('.dextile[data-id="tyrogue"]').click();
    const card = !!document.querySelector('.dexcardm .dcard'); document.querySelectorAll('.modal').forEach(m => m.remove()); return { ms: Math.round(ms), tiles, card }; });
  check(dex.ms < 900 && dex.tiles > 150 && dex.card, `the Pokédex opens in ${dex.ms} ms at phone speed with ${dex.tiles} tiles, and Tyrogue’s card opens`);
  check(!errs.length, 'no page errors ' + errs.slice(0, 2).join('; '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
