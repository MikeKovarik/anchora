import http from 'http'
import https from 'https'
import http2 from 'http2'
import {debug} from './util.mjs'
import pkg from '../package.json'
// core components
import {Cache} from './cache.mjs'
import {Router} from './router.mjs'
// TODO. work in progress
import {extendReqProto, Request} from './request.mjs'
import {extendResProto} from './response.mjs'


// TODO: non blocking parsing of subdependencies (dependecies in pushstream)
// TODO: consider implementing preload attribute and header
// TODO: enable CGI for HTTP2. because HTTP2 doesn't have 'req', it's just shimmed plain object
//       (var req = shimReqHttp1(headers)) but it needs to be stream to be piped from
//       req.pipe(cgi.stdin)




import {serveCertIfNeeded} from './cert.mjs'
import {injectDescriptor} from './filedescriptor.mjs'
import {parseUrlQuery, serve404IfNotFound} from './serve.mjs'
import {handleHttpsRedirect, setDefaultHeaders, setCorsHeaders, setCspHeaders} from './headers.mjs'
import {ensureFolderEndsWithSlash} from './folder.mjs'
import {redirectFromIndexToFolder} from './folder.mjs'
import {serveFolder} from './folder.mjs'
import {serveFile} from './file.mjs'

export class AnchoraServer extends Router {

	constructor(...args) {
		super()

		this.server = this
		this.closing = false
		this.closed = false

		this.anchoraInfo = `Anchora-Static-Server/${pkg.version} Node/${process.version}`

		this.handleRequest = this.handleRequest.bind(this)
		this.handleStream = this.handleStream.bind(this)

		this.applyArgs(args)
		this.normalizeOptions()

		// Enable 'debug' module and set DEBUG env variable if options.debug is set
		if (this.debug) {
			if (!process.env.DEBUG.includes('anchora'))
				process.env.DEBUG = 'anchora,' + process.env.DEBUG
		}

		if (process.env.DEBUG) {
			process.on('unhandledRejection', dump => {
				console.log('unhandledRejection', dump)
			})
			process.on('uncaughtException', dump => {
				console.log('uncaughtException', dump)
			})
		}

		this.cache = new Cache(this)

		this.use(parseUrlQuery)
		this.use(serveCertIfNeeded)
		this.use(handleHttpsRedirect)
		this.use(injectDescriptor)
		this.use(setDefaultHeaders)
		this.use(setCorsHeaders)
		this.use(setCspHeaders)
		this.use(ensureFolderEndsWithSlash)
		this.use(redirectFromIndexToFolder)
		this.use(serve404IfNotFound)
		this.use(serveFolder)
		this.use(serveFile)

		if (this.autoStart !== false)
			this.ready = this.listen()
	}

	// Alias for listen()
	start(...ports) {
		this.listen(...ports)
	}

	async listen(...ports) {
		this.cache.start()
		this.normalizeOptions()

		// Close previous sessions, prepare reusal of the class
		await this._cleanup()

		// Convert optional port arguments and apply the to the instance.
		if (ports.length === 1)
			this.applyPort(...ports)
		else if (ports.length > 1)
			this.applyPort(ports)

		if (this.portUnsecure && typeof this.portUnsecure !== 'number') {
			this.portUnsecure = parseInt(this.portUnsecure)
			if (Number.isNan(this.portUnsecure))
				throw new Error(`Secure Port is incorrect. 'portUnsecure' has to be number`)
		}

		if (this.portSecure && typeof this.portSecure !== 'number') {
			this.portSecure = parseInt(this.portSecure)
			if (Number.isNan(this.portSecure))
				throw new Error(`Secure Port is incorrect. 'portSecure' has to be number`)
		}

		// Load or generate self-signed (for localhost and dev purposes only) certificates needed for HTTPS or HTTP2.
		if (this.https || this.http2)
			await this.loadOrGenerateCertificate()

		// User might've closed the instance in meantime.
		if (this.closing || this.closed) return

		// HTTP1 can support both unsecure (HTTP) and secure (HTTPS) connections.
		if (this.http)
			this.serverUnsecure = http.createServer()
		if (this.https)
			this.serverSecure = https.createServer(this)

		// HTTP2 only supports secure connections.
		if (this.http2)
			this.serverSecure = http2.createSecureServer(this)

		// Enable Node's HTTP2 implementation to fall back to HTTP1 api and support HTTPS with HTTP2 server.
		if (this.http)
			this.allowHTTP1 = true

		// HTTP2 does not support unsecure connections. Only HTTP1 with its 'request' event does.
		if (this.http)
			this.serverUnsecure.on('request', this.handleRequest)

		// All secure connections (either over HTTP2 or HTTPS) are primarily handled with 'request' event.
		// HTTP2 falls back to 'request' unless this.allowHTTP1 is false or undefined.
		// In other words: hybrid mode (HTTP2 with support for HTTP1S) will primarily use the older v1 'request' API.
		if (this.http2 && !this.allowHTTP1)
			this.serverSecure.on('stream', this.handleStream)
		else if (this.http2 || this.https)
			this.serverSecure.on('request', this.handleRequest)

		// Start listening (on both unsecure and secure servers in parallel).
		this.activeSockets = new Set
		return Promise.all([
			this.serverUnsecure && this._setupSubServer(this.serverUnsecure, this.portUnsecure, 'HTTP'),
			this.serverSecure && this._setupSubServer(this.serverSecure, this.portSecure, this.http2 ? 'HTTP2' : 'HTTPS'),
		])

		if (this.listening && this.debug !== false) {
			debug(`root: ${this.root}`)
			debug(`gzip: ${this.gzip}, cors: ${this.cors}, pushMode: ${this.pushMode}`)
		}
	}

	async _setupSubServer(server, port, name) {
		// Keep track of active sockets so the keep-alive ones can be manualy destroyed when calling .close()
		// because Node doesn't do it for and and leave's us hanging.
		server.on('connection', socket => {
			this.activeSockets.add(socket)
			socket.on('close', () => this.activeSockets.delete(socket))
		})
		try {
			// Start listening and print appropriate info.
			var listening = await this._listenSubServer(server, port)
			if (listening)
				this.logInfo(`${name} server listening on port ${port}`)
			else
				this.logError(`EADDRINUSE: Port ${port} taken. ${name} server could not start`)
		} catch(err) {
			this.logError(err)
		}
	}

	_listenSubServer(server, port) {
		return new Promise((resolve, reject) => {
			function onError(err) {
				if (err.code === 'EADDRINUSE') {
					server.removeListener('listening', onListen)
					server.close(() => resolve(false))
				} else {
					reject(err)
				}
				server.removeListener('error', onError)
			}
			function onListen() {
				server.removeListener('error', onError)
				resolve(true)
			}
			server.once('error', onError)
			server.once('listening', onListen)
			server.listen(port)
		})
	}


	// Alias for close()
	destroy() {this.close()}
	stop()    {this.close()}

	// Forcefuly close both servers.
	async close() {
		this.closing = true
		this._cleanup()
		this.closed = true
	}

	async _cleanup() {
		this.cache.stop()
		// Destroy all keep-alive and otherwise open sockets because Node won't do it for us and we'd be stuck.
		if (this.activeSockets)
			this.activeSockets.forEach(socket => socket.destroy())
		// Actually close the servers now.
		await Promise.all([
			this.serverUnsecure && this._closeSubServer(this.serverUnsecure, this.portUnsecure, 'HTTP'),
			this.serverSecure && this._closeSubServer(this.serverSecure, this.portSecure, this.http2 ? 'HTTP2' : 'HTTPS'),
		])
		// Remove refferences to the servers.
		this.serverSecure = undefined
		this.serverUnsecure = undefined
	}

	async _closeSubServer(server, port, name) {
		if (server && server.listening) {
			server.removeAllListeners()
			await new Promise(resolve => server.close(resolve))
			this.logInfo(`${name} server stopped listening on port ${port}`)
		}
	}


	// Handler for HTTP1 'request' event and shim differences between HTTP2 before it's passed to universal handler.
	handleRequest(req, res) {
		debug('\n-----------------------------------------------------')
		debug('###', req.method, 'request', req.httpVersion, req.url)
		this.handle(req, res)
	}

	// Handler for HTTP2 'request' event and shim differences between HTTP1 before it's passed to universal handler.
	// TODO: http2 & streams are broken now. 
	handleStream(stream, headers) {
		debug('\n-----------------------------------------------------')
		debug('###', headers[':method'], 'stream', headers[':path'])
		// http2 does not have any req-like object. Only headers. We need to create it ourselves.
		this.handle(new Request(headers), stream)
	}

	async handle(req, res) {
		try {
			req.res = res
			res.req = req
			req.server = res.server = this
			extendReqProto(req)
			extendResProto(res)
			var finished = await super.handle(req, res)
			if (finished) return
		} catch(err) {
			res.error(500, err)
		}
	}

	get listening() {
		var value = this.serverSecure   && this.serverSecure.listening
				 || this.serverUnsecure && this.serverUnsecure.listening
		return !!value
	}

	// TODO: replace console.log/error with different verbosity level of debug()
	logInfo(...args) {
		if (process.env.debug)
			debug(...args)
		else if (this.debug !== false)
			console.log(...args)
	}
	logError(...args) {
		if (process.env.debug)
			debug(...args)
		else if (this.debug !== false)
			console.error(...args)
	}

	// Mimicking EventEmiter and routing event handlers to both servers

	on(...args) {
		if (this.serverSecure)   this.serverSecure.on(...args)
		if (this.serverUnsecure) this.serverUnsecure.on(...args)
	}
	once(...args) {
		if (this.serverSecure)   this.serverSecure.once(...args)
		if (this.serverUnsecure) this.serverUnsecure.once(...args)
	}
	removeListener(...args) {
		if (this.serverSecure)   this.serverSecure.removeListener(...args)
		if (this.serverUnsecure) this.serverUnsecure.removeListener(...args)
	}
	removeAllListeners(...args) {
		if (this.serverSecure)   this.serverSecure.removeAllListeners(...args)
		if (this.serverUnsecure) this.serverUnsecure.removeAllListeners(...args)
	}

}



// TODO: move away from this with the middleware-ization of the library.

import * as optionsProto from './options.mjs'
import * as serveFileProto from './file.mjs'
import * as serveCgiProto from './cgi.mjs'
import * as certProto from './cert.mjs'
import * as headersProto from './headers.mjs'
import * as compressionProto from './compression.mjs'

var externalProto = [
	...Object.entries(optionsProto),
	...Object.entries(serveFileProto),
	...Object.entries(serveCgiProto),
	...Object.entries(certProto),
	...Object.entries(headersProto),
	...Object.entries(compressionProto),
]

for (var [name, method] of externalProto)
	AnchoraServer.prototype[name] = method
