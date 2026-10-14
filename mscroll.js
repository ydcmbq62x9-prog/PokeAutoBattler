const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
await ctx.addInitScript(()=>{window.PKB_TITLE=false});
const p=await ctx.newPage();await p.goto(require('./pkbpaths').PAGE);await p.waitForTimeout(600);
await p.evaluate(()=>{PREF.set('tips','off');newRun({gens:[1,2]});G.turn=22;G.badges=5;G.stage=24;G.credits=40;
G.team=['blastoise','charizard','machamp','alakazam','snorlax'].map((id,i)=>makeUnit(id,i));fixSlots(G);rollShop(G,false);render();});
await p.waitForTimeout(300);
const probe=async(label)=>console.log(label,await p.evaluate(()=>({y:Math.round(scrollY),h:document.documentElement.scrollHeight,first:(()=>{const e=document.querySelector('.drow');return e&&Math.round(e.getBoundingClientRect().top)})()})));
for(const y of [0,700,1400]){await p.evaluate(y=>window.scrollTo(0,y),y);await p.waitForTimeout(200);await probe('before @'+y);
 await p.tap('.drow[data-act="dc"][data-i="1"]');await p.waitForTimeout(400);await probe(' after select daycare');
 await p.evaluate(()=>{window.scrollTo(0,scrollY)});
 const t=await p.$('.slot[data-act="team"]');if(t){await t.tap();await p.waitForTimeout(400);await probe(' after tap team slot');}
 await p.evaluate(()=>{const c=document.querySelector('[data-act="cancel"]');c&&c.click()});await p.waitForTimeout(300);}
await b.close()})()
