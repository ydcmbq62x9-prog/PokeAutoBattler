/* 5.5.0: the home-screen icon — "PA" (PokéArena) in the game's sports lettering, on the pitch with the halfway circle.
   (v48's pixel PB in a Game Boy box is kept in icon.v48.js.) Drawn as HTML so it can use Barlow Condensed,
   and screenshotted at every size the platforms ask for. */
const { chromium } = require('playwright');
function page({ maskable, size }){
  const k = size / 512, pad = maskable ? 0.8 : 1;   // maskable art stays inside the safe circle
  return `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,800&display=block">
<style>html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}
.i{position:relative;width:${size}px;height:${size}px;overflow:hidden;
  background:radial-gradient(120% 90% at 50% 40%,rgba(255,255,255,.08),rgba(0,0,0,.28)),repeating-linear-gradient(90deg,#3f8f45 0 ${64*k}px,#48a04e ${64*k}px ${128*k}px)}
.line{position:absolute;left:50%;top:0;bottom:0;width:${10*k}px;margin-left:${-5*k}px;background:rgba(255,255,255,.85)}
.circ{position:absolute;left:50%;top:50%;width:${330*k*pad}px;height:${330*k*pad}px;transform:translate(-50%,-50%);border-radius:50%;border:${10*k}px solid rgba(255,255,255,.85);box-sizing:border-box}
.badge{position:absolute;left:50%;top:50%;width:${270*k*pad}px;height:${270*k*pad}px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 50% 30%,#22305a,#11182c 70%);box-shadow:0 0 0 ${9*k}px #ffd23a,0 ${14*k}px ${30*k}px rgba(0,0,0,.45)}
.pb{position:absolute;left:50%;top:50%;transform:translate(-52%,-53%);font:italic 800 ${190*k*pad}px/1 'Barlow Condensed',sans-serif;letter-spacing:${-2*k}px;white-space:nowrap}
.pb .p{color:#fff;text-shadow:${5*k}px ${6*k}px 0 #d9463f}
.pb .b{color:#ffd23a;text-shadow:${5*k}px ${6*k}px 0 #a07a10}
</style></head><body><div class="i"><i class="line"></i><i class="circ"></i><i class="badge"></i><div class="pb"><span class="p">P</span><span class="b">A</span></div></div></body></html>`;
}
(async () => {
  const fs = require('fs');
  fs.mkdirSync('icons', { recursive: true });
  const b = await chromium.launch();
  const shot = async (file, maskable, size) => {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(page({ maskable, size }), { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    const ok = await p.evaluate(() => document.fonts.check("italic 800 40px 'Barlow Condensed'"));
    if(!ok) throw new Error('Barlow Condensed did not load');
    await p.screenshot({ path: file }); await p.close();
  };
  await shot('icons/icon-512.png', false, 512); await shot('icons/icon-192.png', false, 192);
  await shot('icons/apple-touch-icon.png', true, 180);
  await shot('icons/maskable-512.png', true, 512); await shot('icons/maskable-192.png', true, 192);
  await shot('icons/favicon-32.png', false, 32);
  const pv = await b.newPage({ viewport: { width: 760, height: 280 } });
  const u = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  await pv.setContent(`<body style="margin:0;background:#888;display:flex;gap:30px;padding:30px;align-items:center">
    <img src="${u('icons/icon-192.png')}" width=192><img src="${u('icons/maskable-192.png')}" width=192 style="border-radius:50%">
    <img src="${u('icons/apple-touch-icon.png')}" width=180 style="border-radius:40px"><img src="${u('icons/favicon-32.png')}" width=32><img src="${u('icons/apple-touch-icon.png')}" width=60 style="border-radius:13px"></body>`);
  await pv.screenshot({ path: 'icon-preview.png' });
  await b.close(); console.log('icons written');
})();
