import {createServer} from '../index.mjs'


var options = {
	root: `C:\\Users\\${process.env.USERNAME}\\OneDrive\\Dev`,
	pushStream: 'aggressive',
	encoding: false,
	cors: true,
	gzip: false,
	type: 'hybrid',
}

createServer(options)
	.catch(console.error)
