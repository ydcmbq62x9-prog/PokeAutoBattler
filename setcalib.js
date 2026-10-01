// write {id: calib} or {id: {mix}} JSON into engine.js boss definitions   node setcalib.js calib|mix '<json>'
const fs = require('fs'); const [field, js] = process.argv.slice(2); const vals = JSON.parse(js);
let s = fs.readFileSync('engine.js', 'utf8');
for(const [id, v] of Object.entries(vals)){
  const start = s.indexOf(`id:'${id}'`); if(start < 0) throw new Error('no boss ' + id);
  const end = s.indexOf('calib:', start); const close = s.indexOf('}', end);
  const block = s.slice(start, close);
  let nb;
  if(field === 'calib') nb = block.replace(/calib:[0-9.]+/, 'calib:' + v);
  else nb = /mix:[0-9.]+/.test(block) ? block.replace(/mix:[0-9.]+/, 'mix:' + v) : block.replace(/calib:([0-9.]+)/, `calib:$1, mix:${v}`);
  s = s.slice(0, start) + nb + s.slice(close);
}
fs.writeFileSync('engine.js', s); console.log('set', field, Object.keys(vals).length);
