import cp from 'child_process'
import util from 'util'


// BEWARE! Following code is an experimental implementation of CGI interface for
// running PHP and other scripting languages. Currently tightly coupled and not
// very well tested. Help and contributions are welcomed.

// This only supports GET requests. POST is to be solved sometime in the future.
export async function serveCgi(req, res, sink, desc, cgiPath) {
	var env = this.createCgiEnv(req, res, sink, desc)
	var cgi = cp.spawn(cgiPath, {env})

	var stdout = ''
	var onData = buffer => {
		var string = buffer.toString()
		stdout += string
		var headerSeparator
		if (string.includes('\r\n\r\n'))
			headerSeparator = '\r\n\r\n'
		else
			headerSeparator = '\n\n'
		if (headerSeparator !== undefined) {
			stdout = undefined
			// Parse headers out of the stdout dump we've collected so far and write
			// it to the sink along with following first chunk of body.
			this.parseAndSendCgiHeaders(sink, stdout, headerSeparator)
			// Remove this header-parsing listener and start piping straight into sink.
			cgi.stdout.removeListener('data', onData)
			cgi.stdout.pipe(sink)
		}
	}

	cgi.stdout.on('data', onData)
}


export function parseAndSendCgiHeaders(sink, stdout, headerSeparator) {
	var separatorLength = headerSeparator.length
	let index = stdout.indexOf(headerSeparator)

	let headers = stdout.slice(0, index).split(separatorLength === 4 ? '\r\n' : '\n')
	var header
	for (var i = 0; i < headers.length; i++) {
		header = headers[i].split(':')
		sink.setHeader(header[0], header[1] || '')
	}

	if (!sink.getHeader('content-length'))
		sink.setHeader('transfer-encoding', 'chunked')
	sink.writeHead(sink.statusCode)

	let bodyChunk = stdout.slice(index + separatorLength)
	sink.write(bodyChunk)
}


export function createCgiEnv(req, res, sink, desc) {
	var url = req.url
	var SCRIPT_NAME = url
	var QUERY_STRING = ''
	if (url.includes('?')) {
		let index = url.indexOf('?')
		QUERY_STRING = url.slice(index + 1)
		SCRIPT_NAME = url.slice(0, index)
	}
	SCRIPT_NAME = decodeURI(SCRIPT_NAME)
	if (req.httpVersion) {
		var SERVER_PROTOCOL = `HTTP/${req.httpVersion}`
	}
	if (req.socket.constructor.name === 'TLSSocket')
		var REQUEST_SCHEME = 'https'
	else
		var REQUEST_SCHEME = 'http'
	var DOCUMENT_ROOT = this.root.replace(/\\/g, '\/')
	var SCRIPT_FILENAME = desc.fsPath.replace(/\\/g, '\/')
	var env = {
		REDIRECT_STATUS: 200,
		GATEWAY_INTERFACE: 'CGI/1.1',
		QUERY_STRING,
		SERVER_PROTOCOL,
		REQUEST_SCHEME,
		REQUEST_URI: url,
		DOCUMENT_ROOT,
		CONTEXT_DOCUMENT_ROOT: DOCUMENT_ROOT,
		SCRIPT_NAME,
		SCRIPT_FILENAME,
		SERVER_PORT: req.socket.localPort,
		SERVER_ADDR: req.socket.localAddress,
		REMOTE_ADDR: req.socket.remoteAddress,
		REQUEST_METHOD: req.method,
		SERVER_SIGNATURE: this.info,
		SERVER_SOFTWARE: this.info,
		//PATH_INFO, // shouldn't be set because it along with SCRIPT_NAME affects PHP_SELF
	}
	var headers = req.headers
	Object.keys(headers)
		.filter(header => !header.startsWith(':')) // HTTP2 is to be solved sometime in the future. 
		.forEach(header => env['HTTP_' + kebabToSnake(header)] = headers[header])
	if (this.cgiEnv)
		Object.assign(env, cgiEnv)
	return env
}


function kebabToSnake(string) {
	return string.toUpperCase().replace(/-/g, '_')
}