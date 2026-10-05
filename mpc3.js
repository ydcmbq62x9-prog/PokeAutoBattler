const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:1280,height:900}});await p.addInitScript(()=>{window.PKB_TITLE=false});
await p.goto('file:///mnt/user-data/outputs/gen2/pokebattler.html');await p.waitForTimeout(500);
await p.evaluate(()=>{PREF.set('tips','off');newRun({gens:[1]});rollShop(G,false);render()});
for(const n of [0,1,2,3,6]){await p.evaluate(n=>{G.team=['onix','rattata','pidgey','abra','mew','gastly'].slice(0,n).map((id,i)=>makeUnit(id,i));G.pc=[];fixSlots(G);render()},n);await p.waitForTimeout(150);
console.log(n,await p.evaluate(()=>{const r=e=>e&&Math.round(e.getBoundingClientRect().height);return 'party '+r(document.querySelector('.panel.party'))+' grid '+r(document.querySelector('.panel.party .pfield, .panel.party .pgrid, .panel.party [class*=grid]'))+' pc '+r(document.querySelector('.panel.pc'))+' page '+document.documentElement.scrollHeight}))}
await b.close()})()
