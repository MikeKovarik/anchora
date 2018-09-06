import http from 'http'
import https from 'https'
import http2 from 'http2'
import {HTTPCODE, debug, createClassProto} from './util.mjs'


export class Request {

	// Constructor is only called with HTTP2 headers object.
	// In HTTP1 we're sing already existing req instance and just applying this proto.
	constructor(headers) {
		this.url = headers[':path']
		this.method = headers[':method']
		this.headers = headers
		var encrypted = headers[':scheme'] === 'https'
		this.connection = {encrypted}
		this.httpVersion = '2.0'
	}

	_shimHeaders() {
		var {headers} = this
		if (headers.host === undefined)
			headers.host = headers[':authority']
		if (headers[':authority'] === undefined)
			headers[':authority'] = headers.host
		if (headers[':path'] === undefined)
			headers[':path'] = this.url
		if (headers[':method'] === undefined)
			headers[':method'] = this.method
		if (headers[':scheme'] === undefined)
			headers[':scheme'] = this.connection.encrypted ? 'https' : 'http'
	}

	getHeaders() {
		return this.headers
	}

	getHeaderNames() {
		return Object.getOwnPropertyNames(this.headers)
	}

}

// HTTP 1 req
var {IncomingMessage} = http
var protoIncomingMessage = createClassProto(IncomingMessage, Request)
// HTTP 2 backwards compatibility req
var {Http2ServerRequest} = http2
var protoHttp2ServerRequest = createClassProto(Http2ServerRequest, Request)

export function extendReqProto(req) {
	var ctor = req.constructor
	if (ctor === IncomingMessage)
		req.__proto__ = protoIncomingMessage
	else if (ctor === Http2ServerRequest)
		req.__proto__ = protoHttp2ServerRequest
	req._shimHeaders()
}