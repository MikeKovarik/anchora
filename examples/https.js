var anchora = require('../index.js')


var root = `${process.env.USERPROFILE}\\OneDrive\\Dev`

anchora
	.createServer('https', {root})
	.ready
	.then(() => console.log('server running'))
	.catch(console.error)