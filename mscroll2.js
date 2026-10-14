const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
await ctx.addInitScript(()=>{window.PKB_TITLE=false});
const p=await ctx.newPage();await p.goto(require('./pkbpaths').PAGE);await p.addStyleTag({content:'*{overflow-anchor:none!important}'});await p.waitForTimeout(600);
await p.evaluate(()=>{PREF.set('tips','off');newRun({gens:[1,2]});G.turn=22;G.badges=5;G.stage=24;G.credits=40;
G.team=['blastoise','charizard','machamp','alakazam','snorlax'].map((id,i)=>makeUnit(id,i));G.pc=[makeUnit('abra',1),makeUnit('gastly',4)];fixSlots(G);rollShop(G,false);render();});
await p.waitForTimeout(300);
const st=()=>p.evaluate(()=>({y:Math.round(scrollY),h:document.documentElement.scrollHeight,d1:Math.round(document.querySelectorAll('.drow')[1].getBoundingClientRect().top),party:Math.round(document.querySelector('.panel.party').getBoundingClientRect().top),pc:Math.round(document.querySelector('.slot[data-act="pc"], .pcgrid')?.getBoundingClientRect().top)}));
const tapSel=async sel=>{const r=await p.evaluate(s=>{const e=document.querySelector(s).getBoundingClientRect();return{x:e.left+e.width/2,y:e.top+e.height/2}},sel);await p.touchscreen.tap(r.x,r.y);await p.waitForTimeout(450)};
await p.evaluate(()=>window.scrollTo(0,1100));await p.waitForTimeout(200);console.log('start',await st());
await tapSel('.drow[data-act="dc"][data-i="1"]');console.log('select daycare',await st());
await p.evaluate(()=>document.querySelector('[data-act="cancel"]')?.click());await p.waitForTimeout(300);console.log('cancel',await st());
await p.evaluate(()=>window.scrollTo(0,700));await p.waitForTimeout(200);console.log('start pc',await st());
const pcs=await p.$$('.slot[data-act="pc"]');console.log('pc slots',pcs.length);
await p.evaluate(()=>{const e=[...document.querySelectorAll('[data-act="pc"]')].find(x=>!x.classList.contains('empty'));e&&e.scrollIntoView({block:'center'})});await p.waitForTimeout(200);console.log('pc view',await st());
await tapSel('[data-act="pc"]:not(.empty)');console.log('select pc mon',await st());
console.log(await p.evaluate(()=>document.querySelector('#inspect').getBoundingClientRect().height+' '+document.querySelector('.ctxbar')?.getBoundingClientRect().top));
await b.close()})()
