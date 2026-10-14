const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:780},deviceScaleFactor:2});await p.addInitScript(()=>{window.PKB_TITLE=false;window.PKB_TIPS=true});
await p.goto(require('./pkbpaths').PAGE);await p.waitForTimeout(700);await p.screenshot({path:'tut1.png'});
await p.click('[data-t="next"]');await p.click('[data-t="next"]');await p.waitForTimeout(100);await p.screenshot({path:'tut3.png'});await b.close()})()
