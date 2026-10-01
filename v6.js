const op=(name,f,who)=>(s,M,on)=>{ s.move2 = on('open', M.shield(name, f, who), {free:true}); };
module.exports = {
 blastoise: [{label:'Surf .9', set:(s,M)=>{ s.move = M.all('Surf', 0.9); }},{label:'Surf .92', set:(s,M)=>{ s.move = M.all('Surf', 0.92); }}],
 onix: [{label:'.5', set:op('Iron Defense',0.5,'self')},{label:'.55', set:op('Iron Defense',0.55,'self')}, {label:'.5 spd45', set:(s,M,on)=>{s.spd=45;op('Iron Defense',0.5,'self')(s,M,on)}}],
 snorlax: [{label:'spd26 .3', set:(s,M,on)=>{ s.spd=26; op('Reflect',0.3,'team')(s,M,on); }},{label:'spd26 .27', set:(s,M,on)=>{ s.spd=26; op('Reflect',0.27,'team')(s,M,on); }}],
 golem: [{label:'.5', set:op('Defense Curl',0.5,'self')},{label:'.45', set:op('Defense Curl',0.45,'self')}],
 cloyster: [{label:'.35', set:op('Iron Defense',0.35,'self')},{label:'.4', set:op('Iron Defense',0.4,'self')}],
 rhydon: [{label:'.5', set:op('Iron Defense',0.5,'self')},{label:'.55', set:op('Iron Defense',0.55,'self')}],
 poliwrath: [{label:'.25', set:op('Iron Defense',0.25,'self')},{label:'.3', set:op('Iron Defense',0.3,'self')}],
 lapras: [{label:'.08', set:op('Safeguard',0.08,'team')},{label:'.12', set:op('Safeguard',0.12,'team')}],
};
