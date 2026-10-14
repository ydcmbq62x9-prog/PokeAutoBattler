const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
for(const theme of ['light','dark']){
const ctx=await b.newContext({viewport:{width:430,height:932},deviceScaleFactor:2,hasTouch:true,isMobile:true});
await ctx.addInitScript(()=>{window.PKB_TITLE=false});
const p=await ctx.newPage();await p.goto(require('./pkbpaths').PAGE);await p.waitForTimeout(600);
await p.evaluate(t=>{PREF.set('tips','off');PREF.set('theme',t);applyTheme();PREF.set('wipe','off');PREF.set('autoskip','off');newRun({gens:[1]});G.team=['onix','rattata','pidgey','charmander','squirtle','bulbasaur'].map((id,i)=>makeUnit(id,i));fixSlots(G);rollShop(G,false);render();setSpeed(1)},theme);
await p.waitForTimeout(300);await p.tap('[data-act="endturn"]');await p.waitForTimeout(2500);
await p.screenshot({path:'mb-'+theme+'.png'});
console.log(theme,await p.evaluate(()=>({sh:document.documentElement.scrollHeight,ih:innerHeight,app:document.querySelector('#app').getBoundingClientRect().height,stage:document.querySelector('.bstage,.stage')?.getBoundingClientRect().height, bodyBg:getComputedStyle(document.body).backgroundColor,htmlBg:getComputedStyle(document.documentElement).backgroundColor})));
await ctx.close();}
await b.close()})()
