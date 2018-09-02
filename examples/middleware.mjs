// WARNING: concept. not a real working demo

var anchora = require('../index.js')
var server = anchora.createServer('dev')

// file extension
server.use(['.md', '.markdown'], (req, res, desc, sink) => {
	// TODO: render the markdown
})

// subdomain
server.use('proxy.', (req, res, desc, sink) => {
	// TODO: implement proxy
})

// route
server.use('/admin', (req, res, desc, sink) => {
	// TODO: implement custom route handler
})