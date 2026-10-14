const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:390,height:780},deviceScaleFactor:2});
await p.addInitScript(()=>{window.PKB_TITLE=false});await p.goto(require('./pkbpaths').PAGE);await p.waitForTimeout(600);
await p.evaluate(()=>{const r=records();r.history=Array.from({length:6},(_,i)=>({at:Date.now()-i*3600000,won:i%3===0,stage:10,label:'Reached Lance',team:['charizard','blastoise','machamp','alakazam','snorlax','gyarados'],mods:i%2?'Mono-Water · One Life':'',gens:'1+2',daily:'',sec:i%4===0?['red','oak']:[]}));saveRecords(r);openHistory();});
await p.waitForTimeout(300);await p.screenshot({path:'hist.png'});
await p.evaluate(()=>{document.querySelectorAll('.modal').forEach(x=>x.remove());openDex();document.querySelector('.dextile[data-id="geodude"]').click()});await p.waitForTimeout(300);await p.screenshot({path:'dexcard.png'});await b.close()})()
