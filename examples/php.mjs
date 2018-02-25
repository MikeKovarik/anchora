import {createServer} from '../index.mjs'


// WARNING: this does not actually work. It's just an experiment

var options = {
	root: `C:\\Users\\${process.env.USERNAME}\\OneDrive\\Dev`,
	pushStream: 'aggressive',
	encoding: false,
	cors: true,
	gzip: false,
	type: 'hybrid',
	phpPath: `C:\\xampp\\php\\php-cgi.exe`,
}

createServer(options)
	.catch(console.error)
