var {createServer} = require('../index.js')


var options = {
	type: 'both',
	root: `${process.env.USERPROFILE}\\OneDrive\\Dev`,
	headers: {'strict-transport-security': 'max-age=0'},
	allowUpgrade: false,
	cors: true,
}


var server = createServer('dev', options)

server.use('cors-proxy.', async function(req, res) {
	console.log('req.headers.host', req.headers.host)
	console.log('Time: %d', Date.now())
	res.setHeader('access-control-allow-origin', '*')
	res.setHeader('access-control-allow-methods', ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'])
	res.setHeader('access-control-allow-headers', ['x-requested-with', 'content-type'],)
	res.setHeader('access-control-allow-credentials', true)
	req.pipe(res)
})

server.ready.catch(console.error)
