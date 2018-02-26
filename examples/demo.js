var anchora = require('./index.mjs')

var options = {
	root: 'C:\\Users\\Mike\\OneDrive\\Dev',
	//root: 'C:\\Users\\kenrm\\OneDrive\\Dev',
	cors: false,
	gzip: false,
	type: 'http2',
}

anchora.launchHybridServer(options)
	.catch(console.error)
