/* v48: the home-screen app — manifest, icons, service worker, offline, install. */
const VER = require('fs').readFileSync(__dirname + '/ui.js','utf8').match(/GAME_VERSION = \{ v:'([\w.]+)'/)[1];
const { chromium } = require('playwright');
const { spawn } = require('child_process');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '✓ ' : '✗ ') + msg); if(!ok) fails++; };
const ROOT = '/mnt/user-data/outputs';
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const APPURL = 'http://127.0.0.1:8765/pokebattler-app/';
  const browser = await chromium.launch();
  try{
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if(m.type() === 'error' && !/ERR_TUNNEL|ERR_FAILED|ERR_INTERNET_DISCONNECTED|fonts\.g/.test(m.text())) errs.push(m.text()); });   // this sandbox can't reach Google Fonts
    await page.goto(APPURL); await page.waitForTimeout(500);
    const cdp = await ctx.newCDPSession(page);
    const man = await cdp.send('Page.getAppManifest');
    const parsed = JSON.parse(man.data || '{}');
    check(man.errors.length === 0 && parsed.name === 'PokéBattler' && parsed.display === 'standalone', `the manifest loads with no errors (${parsed.name}, ${parsed.display})`);
    const icons = await page.evaluate(async () => { const out = [];
      for(const h of ['icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'sw.js', 'manifest.webmanifest']){
        const r = await fetch(h); out.push(r.ok); } return out; });
    check(icons.every(Boolean), 'every icon, the manifest and the service worker are served');
    const head = await page.evaluate(() => ({ apple: !!document.querySelector('link[rel="apple-touch-icon"]'), cap: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
      bar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content, vp: document.querySelector('meta[name="viewport"]').content }));
    check(head.apple && head.cap === 'yes' && head.bar === 'black-translucent' && /viewport-fit=cover/.test(head.vp), 'iPhone tags: home-screen icon, full-screen web app, status bar over the page, notch-aware viewport');
    const sw = await page.evaluate(async () => { const reg = await navigator.serviceWorker.ready; return { active: !!reg.active, scope: reg.scope }; });
    check(sw.active && /pokebattler-app\/$/.test(sw.scope), `the service worker is active for the app (${sw.scope})`);
    await page.reload(); await page.waitForTimeout(600);   // now controlled
    const cached = await page.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks.find(k => /^pokebattler-(?!fonts)/.test(k)));
      return { keys: ks, n: (await c.keys()).length, controlled: !!navigator.serviceWorker.controller }; });
    check(cached.controlled && cached.n >= 9 && cached.keys.some(k => k === 'pokebattler-' + VER), `the game, manifest and icons are cached for offline (${cached.n} files, ${cached.keys.join(', ')})`);
    const inst = await cdp.send('Page.getInstallabilityErrors');
    check(inst.installabilityErrors.length === 0, `Chrome says it's installable${inst.installabilityErrors.length ? ' — ' + JSON.stringify(inst.installabilityErrors) : ''}`);

    /* offline */
    await page.evaluate(() => { G.turn = 7; save(); });
    await ctx.setOffline(true);
    await page.reload(); await page.waitForTimeout(700);
    const off = await page.evaluate(() => ({ app: !!document.querySelector('.pfield'), turn: G.turn, v: GAME_VERSION.v }));
    check(off.app && off.turn === 7 && off.v === VER, `offline, the app still opens — with the saved run (turn ${off.turn}, ${off.v})`);
    await ctx.setOffline(false);

    /* install from the START menu */
    await page.evaluate(() => { window.PKB_INSTALL = true; });
    await page.click('[data-act="menu"]'); await page.waitForTimeout(300);
    const has = await page.$('.smi[data-m="install"]');
    check(!!has, 'hosted and not yet installed: START offers Install app');
    await page.click('.smi[data-m="install"]'); await page.waitForTimeout(250);
    const help = await page.evaluate(() => { const m = document.querySelector('.modal.install'); return m ? m.querySelectorAll('.ihelp li').length : 0; });
    check(help >= 2, `…which explains how to add it to the home screen (${help} steps)`);
    await page.click('.modal.install [data-m="close"]');
    /* the browser's own install prompt, when it offers one */
    const prompted = await page.evaluate(async () => { let shown = false; const e = new Event('beforeinstallprompt'); e.prompt = () => { shown = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(e); window.PKB_INSTALL = false; openMenu(); await new Promise(r => setTimeout(r, 50)); document.querySelector('.smi[data-m="install"]').click(); await new Promise(r => setTimeout(r, 50)); return shown; });
    check(prompted, 'on Android/desktop Chrome, Install app opens the browser\'s own install prompt');

    /* standalone: the status-bar strip and safe areas */
    const st = await page.evaluate(() => { document.documentElement.classList.add('standalone'); document.querySelectorAll('.modal').forEach(m => m.remove());
      const b = getComputedStyle(document.body, '::before'); return { content: b.content, pos: b.position, pad: getComputedStyle(document.querySelector('#app')).paddingTop }; });
    check(st.content !== 'none' && st.pos === 'fixed' && st.pad === '8px', `standalone: a strip sits behind the status bar; with no notch the page keeps its 8px top (${st.pad})`);
    const callout = await page.evaluate(() => getComputedStyle(document.querySelector('img')).webkitTouchCallout || 'n/a');
    check(callout === 'none' || callout === 'n/a', `long-pressing a sprite doesn't offer "Save image" (${callout})`);
    check(errs.length === 0, `no errors${errs.length ? ' — ' + errs.join(' | ') : ''}`);

    /* the artifact copy and the local file stay as they were */
    const p2 = await ctx.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(e.message)); p2.on('console', m => { if(m.type() === 'error') e2.push(m.text()); });
    await p2.goto('file://' + ROOT + '/pokebattler.html'); await p2.waitForTimeout(400);
    const plain = await p2.evaluate(async () => { openMenu(); await new Promise(r => setTimeout(r, 50));
      return { manifest: !!document.querySelector('link[rel="manifest"]'), install: !!document.querySelector('.smi[data-m="install"]'), sw: location.protocol !== 'file:' && 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0 }; });
    check(!plain.manifest && !plain.install && plain.sw === 0 && e2.length === 0, 'the artifact / local-file copy has no manifest, no service worker and no Install app');
    const p3 = await ctx.newPage(); await p3.goto('http://127.0.0.1:8765/pokebattler.html'); await p3.waitForTimeout(400);
    check(await p3.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).filter(r => !/pokebattler-app/.test(r.scope)).length === 0 && !APP.canInstall()),
      'served from the web without the app files (the artifact), it never registers a worker or offers Install');
    await ctx.close();
  } finally { await browser.close(); srv.kill(); }
  console.log(fails ? `${fails} FAILED` : 'home-screen app passed');
  process.exit(fails ? 1 : 0);
})();
