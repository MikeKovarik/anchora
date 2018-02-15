import {launchHybridServer} from './index.mjs'

var options = {
	root: 'C:\\Users\\Mike\\OneDrive\\Dev',
	//root: 'C:\\Users\\kenrm\\OneDrive\\Dev',
	cors: false,
	gzip: false,
	type: 'http2',
}

launchHybridServer(options)
	.catch(console.error)
