var anchora = require('../index.js')


var server = anchora.createServer('http1')
server.ready.catch(console.error)