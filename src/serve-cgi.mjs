import urlModule from 'url'
import cp from 'child_process'
import util from 'util'
import {isSecure} from './util.mjs'


// BEWARE! Following code is an experimental implementation of CGI interface for
// running PHP and other scripting languages. Currently tightly coupled and not
// very well tested. Help and contributions are welcomed.

export async function serveCgi(req, res, sink, desc, cgiPath) {
	var env = this.createCgiEnv(req, sink, desc)
	var cgi = cp.spawn(cgiPath, [], {env})

	// POST body is piped to 'stdin' of the CGI.
	if (req.readable)
		req.pipe(cgi.stdin)
	else if (req.body)
		cgi.stdin.end(req.body)

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
			// Parse headers out of the stdout dump we've collected so far and write
			// it to the sink along with following first chunk of body.
			this.parseAndSendCgiHeaders(sink, stdout, headerSeparator)
			stdout = undefined
			// Remove this header-parsing listener and start piping straight into sink.
			cgi.stdout.removeListener('data', onData)
			cgi.stdout.pipe(sink)
		}
	}

	cgi.stdout.on('data', onData)

	var onError = err => this.serveError(sink, 500, err)
	cgi.stderr.once('data', onError)

	cgi.once('close', code => {
        if (code)
            console.error(`CGI exited with code ${code}`)
		cgi.stderr.removeListener('data', onError)
    })

}


export function parseAndSendCgiHeaders(sink, stdout, headerSeparator) {
	// Locate end of header / beggining of body
	var separatorLength = headerSeparator.length
	let index = stdout.indexOf(headerSeparator)
	// Parse headers created inside the script and apply them the response Node is creating.
	let headers = stdout.slice(0, index).split(separatorLength === 4 ? '\r\n' : '\n')
	for (var i = 0; i < headers.length; i++) {
		var [name, value] = headers[i].split(':')
		name = name.toLowerCase()
		// Status header has to be ignored and used for assigning res.statusCode.
		if (name === 'status') {
			sink.statusCode = parseInt(value)
			continue
		}
		sink.setHeader(name, value || '')
	}
	// Script might return chunked response instead of exactly sized one.
	if (!sink.getHeader('content-length'))
		sink.setHeader('transfer-encoding', 'chunked')
	sink.writeHead(sink.statusCode)
	// Also write the beggining of the body that remains to the sink. 
	let bodyChunk = stdout.slice(index + separatorLength)
	sink.write(bodyChunk)
}


export function createCgiEnv(req, sink, desc) {
	var uri = urlModule.parse(req.url)

	if (isSecure(req))
		var REQUEST_SCHEME = 'https'
	else
		var REQUEST_SCHEME = 'http'

	var root = this.root.replace(/\\/g, '\/')

	var env = {
		REDIRECT_STATUS: 200,
		GATEWAY_INTERFACE: 'CGI/1.1',
		SERVER_PROTOCOL: `HTTP/${req.httpVersion}`,
		//REQUEST_SCHEME,
		REQUEST_METHOD: req.method,
		QUERY_STRING: uri.query || '',
		REQUEST_URI: uri.href,
		SCRIPT_NAME: decodeURI(uri.pathname),
		SCRIPT_FILENAME: desc.fsPath.replace(/\\/g, '\/'),
		SERVER_ROOT: root,
		DOCUMENT_ROOT: root,
		CONTEXT_DOCUMENT_ROOT: root,
		SERVER_PORT: req.socket.localPort,
		SERVER_ADDR: req.socket.localAddress,
		REMOTE_ADDR: req.socket.remoteAddress,
		REMOTE_PORT: req.socket.remotePort,
		SERVER_SIGNATURE: `<address>${this.anchoraInfo}</address>`,
		SERVER_SOFTWARE: this.anchoraInfo,
		//PATH_INFO: '/',
	}

	// Passing headers from req.
	var headers = req.headers
	for (var name in req.headers) {
		if (name.startsWith(':'))
			continue // HTTP2 is to be solved sometime in the future. 
		env['HTTP_' + name.toUpperCase().replace(/-/g, '_')] = headers[name]
	}
	if (req.headers.authorization)
		env.AUTH_TYPE = req.headers.authorization.split(' ')[0]

	// These are critical for POST requests with body.
	// PHP Wouldn't know how long of a body to expect without content length.
	if (req.headers['content-length'])
		env.CONTENT_LENGTH = req.headers['content-length']
	if (req.headers['content-type'])
		env.CONTENT_TYPE = req.headers['content-type']
	//if (req.headers['transfer-encoding'])
	//	env.TRANSFER_ENCODING = req.headers['transfer-encoding']

	// Adding custom user headers.
	if (this.cgiEnv)
		Object.assign(env, cgiEnv)

	return env
}