// the same approach express does, extending req & res objects with custom proto.

// Note: express replaces __proto__ of raw res instance. We can't do that right now
// because we're normalizing both HTTP1 response class and HTTP2 stream class.
// Though we migh use our custom HttpResponse implementation to make two more classes
// both of which extend native node http classes and use those as __proto__

//import {IncomingMessage} from 'http' // HTTP 1 req
//import {Http2ServerRequest} from 'http2' // HTTP 2 backwards compatibility req

import http from 'http'
import https from 'https'
import http2 from 'http2'
import {HTTPCODE, debug} from './util.mjs'


class HttpResponse {

	async redirect(...args) {
		if (args.length === 2)
			var [code = 302, url] = args
		else
			var [code = 302] = args
		this.setHeader('location', url)
		this.writeHead(code)
		this.end()
	}

	// TODO: maybe rename to something simpler like just res.error() if possible.
	serveError(code = 500, err, desc) {
		if (err)  console.error(err)
		if (desc) debug(desc.fsPath, code, HTTPCODE[code])
		var body = [code, HTTPCODE[code], err].filter(a => a).join(' ')
		this.setHeader('content-type', this._anchora_.getContentType('text/plain'))
		this.setHeader('content-length', Buffer.byteLength(body))
		this.setHeader('cache-control', 'max-age=0')
		this.writeHead(code)
		this.write(body)
		this.end()
	}


	// Shims for HTTP2 stream object to look like HTTP1 res objects.

	static applyStream(stream) {
		if (!this.stream)
			this.stream = stream
		console.log('this._resHeaders = {}')
		this._resHeaders = {}
	}

	getHeader(name) {
		if (!this._resHeaders) console.log('PRAZDNE getHeader!')
		this._resHeaders = this._resHeaders || {}
		return this._resHeaders[name.toLowerCase()]
	}

	setHeader(name, value) {
		if (!this._resHeaders) console.log('PRAZDNE setHeader!')
		this._resHeaders = this._resHeaders || {}
		this._resHeaders[name.toLowerCase()] = value
	}

	writeHead(code = this.statusCode, resHeaders) {
		// TODO: handle case sensitivity of headers
		if (resHeaders)
			resHeaders = Object.assign(this._resHeaders, resHeaders)
		else
			resHeaders = this._resHeaders
		resHeaders[':status'] = code
		this.respond(resHeaders)
	}


}

// TODO: https

// HTTP 1 res
var {ServerResponse} = http
var protoServerResponse = createClassProto(ServerResponse, HttpResponse)
// HTTP 2 backwards compatibility res
var {Http2ServerResponse} = http2
var protoHttp2ServerResponse = createClassProto(Http2ServerResponse, HttpResponse)
// HTTP 2 all purpose stream (& push stream)
// WARNING: ServerHttp2Stream is not exported from 'http2' module as of version 10.0.x
var ServerHttp2Stream = undefined
var protoServerHttp2Stream = undefined

// Since we're combining 'http' and 'http2' modules and their different APIs, we need
// to ensure presence of basic methods like .setHeader() on the res and (sink) stream objects.
export function extendResProto(res) {
	if (res.stream && res.stream !== res)
		extendResProto(res.stream)
	var ctor = res.constructor
	if (ctor === ServerResponse) {
		res.__proto__ = protoServerResponse
	} else if (ctor === Http2ServerResponse) {
		res.__proto__ = protoHttp2ServerResponse
		HttpResponse.applyStream(res)
	} else if (ctor === ServerHttp2Stream) {
		extendStreamProto(res)
	} else if (ctor.name === 'ServerHttp2Stream') {
		// http2 does not export ServerHttp2Stream. We need to trap it first.
		ServerHttp2Stream = ctor
		protoServerHttp2Stream = createClassProto(ServerHttp2Stream, HttpResponse)
		extendStreamProto(res)
	}
}

function extendStreamProto(stream) {
	stream.__proto__ = protoServerHttp2Stream
	HttpResponse.applyStream(stream)
}

export function openPushStream(parentStream, url) {
	return new Promise((resolve, reject) => {
		parentStream.pushStream({':path': url}, (err, pushStream) => {
			// Adds shimmed http1 like 'res' methods onto 'stream' object.
			extendStreamProto(pushStream)
			if (err)
				reject(err)
			else
				resolve(pushStream)
		})
	})
}

function createClassProto(Source, Mixin) {
	var newProto = Object.create(Source.prototype)
	var mixinProto = Mixin.prototype
	Object
		// Get names of all methods of the mixin class.
		.getOwnPropertyNames(mixinProto)
		// Ignore constructor.
		.filter(name => name !== 'constructor')
		// Do not replace any existing methods.
		.filter(name => newProto[name] === undefined)
		// Apply mixin methods to the target proto.
		.forEach(name => newProto[name] = mixinProto[name])
	return newProto
}