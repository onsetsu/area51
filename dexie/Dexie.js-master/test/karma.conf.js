/* Base karma configurations to require and extend from other karma.conf.js
*/
const karmaCommon = {

  // Base path should point at the root
  basePath: '..',

  frameworks: [
    'qunit'
  ],

  reporters: [
    'mocha'
  ],

  client: {
    captureConsole: false
  },

  // logLevel: config.LOG_DEBUG,

  colors: true,

  browserNoActivityTimeout: 2 * 60 * 1000,
  browserDisconnectTimeout: 10000,
  processKillTimeout: 10000,
  browserSocketTimeout: 20000,

  plugins: [
    'karma-qunit',
    'karma-mocha-reporter',
    'karma-chrome-launcher',
  ],

  // Files to include
  files: [
    'node_modules/qunitjs/qunit/qunit.js',
    'test/karma-env.js',
    { pattern: 'test/worker.js', watched: true, included: false, served: true },
    { pattern: 'test/tests-all.js', type: 'module', watched: true, included: true },
    { pattern: 'src/**/*.js', type: 'module', watched: true, included: false },
    { pattern: 'test/**/*.js', type: 'module', watched: true, included: false },
    { watched: true, included: false, served: true, pattern: 'test/worker.js' },
  ],

  browsers: ['Chrome']

};

module.exports = function (config) {
  config.set(karmaCommon);
}
