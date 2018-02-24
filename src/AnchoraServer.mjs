import http from 'http'
import https from 'https'
import http2 from 'http2'
import path from 'path'
import {normalizeOptions} from './options.mjs'
import {shimReqHttp2, shimReqHttp1, shimResMethods} from './shim.mjs'
import {AnchoraCache} from './cache.mjs'
import {debug} from './util.mjs'
import * as handlersProto from './handler.mjs'
import * as certProto from './cert.mjs'
import * as cacheProto from './cache.mjs'
import * as headersProto from './headers.mjs'
import * as filesProto from './files.mjs'
import * as dirBrowserProto from './dirBrowser.mjs'


// TODO: aggresive / optimized push stream settings
// TODO: standard based (preload) push streams
// TODO: (delayed) parsing dependencies (style.css should later in later requests include fonts.css)
// TODO: tweaks to pushStream (when to read file stat and open stream)
// TODO: non blocking parsing of subdependencies (dependecies in pushstream)
// TODO: CSP headers
// TODO: CORS headers
// TODO: range headers
// TODO: TEST upgrade requests and headers (http redirecting to https)

export class AnchoraServer {

	constructor(...args) {
		var options = normalizeOptions(...args)
		this.setup(options)
	}

	async setup(options) {
		Object.assign(this, options)

		this.cache = new AnchoraCache(options)

		this.onRequest = this.onRequest.bind(this)
		this.onStream = this.onStream.bind(this)

		// Enable Node's HTTP2 implementation to fall back to HTTP1 api and support HTTPS with HTTP2 server.
		if (this.version & 1)
			this.allowHTTP1 = true

		// Load or generate self-signed (for localhost and dev purposes only) certificates needed for HTTPS or HTTP2.
		if (this.secure)
			await this.loadOrGenerateCertificate()

		// HTTP1 can support both unsecure (HTTP) and secure (HTTPS) connections.
		if (this.version & 1) {
			if (this.unsecure)
				this.serverUnsecure = http.createServer()
			if (this.secure)
				this.serverSecure = https.createServer(this)
		}

		// HTTP2 only supports secure connections.
		if (this.version & 2)
			this.serverSecure = http2.createSecureServer(this)

		// HTTP2 does not support unsecure connections. Only HTTP1 with its 'request' event does.
		if (this.unsecure) {
			this.serverUnsecure.on('request', this.onRequest)
			this.serverUnsecure.listen(this.port[0], err => {
				if (err)
					console.error(err)
				else if (this.debug)
					console.log(`HTTP1 unsecure server listening on port ${this.port[0]}`)
			})
		}

		// All secure connections (either over HTTP2 or HTTPS) are primarily handled with 'request' event.
		// HTTP2 falls back to 'request' unless this.allowHTTP1 is false or undefined.
		// In other words: hybrid mode (HTTP2 with support for HTTP1S) will primarily use the older v1 'request' API.
		if (this.secure) {
			if (this.version & 2 && !this.allowHTTP1)
				this.serverSecure.on('stream', this.onStream)
			else
				this.serverSecure.on('request', this.onRequest)
			this.serverSecure.listen(this.port[1], err => {
				if (err)
					console.error(err)
				else if (this.debug)
					console.log(`${this.version & 2 ? 'HTTP2' : 'HTTPS'} secure server listening on port ${this.port[1]}`)
			})
		}

		if (process.env.debug) {
			process.on('unhandledRejection', dump => {
				console.log('unhandledRejection', dump)
			})
			process.on('uncaughtException', dump => {
				console.log('uncaughtException', dump)
			})
		}

	}

	// Handler for HTTP1 'request' event and shim differences between HTTP2 before it's passed to universal handler.
	onRequest(req, res) {
		debug('\n###', req.method, 'request', req.httpVersion, req.url)
		// Basic shims of http2 properties (http2 colon headers) on 'req' object.
		shimReqHttp2(req)
		// Serve the request with unified handler.
		this.serve(req, res)
	}

	// Handler for HTTP2 'request' event and shim differences between HTTP1 before it's passed to universal handler.
	onStream(stream, headers) {
		debug('\n###', req.method, 'stream', req.url)
		// Shims http1 like 'req' object out of http2 headers.
		var req = shimReqHttp1(headers)
		// Adds shimmed http1 like 'res' methods onto 'stream' object.
		shimResMethods(stream)
		// Serve the request with unified handler.
		this.serve(req, stream)
	}

	async close() {
		// TODO. promisify and handle 'close' event and errors.
		if (this.serverSecure)
			this.serverSecure.close()
		if (this.serverUnsecure)
			this.serverUnsecure.close()
	}

}


for (var [name, method] of Object.entries(handlersProto))
	AnchoraServer.prototype[name] = method

for (var [name, method] of Object.entries(certProto))
	AnchoraServer.prototype[name] = method

for (var [name, method] of Object.entries(cacheProto))
	AnchoraServer.prototype[name] = method

for (var [name, method] of Object.entries(headersProto))
	AnchoraServer.prototype[name] = method

for (var [name, method] of Object.entries(filesProto))
	AnchoraServer.prototype[name] = method

for (var [name, method] of Object.entries(dirBrowserProto))
	AnchoraServer.prototype[name] = method

