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