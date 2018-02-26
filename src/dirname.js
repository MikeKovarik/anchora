// SIGH...
// https://github.com/nodejs/node-eps/blob/master/002-es-modules.md#4512-getting-cjs-variables-workaround
// Bundling is a pain as well.
if (__dirname.endsWith('src'))
	module.exports = __dirname
else
	module.exports = require('path').join(__dirname, './src')