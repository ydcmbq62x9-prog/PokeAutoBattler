const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:1280,height:900}});await p.addInitScript(()=>{window.PKB_TITLE=false});
await p.goto(require('./pkbpaths').PAGE);await p.waitForTimeout(600);
const m=()=>p.evaluate(()=>{const r=e=>e&&Math.round(e.getBoundingClientRect().height);return{pcpanel:r(document.querySelector('.panel.pc')),pcgrid:r(document.querySelector('.pcgrid')),shelves:r(document.querySelector('.shelves')),daycare:r([...document.querySelectorAll('.shelves .panel')][1]),h:document.documentElement.scrollHeight}});
await p.evaluate(()=>{PREF.set('tips','off');newRun({gens:[1]});G.team=['onix','rattata'].map((id,i)=>makeUnit(id,i));G.pc=[];fixSlots(G);rollShop(G,false);render()});console.log('empty',await m());
await p.evaluate(()=>{G.pc=[makeUnit('abra',1)];fixSlots(G);render()});console.log('one',await m());
await p.evaluate(()=>{G.pc=[];render()});console.log('removed',await m());
await p.evaluate(()=>{G.pc=Array.from({length:9},(_,i)=>{const u=makeUnit('abra',1);u.box=i;return u});fixSlots(G);render()});console.log('nine',await m());
await b.close()})()
