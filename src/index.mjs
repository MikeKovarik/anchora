import http from 'http'
import https from 'https'
import http2 from 'http2'
import path from 'path'
import {getOptions} from './options.mjs'
import {serve} from './handler.mjs'
import {loadOrGenerateCertificate} from './cert.mjs'
import {shimReqHttp2, shimReqHttp1, shimResMethods} from './shim.mjs'


export async function createServer(...args) {
	var options = getOptions(...args)

	// Enable Node's HTTP2 implementation to fall back to HTTP1 api and support HTTPS with HTTP2 server.
	if (options.version & 1)
		options.allowHTTP1 = true

	// Load or generate self-signed (for localhost and dev purposes only) certificates needed for HTTPS or HTTP2.
	if (options.secure)
		await loadOrGenerateCertificate(options)

	var serverUnsec
	var serverSec

	// HTTP1 can support both unsecure (HTTP) and secure (HTTPS) connections.
	if (options.version & 1) {
		if (options.unsecure)
			serverUnsec = http.createServer()
		if (options.secure)
			serverSec = https.createServer(options)
	}

	// HTTP2 only supports secure connections.
	if (options.version & 2)
		serverSec = http2.createSecureServer(options)

	// HTTP2 does not support unsecure connections. Only HTTP1 with its 'request' event does.
	if (options.unsecure) {
		serverUnsec.on('request', onRequest)
		serverUnsec.listen(options.port[0])
	}

	// All secure connections (either over HTTP2 or HTTPS) are primarily handled with 'request' event.
	// HTTP2 falls back to 'request' unless options.allowHTTP1 is false or undefined.
	// In other words: hybrid mode (HTTP2 with support for HTTP1S) will primarily use the older v1 'request' API.
	if (options.secure) {
		if (options.version & 2 && !options.allowHTTP1)
			serverSec.on('stream', onStream)
		else
			serverSec.on('request', onRequest)
		serverSec.listen(options.port[1])
	}

	// Handler for HTTP1 'request' event and shim differences between HTTP2 before it's passed to universal handler.
	function onRequest(req, res) {
		console.log('### onRequest', req.httpVersion, req.url)
		// Basic shims of http2 properties (http2 colon headers) on 'req' object.
		shimReqHttp2(req)
		// Serve the request with unified handler.
		serve(req, res, options)
	}

	// Handler for HTTP2 'request' event and shim differences between HTTP1 before it's passed to universal handler.
	function onStream(stream, headers) {
		console.log('### onStream')
		// Shims http1 like 'req' object out of http2 headers.
		var req = shimReqHttp1(headers)
		// Adds shimmed http1 like 'res' methods onto 'stream' object.
		shimResMethods(stream)
		console.log('shimmed', stream)
		// Serve the request with unified handler.
		serve(req, stream, options)
	}

	//server.on('listening', () => console.log('listening'))
	return [serverUnsec, serverSec]
}