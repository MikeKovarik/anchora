import fs from 'fs'
import commonjs from 'rollup-plugin-commonjs'
import json from 'rollup-plugin-json'


var pkg = JSON.parse(fs.readFileSync('package.json').toString())
var nodeCoreModules = require('repl')._builtinLibs
var external = [...nodeCoreModules, ...Object.keys(pkg.dependencies || {})]
var globals = objectFromArray(external)

export default {
	treeshake: false,
	input: 'index.mjs',
	output: {
		file: `index.js`,
		format: 'umd',
	},
	plugins: [
		json(),
		commonjs(),
	],
	name: pkg.name,
	external,
	globals,
}

function objectFromArray(modules) {
	var obj = {}
	modules.forEach(moduleName => obj[moduleName] = moduleName)
	return obj
}