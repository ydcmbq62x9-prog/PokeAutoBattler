const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1000,height:900}});
await p.goto('file://'+process.cwd()+'/artifact-reference.html'); await p.waitForTimeout(600);
const h=await p.$('h2:has-text("What changed")'); await h.scrollIntoViewIfNeeded();
const box=await h.boundingBox(); await p.screenshot({path:'chg.png',clip:{x:0,y:box.y-10,width:1000,height:850}});
await b.close();})();
