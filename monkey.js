/* 4.9.0 · Monkey bot: taps random things on every screen across sizes and rule combinations and reports
   page errors, stuck screens and sideways scrolling. usage: node monkey.js [taps=120] [seed=1] */
const { chromium } = require('playwright');
const TAPS = +process.argv[2] || 120; let seed = +process.argv[3] || 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const SIZES = [[360, 640], [390, 844], [820, 1180]];
const COMBOS = [
  { gens:[1] }, { gens:[2] }, { gens:[1,2] },
  { gens:[1,2], mods:{ onelife:true } }, { gens:[1], mods:{ mono:'Water' } }, { gens:[1,2], mods:{ mono:'Ground' } },
  { gens:[1,2], mods:{ nopc:true } }, { gens:[1,2], mods:{ secrets:true } }, { gens:[2], mods:{ rich:true, onelife:true } },
];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const problems = []; let taps = 0;
  for(const [w, h] of SIZES){
    const ctx = await b.newContext({ viewport:{ width:w, height:h }, hasTouch: w < 700, isMobile: w < 700 });
    await ctx.addInitScript(() => { window.PKB_TITLE = false; });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e).split('\n')[0])); p.on('console', m => { if(m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)); });
    await p.goto(require('./pkbpaths').PAGE); await p.waitForTimeout(500);
    for(const combo of COMBOS){
      await p.evaluate(c => { localStorage.setItem('pkb_prefs_dummy', '1'); try{ PREF.set('motion', 'reduced'); PREF.set('text', 'instant'); PREF.set('autoskip', 'on'); PREF.set('tips', 'off'); }catch(e){}
        document.querySelectorAll('.modal').forEach(x => x.remove()); newRun(c); G.credits = 60; render(); setSpeed(4); }, combo);
      let stuck = 0, last = '';
      for(let i = 0; i < TAPS; i++){
        const picked = await p.evaluate(r => {
          const ok = e => { const b = e.getBoundingClientRect(); if(b.width < 4 || b.height < 4 || b.bottom < 0 || b.top > innerHeight) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && !e.disabled; };
          const modal = document.querySelector('.modal:not([hidden])'); const scope = modal || document;
          let els = [...scope.querySelectorAll('[data-act],button,[data-id],[data-m],[data-i]')].filter(ok);
          // never wipe the saved records or load codes by accident of the bot
          els = els.filter(e => !/danger/.test(e.className) && !/^(yes)$/.test(e.dataset.x || ''));
          if(!els.length) return null;
          const fight = els.filter(e => e.dataset.act === 'endturn' || /fight|battle/i.test(e.textContent) && e.className.includes('fight'));
          const pool = fight.length && r < .22 ? fight : els;
          const e = pool[Math.floor(r * 997) % pool.length]; const b = e.getBoundingClientRect();
          return { x: b.left + b.width / 2, y: b.top + b.height / 2, t: (e.dataset.act || e.dataset.m || e.className || e.tagName).toString().slice(0, 30) };
        }, rnd());
        if(!picked) { await p.keyboard.press('Escape').catch(() => {}); await p.evaluate(() => document.querySelectorAll('.modal').forEach(x => x.remove())); continue; }
        await p.mouse.click(picked.x, picked.y).catch(() => {}); taps++;
        if(i % 6 === 0) await p.waitForTimeout(60);
        if(i % 25 === 0){ const st = await p.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth + 1, sig: document.body.innerText.slice(0, 60) }));
          if(st.over) problems.push(`${w}x${h} ${JSON.stringify(combo)} page scrolls sideways after tap ${i}`);
          stuck = st.sig === last ? stuck + 1 : 0; last = st.sig; if(stuck > 6){ problems.push(`${w}x${h} ${JSON.stringify(combo)} screen looks frozen: ${st.sig}`); break; } }
        if(i % 40 === 39){ await p.evaluate(() => { try{ if(G.over) newRun(G.mods ? { gens:G.gens, mods:G.mods } : { gens:G.gens }); }catch(e){} }); }
      }
      if(errs.length){ problems.push(`${w}x${h} ${JSON.stringify(combo)} errors: ${[...new Set(errs)].slice(0, 3).join(' | ')}`); errs.length = 0; }
    }
    await ctx.close();
  }
  await b.close();
  console.log(`${taps} taps across ${SIZES.length} sizes × ${COMBOS.length} rule sets`);
  if(problems.length){ problems.forEach(x => console.log('PROBLEM ' + x)); process.exit(1); } else console.log('no problems found');
})();
