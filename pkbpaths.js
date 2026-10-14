/* Where the build puts its output and where the tests look. Default is the folder the cloud sessions used;
   set PKB_OUT to any folder on your own computer (build.py reads the same variable). */
const path = require('path'), { pathToFileURL } = require('url');
const OUT = process.env.PKB_OUT || '/mnt/user-data/outputs';
module.exports = {
  OUT,
  GEN2: path.join(OUT, 'gen2'),
  PAGE: pathToFileURL(path.join(OUT, 'gen2', 'pokebattler.html')).href,        // what the browser tests load
  PAGE_FILE: path.join(OUT, 'gen2', 'pokebattler.html'),
  ARTIFACT: pathToFileURL(path.join(OUT, 'pokebattler.html')).href,
  ARTIFACT_FILE: path.join(OUT, 'pokebattler.html'),
};
