var {createServer} = require('../index.js')


var options = {
	type: 'hybrid',
	root: `${process.env.USERPROFILE}\\OneDrive\\Dev`,
	pushMode: 'aggressive',
	encoding: false,
	cors: true,
	gzip: false,
	allowUpgrade: false,
}

var server = createServer(options)
server.ready.catch(console.error)
