const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:390,height:844}});
await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');await p.waitForTimeout(600);
await p.evaluate(()=>{G=newGame(11,{gens:[2]});G.redFlag=true;G.redOpen=true;rollShop(G,false);G.stage=runPlan(G).length-1;G.badges=8;phase='shop';render();window.scrollTo(0,99999)});
await p.waitForTimeout(300);await p.screenshot({path:'/tmp/red1.png'});
await p.evaluate(()=>{applyBattleResult(G,'win',opponentFor0(G),null);noteRunEnd();phase='over';render();window.scrollTo(0,0)});
await p.waitForTimeout(500);await p.screenshot({path:'/tmp/red2.png'});await b.close()})();
