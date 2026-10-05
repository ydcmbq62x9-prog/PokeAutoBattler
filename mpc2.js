const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
for(const w of [1280,1024,800]){
const p=await b.newPage({viewport:{width:w,height:900}});await p.addInitScript(()=>{window.PKB_TITLE=false});
await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');await p.waitForTimeout(500);
const m=l=>p.evaluate(l=>{const r=e=>e&&Math.round(e.getBoundingClientRect().height);const w=document.querySelector('.panel.pc .wall');return l+' wall '+r(w)+' cell '+r(w.querySelector('.cell'))+' pc '+r(document.querySelector('.panel.pc'))+' insp '+r(document.querySelector('#inspect'))+' page '+document.documentElement.scrollHeight},l).then(console.log);
await p.evaluate(()=>{PREF.set('tips','off');newRun({gens:[1]});G.team=['onix','rattata'].map((id,i)=>makeUnit(id,i));G.pc=[makeUnit('abra',1)];fixSlots(G);rollShop(G,false);render()});
await m(w+' one in pc');
await p.click('.panel.pc button.cell');await p.waitForTimeout(300);await m(' selected');
await p.click('[data-act="release"]');await p.waitForTimeout(300);await m(' released last');
await p.evaluate(()=>{G.pc=[];render()});await p.waitForTimeout(200);await m(' empty');
await p.close();}
await b.close()})()
