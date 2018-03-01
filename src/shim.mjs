// Shims some http2 colon headers into http1 'req' object.
export function shimHttp1ToBeLikeHttp2(req) {
	var {headers} = req
	if (headers.host === undefined)
		headers.host = headers[':authority']
	if (headers[':authority'] === undefined)
		headers[':authority'] = headers.host
	headers[':path'] = req.url
	headers[':method'] = req.method
	headers[':scheme'] = req.connection.encrypted ? 'https' : 'http'
}

// Returns http1 like 'req' object out of http2 headers.
export function createHttp1LikeReq(headers) {
	if (headers.host === undefined)
		headers.host = headers[':authority']
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
	return this._resHeaders[name.toLowerCase()]
}

function setHeader(name, value) {
	this._resHeaders[name.toLowerCase()] = value
}

function writeHead(code = this.statusCode, resHeaders) {
	// TODO: handle case sensitivity of headers
	if (resHeaders)
		resHeaders = Object.assign(this._resHeaders, resHeaders)
	else
		resHeaders = this._resHeaders
	resHeaders[':status'] = code
	this.respond(resHeaders)
}
