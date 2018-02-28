import {createServer} from '../index.mjs'


var options = {
	type: 'hybrid',
	root: `C:\\Users\\${process.env.USERNAME}\\OneDrive\\Dev`,
	pushStream: 'aggressive',
	encoding: false,
	cors: true,
	gzip: false,
	allowUpgrade: false,
}

var server = createServer(options)
server.ready.catch(console.error)
