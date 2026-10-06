const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:393, height:740 }, deviceScaleFactor:3 });
  await p.addInitScript(() => { window.PKB_TITLE = false; });
  await p.goto('file:///mnt/user-data/outputs/pokebattler.html'); await p.waitForTimeout(600);
  const r = await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); newRun({ gens:[2] }); render();
    const st = document.querySelector('.wcam .bstage'), tv = st.querySelector('.tview'), cs = getComputedStyle(tv);
    const out = { persp: cs.perspective, po: cs.perspectiveOrigin, real: {}, sim: {} };
    const orig = window.getComputedStyle;
    for(const m of st.querySelectorAll('.slotmark.p')){ const k = m.className.replace('slotmark p ',''); const q = planeRect(m); out.real[k] = Math.round((q.bottom - q.height*.06) * 3); }
    // simulate Safari returning unresolved values
    window.getComputedStyle = (e, pe) => { const c = orig(e, pe); if(e === tv) return new Proxy(c, { get: (t, k) => k === 'perspective' ? '150cqw' : k === 'perspectiveOrigin' ? '50% 0%' : (typeof t[k] === 'function' ? t[k].bind(t) : t[k]) }); return c; };
    for(const m of st.querySelectorAll('.slotmark.p')){ const k = m.className.replace('slotmark p ',''); const q = planeRect(m); out.sim[k] = Math.round((q.bottom - q.height*.06) * 3) + ' x' + Math.round((q.left+q.width/2)*3); }
    window.getComputedStyle = orig; return out; });
  console.log(JSON.stringify(r, null, 1)); await b.close();
})();
