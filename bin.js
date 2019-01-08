var {createServer} = require('./index.js')
var fs = require('fs').promises


var configFileName = '.anchora'

fs.stat(configFileName)
	.then(() => fs.readFile(configFileName))
	.then(JSON.parse)
	.catch(() => {})
	.then(configOptions => {

		var defaultOptions = {
			type: 'both',
			headers: {'strict-transport-security': 'max-age=0'},
			allowUpgrade: false,
			cors: true,
		}

		var options = Object.assign({}, defaultOptions, configOptions)

		var server = createServer('dev', options)

		server.use(async (req, res) => {
			console.log('req.headers.host', req.headers.host)
		})

		server.use('cors-proxy.', async (req, res) => {
			console.log('CORS host', req.headers.host)
			console.log('Time: %d', Date.now())
			res.setHeader('access-control-allow-origin', '*')
			res.setHeader('access-control-allow-methods', ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'])
			res.setHeader('access-control-allow-headers', ['x-requested-with', 'content-type'])
			res.setHeader('access-control-allow-credentials', true)
			//req.pipe(res)
		})
/*
		server.use('.md', async (req, res) => {
			console.log('req.headers.host', req.headers.host)
			console.log('TODO: render Markdown')
		})
*/
		return server.ready
	})
	.catch(console.error)