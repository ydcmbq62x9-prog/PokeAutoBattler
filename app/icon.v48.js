/* v48: the home-screen icon — an original pixel "PB" in the game's Game Boy box.
   Draws SVG and screenshots it at every size the platforms ask for. */
const { chromium } = require('playwright');
const P = ['#####.','##..##','##..##','#####.','##....','##....','##....','##....'];
const B = ['#####.','##..##','##..##','#####.','##..##','##..##','##..##','#####.'];
function glyph(rows, x0, y0, cell, fill){
  let s = '';
  rows.forEach((r, y) => [...r].forEach((c, x) => { if(c === '#') s += `<rect x="${x0 + x*cell}" y="${y0 + y*cell}" width="${cell+0.5}" height="${cell+0.5}" fill="${fill}"/>`; }));
  return s;
}
function svg({ maskable }){
  const S = 512, cream = '#f1ead0', bg = '#e9e3cc', slate = '#3f4a5c', red = '#d9463f', gold = '#f2b632', line = '#d4ccb0';
  const cell = maskable ? 20 : 21, w = 14 * cell, h = 8 * cell, x0 = (S - w) / 2, y0 = (S - h) / 2 - (maskable ? 10 : 14), sh = Math.round(cell * 0.55);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">`;
  s += `<rect width="${S}" height="${S}" fill="${bg}"/>`;
  // faint scanlines, like the game's background
  for(let y = 0; y < S; y += 12) s += `<rect y="${y}" width="${S}" height="4" fill="rgba(63,74,92,.045)"/>`;
  if(!maskable){
    const m = 52, r = 40;
    s += `<rect x="${m+6}" y="${m+8}" width="${S-2*m}" height="${S-2*m}" rx="${r}" fill="rgba(63,74,92,.28)"/>`;       // the drop shadow
    s += `<rect x="${m}" y="${m}" width="${S-2*m}" height="${S-2*m}" rx="${r}" fill="${slate}"/>`;
    s += `<rect x="${m+22}" y="${m+22}" width="${S-2*m-44}" height="${S-2*m-44}" rx="${r-18}" fill="${cream}"/>`;
    s += `<rect x="${m+30}" y="${m+30}" width="${S-2*m-60}" height="${S-2*m-60}" rx="${r-24}" fill="none" stroke="${line}" stroke-width="6"/>`;
  }
  // P: red with a slate shadow; B: slate with a gold shadow — the title logo's two colours
  s += glyph(P, x0 + sh, y0 + sh, cell, slate) + glyph(P, x0, y0, cell, red);
  s += glyph(B, x0 + 8*cell + sh, y0 + sh, cell, gold) + glyph(B, x0 + 8*cell, y0, cell, slate);
  // a row of the lives pokéballs' red/white/slate under the letters: a little battle bar
  const by = y0 + h + cell * 1.4, bw = w, bh = cell * 0.8;
  s += `<rect x="${x0}" y="${by}" width="${bw}" height="${bh}" rx="${bh/2}" fill="${slate}"/>`;
  s += `<rect x="${x0+5}" y="${by+5}" width="${bw*0.62}" height="${bh-10}" rx="${(bh-10)/2}" fill="#2f8f4f"/>`;
  s += '</svg>';
  return s;
}
(async () => {
  const fs = require('fs');
  fs.mkdirSync('icons', { recursive: true });
  fs.writeFileSync('icons/icon.svg', svg({ maskable: false }));
  fs.writeFileSync('icons/icon-maskable.svg', svg({ maskable: true }));
  const b = await chromium.launch();
  const shot = async (file, src, size) => {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<style>html,body{margin:0}img{display:block;width:${size}px;height:${size}px}</style><img src="data:image/svg+xml;base64,${Buffer.from(src).toString('base64')}">`);
    await p.waitForTimeout(50); await p.screenshot({ path: file }); await p.close();
  };
  const plain = svg({ maskable: false }), mask = svg({ maskable: true });
  await shot('icons/icon-512.png', plain, 512); await shot('icons/icon-192.png', plain, 192);
  await shot('icons/apple-touch-icon.png', mask, 180);   // iOS rounds its own corners, so no frame of ours
  await shot('icons/maskable-512.png', mask, 512); await shot('icons/maskable-192.png', mask, 192);
  await shot('icons/favicon-32.png', plain, 32);
  // a preview sheet: plain, maskable under a circle mask (Android), iOS rounded
  const pv = await b.newPage({ viewport: { width: 760, height: 280 } });
  const u = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  await pv.setContent(`<body style="margin:0;background:#888;display:flex;gap:30px;padding:30px;align-items:center">
    <img src="${u('icons/icon-192.png')}" width=192><img src="${u('icons/maskable-192.png')}" width=192 style="border-radius:50%">
    <img src="${u('icons/apple-touch-icon.png')}" width=180 style="border-radius:40px"><img src="${u('icons/favicon-32.png')}" width=32><img src="${u('icons/apple-touch-icon.png')}" width=60 style="border-radius:13px"></body>`);
  await pv.screenshot({ path: 'icon-preview.png' });
  await b.close(); console.log('icons written');
})();
