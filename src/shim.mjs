// Shims some http2 colon headers into http1 'req' object.
export function shimReqHttp2(req) {
	req.headers[':path'] = req.url
	req.headers[':method'] = req.method
	req.headers[':authority'] = req.host // ??
}

// Returns http1 like 'req' object out of http2 headers.
export function shimReqHttp1(headers) {
	return {
		url: headers[':path'],
		method: headers[':method'],
		headers,
	}
}

export function shimResMethods(stream) {
	//
	stream.stream = stream
	//
	stream._resHeaders = {}
	stream.setHeader = setHeader
	stream.getHeader = getHeader
	//
	stream.writeHead = writeHead
}

function getHeader(name) {
	return this._resHeaders[name]
}

function setHeader(name, value) {
	this._resHeaders[name] = value
}

function writeHead(code, resHeaders) {
	if (resHeaders)
		resHeaders = Object.assign(this._resHeaders, resHeaders)
	else
		resHeaders = this._resHeaders
	resHeaders[':status'] = code
	this.respond(resHeaders)
}
