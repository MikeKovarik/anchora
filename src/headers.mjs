export function setCorsHeaders(res) {
	// Website you wish to allow to connect
	res.setHeader('access-control-allow-origin', '*')
	// Request methods you wish to allow
	res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
	// Request headers you wish to allow
	res.setHeader('access-control-allow-headers', 'X-Requested-With,content-type')
	// Set to true if you need the website to include cookies in the requests sent
	// to the API (e.g. in case you use sessions)
	res.setHeader('access-control-allow-credentials', true)
}

export function setCspHeaders(res) {
	// TODO CSP, 'Content-Security-Policy', 'Upgrade-Insecure-Requests'
}

export function setRangeHeaders(res) {
	// todo: If-Range
	// todo: Content-Range
}

export function handleRangeHeaders(req, res, sink, desc) {
	var range
	if (this.ranges) {
		sink.setHeader('accept-ranges', 'bytes')
		if (req.headers.range) {
			let ranges = this.parseRangeHeader(req)
			if (ranges) {
				// One or more ranges were requested.
				// WARNING: Multipart ranges are not yet supported.
				range = ranges[0]
				// TODO: 206 HAS TO BE SENT BACK INSTEAD OF 200 !!!!!!!!!!!!!
				res.statusCode = 206
			} else {
				// No ranges, or conditional if-range header failed. Return full file with 200.
			}
			this.setRangeHeaders(res)	
		}
	} else {
		sink.setHeader('accept-ranges', 'none')
	}
	return range
}

export function parseRangeHeader(req) {
	var ifRange = req.headers['if-range']
	if (ifRange) {
		// TODO
		// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Range
		var conditionFulfilled = false // TODO
		if (!conditionFulfilled)
			return
	}
	// todo: If-Range
	var {range} = req.headers
	return range
		.slice(range.indexOf('=') + 1)
		.split(',')
		.map(rangeString => {
			let split = rangeString.split('-')
			return {
				start: parseInt(split[0]),
				end:   parseInt(split[1])
			}
		})
}

export function setCacheControlHeaders(req, res, sink, desc, isPushStream) {
	var modified = desc.mtime.toUTCString()
	sink.setHeader('last-modified', modified)
	sink.setHeader('etag', desc.etag)

	// No need to set further cache headers for pushed files.
	if (isPushStream)
		return

	// Prevent additional cache realted headers if cache is explicitly disabled by the request.
	var cacheControl = req.headers['cache-control'] || req.headers.pragma
	if (cacheControl === 'no-cache' || cacheControl === 'max-age=0')
		return

	// Client sent us info about version of the file he has stored in browser cache.
	// If file hasn't changed since hte last time it was server, we might skip sending it again. 
	if (req.headers['if-none-match'] === desc.etag)
		res.statusCode = 304
	else if (req.headers['if-modified-since'] === modified)
		res.statusCode = 304

	// Finally set 'cache-control' header to either 'max-age=...' or 'must-revalidate'.
	if (this.maxAge === undefined) {
		// More reliable, HTTP 1.1 and 'must-revalidate' friendly way of determining file freshness.
		res.setHeader('cache-control', this.cacheControl)
	} else {
		// NOTE: Using time/date/age based makes Chrome store the files in local cache for the given ammount of time
		//       and never ask for them (not even for 304) until they're expired despite 'cache-control' 'must-revalidate'.
		var expires = new Date(Date.now() + this.maxAge * 1000)
		res.setHeader('expires', expires.toUTCString())
	}
}
