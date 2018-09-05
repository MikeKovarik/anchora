import http from 'http'
import https from 'https'
import http2 from 'http2'
import {HTTPCODE, debug, createClassProto} from './util.mjs'


class HttpRequest {

}

// HTTP 1 req
var {IncomingMessage} = http
var protoIncomingMessage = createClassProto(IncomingMessage, HttpRequest)
// HTTP 2 backwards compatibility req
var {Http2ServerRequest} = http2
var protoHttp2ServerRequest = createClassProto(Http2ServerRequest, HttpRequest)

export function extendReqProto(req) {
	var ctor = req.constructor
	if (ctor === IncomingMessage)
		req.__proto__ = protoIncomingMessage
	else if (ctor === Http2ServerRequest)
		req.__proto__ = protoHttp2ServerRequest
}