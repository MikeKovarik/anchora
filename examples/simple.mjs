import {createServer} from '../index.mjs'


var server = createServer('http1')
server.ready.catch(console.error)