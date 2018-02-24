import {createServer} from './index.mjs'


var options = {
	root: `C:\\Users\\${process.env.USERNAME}\\OneDrive\\Dev`,
	encoding: false,
	cors: true,
	gzip: false,
	type: 'hybrid',
}

createServer(options)
	.then(server => console.log('listening'))
	.catch(console.error)
