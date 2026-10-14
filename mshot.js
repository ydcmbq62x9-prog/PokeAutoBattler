const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
await ctx.addInitScript(()=>{window.PKB_TITLE=false;localStorage.setItem('pkb_prefs',JSON.stringify({theme:'dark',tips:'off'}))});
const p=await ctx.newPage();await p.goto(require('./pkbpaths').PAGE);await p.waitForTimeout(600);
await p.evaluate(()=>{PREF.set('theme','dark');applyTheme&&applyTheme();PREF.set('tips','off');newRun({gens:[1,2]});G.turn=22;G.badges=5;G.stage=24;G.credits=40;
G.team=['blastoise','charizard','machamp','alakazam','snorlax','gyarados'].map((id,i)=>makeUnit(id,i));fixSlots(G);G.encounter={id:'articuno',cost:12,turn:G.turn};rollShop(G,false);render();});
await p.waitForTimeout(400);await p.screenshot({path:'m1.png'});
await p.evaluate(()=>window.scrollTo(0,900));await p.waitForTimeout(300);await p.screenshot({path:'m2.png'});
console.log(await p.evaluate(()=>({sh:document.documentElement.scrollHeight,dock:document.querySelector('.dock').getBoundingClientRect().height,legendTop:document.querySelector('.legend')?.getBoundingClientRect().top+scrollY})));
await b.close()})()
