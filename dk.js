const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:640,height:800}});await p.addInitScript(()=>{window.PKB_TITLE=false});
await p.goto(require('./pkbpaths').PAGE);await p.waitForTimeout(500);
console.log(await p.evaluate(()=>{const d=document.querySelector('.dock');const f=d.querySelector('.btn.fight').getBoundingClientRect();return JSON.stringify({dock:d.getBoundingClientRect().width,btn:f.width,h:f.height,fd:getComputedStyle(d).flexDirection})}));await b.close()})()
