const R=(f)=>(s,M,on)=>{ s.move2 = on('open', M.shield('Reflect', f, 'team'), {free:true}); };
module.exports = {
 snorlax: [
  {label:'spd24 base', set:(s)=>{ s.spd=24; }},
  {label:'spd26 base', set:(s)=>{ s.spd=26; }},
  {label:'spd22 Reflect .3', set:(s,M,on)=>{ s.spd=22; R(0.3)(s,M,on); }},
  {label:'spd24 Reflect .3', set:(s,M,on)=>{ s.spd=24; R(0.3)(s,M,on); }},
  {label:'spd26 Reflect .3', set:(s,M,on)=>{ s.spd=26; R(0.3)(s,M,on); }},
  {label:'spd24 Reflect .25', set:(s,M,on)=>{ s.spd=24; R(0.25)(s,M,on); }},
 ],
};
