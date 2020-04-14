const {karmaCommon, getKarmaConfig, defaultBrowserMatrix} = require('./karma.common');

module.exports = function (config) {
  const cfg = getKarmaConfig (defaultBrowserMatrix, {
    // Base path should point at the root 
    basePath: '..',
    // logLevel: config.LOG_DEBUG,
    // Files to include
    files: karmaCommon.files.concat([
      { pattern: 'test/tests-all.js', type: 'module', watched: true, included: true },
      { pattern: 'src/**/*.js', type: 'module', watched: true, included: false },
      { pattern: 'test/**/*.js', type: 'module', watched: true, included: false },
      { watched: true, included: false, served: true, pattern: 'test/worker.js' },
    ])
  });

  config.set(cfg);
}
