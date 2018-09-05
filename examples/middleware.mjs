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



/*
server.use('anchora-browser.', (req, res) => {
	if (req.url === '/folder-browser.css') {
		res.setHeader('content-type', 'text/css')
		res.send(cssData)
		return
	}
	if (req.url === '/folder-browser.js') {
		res.setHeader('content-type', 'application/javascript')
		res.send(jsData)
		return
	}
})


server.use('anchora-browser.', {
	'/folder-browser.css': (req, res) => {
		res.setHeader('content-type', 'text/css')
		res.send(cssData)
	},
	'/folder-browser.js': (req, res) => {
		res.setHeader('content-type', 'application/javascript')
		res.send(jsData)
	}
})


var subRouter = new Router()
subRouter.get('/folder-browser.css', (req, res) => {
	res.setHeader('content-type', 'text/css')
	res.send(cssData)
})
subRouter.get('/folder-browser.js', (req, res) => {
	res.setHeader('content-type', 'application/javascript')
	res.send(jsData)
})
server.use('anchora-browser.', subRouter)
*/