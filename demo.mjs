import {createServer} from './index.mjs'

var root = `C:\\Users\\${process.env.USERNAME}\\OneDrive\\Dev`

var options = {
	root,
	cors: false,
	gzip: false,
	type: 'hybrid',
}

createServer(options)
	.then(server => console.log('listening'))
	.catch(console.error)
