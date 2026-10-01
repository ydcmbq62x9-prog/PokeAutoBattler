const op=(name,f,who)=>(s,M,on)=>{ s.move2 = on('open', M.shield(name, f, who), {free:true}); };
module.exports = {
 blastoise: [
  {label:'base'},
  {label:'Surf .95', set:(s,M)=>{ s.move = M.all('Surf', 0.95); }},
  {label:'Surf 1.0', set:(s,M)=>{ s.move = M.all('Surf', 1.0); }},
 ],
 onix: [
  {label:'base'},
  {label:'IronDef self .5', set:op('Iron Defense',0.5,'self')},
  {label:'IronDef self .6', set:op('Iron Defense',0.6,'self')},
 ],
 snorlax: [
  {label:'base'},
  {label:'spd26 Reflect team .3', set:(s,M,on)=>{ s.spd=26; op('Reflect',0.3,'team')(s,M,on); }},
  {label:'spd24 Reflect team .3', set:(s,M,on)=>{ s.spd=24; op('Reflect',0.3,'team')(s,M,on); }},
  {label:'spd24 Reflect hurt .5', set:(s,M,on)=>{ s.spd=24; op('Reflect',0.5,'hurt')(s,M,on); }},
 ],
 golem: [
  {label:'base'},
  {label:'DefCurl open self .5', set:op('Defense Curl',0.5,'self')},
 ],
 cloyster: [
  {label:'base'},
  {label:'Withdraw open self .5 (move2)', set:op('Iron Defense',0.5,'self')},
  {label:'Supersonic every2', set:(s,M,on)=>{ s.move2 = on('every', M.afflict('Supersonic', 0, 'cnf', 1, 'front'), {n:2}); }},
 ],
 rhydon: [
  {label:'base'},
  {label:'Stomp every2', set:(s,M,on)=>{ s.move2 = on('every', M.afflict('Stomp', 1.0, 'fln', 0.5, 'front'), {n:2}); }},
  {label:'open shield self .4', set:op('Iron Defense',0.4,'self')},
 ],
 lapras: [{label:'base'},{label:'Rest? low hurt shield', set:op('Safeguard',0.25,'team')}],
 poliwrath: [{label:'base'},{label:'open self .4', set:op('Iron Defense',0.4,'self')}],
};
