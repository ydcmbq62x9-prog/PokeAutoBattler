const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({viewport:{width:430,height:1000}})).newPage();
  await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    G = newGame(7); G.turn = 9; G.credits = 14;
    G.team = ['onix','charmeleon','kadabra','pikachu','scyther','staryu'].map(id=>makeUnit(id,0));
    rollShop(G,false); phase='shop'; render();
  });
  await p.waitForTimeout(120);
  const m = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('.panel').forEach((pan,i) => {
      const pr = pan.getBoundingClientRect();
      pan.querySelectorAll('.row').forEach(row => {
        const rr = row.getBoundingClientRect();
        const kids = [...row.children].map(c=>c.getBoundingClientRect());
        out.push({panel:i, rowW:+rr.width.toFixed(1), panelInner:+(pr.width-20).toFixed(1),
          n:kids.length, kidW:kids.length?+kids[0].width.toFixed(1):0,
          left:+(rr.left-pr.left).toFixed(1), right:+(pr.right-rr.right).toFixed(1)});
      });
    });
    return out;
  });
  console.table(m);
  const ov = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  console.log('page overflow:', ov);
  await b.close();
})();
