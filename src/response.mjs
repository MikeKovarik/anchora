import http from 'http'
import https from 'https'
import http2 from 'http2'
import path from 'path'
import {fs} from './util.mjs'
import {HTTPCODE, debug, createClassProto} from './util.mjs'
import __dirname from './dirname'


var errorHtml
fs.readFile(path.join(__dirname, './error.html'))
	.then(buffer => errorHtml = buffer.toString())

function prettyPrintHeaders(source) {
	var longest = source.getHeaderNames()
		.map(header => header.length)
		.reduce((a, b) => a > b ? a : b)
	return Object.entries(source.getHeaders())
		.map(([header, value]) => `${header.padEnd(longest, ' ')}: ${value}`)
		.join('\n')
}

class Response {

	async redirect(...args) {
		if (args.length === 2)
			var [code, url] = args
		else
			var [code] = args
		this.setHeader('location', url)
		this.statusCode = code || this.statusCode || 302
		this.end()
		return this
	}

	preventCaching() {
		//this.setHeader('cache-control', 'max-age=0')
		this.setHeader('cache-control', 'no-cache, no-store, must-revalidate')
		this.setHeader('pragma', 'no-cache')
		this.setHeader('expires', '0')
	}

	error(code = 500, err) {
		if (err)  console.error(err)
		if (desc) debug(desc.fsPath, code, HTTPCODE[code])
		this.preventCaching()
		this.statusCode = code
		var {req, server} = this
		var desc = this.req && this.req.desc
		var title = `${code} ${HTTPCODE[code]}`
		var html = `<h1>Error ${title}</h1>`
		if (req) {
			if (server.verboseError)
				html += `<h2>Requested URL</h2>`
			html += `<p><code>${req.method} ${req.url}</code></p>`
			html += `<p><code>${req.headers[':scheme']} ${req.httpVersion} ${req.headers.host}</code></p>`
		}
		if (desc) {
			if (server.unsafeError) {
				if (server.verboseError)
					html += `<h2>Mapped FS</h2>`
				html += `<p><code>${desc.fsPath}</code></p>`
			}
		}
		if (err) {
			if (server.verboseError)
				html += `<h2>Error message</h2>`
			html += `<p>${err || ''}</p>`
		}
		if (server.verboseError) {
			if (req) {
				html += `
					<h2>Request headers</h2>
					<pre>${prettyPrintHeaders(req)}</pre>
				`
			}
			html += `
				<h2>Response headers</h2>
				<pre>${prettyPrintHeaders(this)}</pre>
			`
		}

		html = errorHtml
			.replace('<title></title>', `<title>${title}</title>`)
			.replace('<body></body>', `<body>\n${html}\n</body>`)

		return this.html(html)
	}

	status(code = 200) {
		this.statusCode = code
		return this
	}

	// Send a JSON response.
	json(data) {
		this.setHeader('content-type', 'application/json')
		return this.send(JSON.stringify(data))
	}

	html(data) {
		this.setHeader('content-type', 'text/html')
		return this.send(data)
	}

	text(data) {
		this.setHeader('content-type', 'text/plain')
		return this.send(data)
	}

	// Send a response of various types.
	send(data) {
		var buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
		this.setHeader('content-length', buffer.length)
		this.writeHead(this.statusCode || 200)
		this.write(buffer)
		this.end()
		return this
	}

	// Set the response status code and send its string representation as the response body.
	//sendStatus() {}

	header(name) {
		this.get(name)
		return this
	}

	get(name) {
		return this.getHeader(name)
	}

	set(name, value) {
		// TODO: handle content-type charset like express
		value = Array.isArray(value) ? value.map(String) : String(value)
		name = name.toLowerCase()
		return this.setHeader(name, value)
	}


	// Shims for HTTP2 stream object to look like HTTP1 res objects.

	static applyStream(stream) {
		if (!this.stream)
			this.stream = stream
		this._resHeaders = {}
	}

	getHeader(name) {
		//this._resHeaders = this._resHeaders || {}
		return this._resHeaders[name.toLowerCase()]
	}

	setHeader(name, value) {
		//this._resHeaders = this._resHeaders || {}
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
var protoServerResponse = createClassProto(ServerResponse, Response)
// HTTP 2 backwards compatibility res
var {Http2ServerResponse} = http2
var protoHttp2ServerResponse = createClassProto(Http2ServerResponse, Response)
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
		Response.applyStream(res)
	} else if (ctor === ServerHttp2Stream) {
		extendStreamProto(res)
	} else if (ctor.name === 'ServerHttp2Stream') {
		// http2 does not export ServerHttp2Stream. We need to trap it first.
		ServerHttp2Stream = ctor
		protoServerHttp2Stream = createClassProto(ServerHttp2Stream, Response)
		extendStreamProto(res)
	}
}

function extendStreamProto(stream) {
	stream.__proto__ = protoServerHttp2Stream
	Response.applyStream(stream)
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