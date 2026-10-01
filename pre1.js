const E = require('./engine.js'); const k = +process.env.GK || 1; E.TUNING.gauntletRatio = E.TUNING.gauntletRatio.map(x => x / 1.01 * k);
