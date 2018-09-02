export function setDefaultHeaders(res) {
	// Copy user defined default headers into response.
	if (this.headers)
		for (var key in this.headers)
			res.setHeader(key, this.headers[key])
	// Assign headers with information about Anchora and version.
	res.setHeader('server', this.anchoraInfo)
	res.setHeader('x-powered-by', this.anchoraInfo)
}

export function setCorsHeaders(res) {
	// Website you wish to allow to connect
	var origin = typeof this.cors === 'string' ? this.cors : this.corsOrigin
	res.setHeader('access-control-allow-origin', origin)
	// Request methods you wish to allow
	res.setHeader('access-control-allow-methods', this.corsMethods)
	// Request headers you wish to allow
	res.setHeader('access-control-allow-headers', this.corsHeaders)
	// Set to true if you need the website to include cookies in the requests sent
	// to the API (e.g. in case you use sessions)
	res.setHeader('access-control-allow-credentials', this.corsCredentials)
}

export function handleRangeHeaders(req, res, desc) {
	var rangeHeader = req.headers.range
	var ifRangeHeader = req.headers['if-range']
	if (ifRangeHeader) {
		// TODO
		// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Range
		var conditionFulfilled = false // TODO
		if (!conditionFulfilled)
			return
	}
	// TODO: If-Range
	var ranges = rangeHeader
		.slice(rangeHeader.indexOf('=') + 1)
		.split(',')
		.map(rangeString => {
			let split = rangeString.split('-')
			return {
				start: parseInt(split[0]),
				end:   split[1] ? parseInt(split[1]) : undefined
			}
		})

	if (ranges && ranges.length) {
		// One or more ranges were requested.
		// WARNING: Multipart ranges are not yet supported.
		var range = ranges[0]
		if (validateRange(range, desc)) {
			res.statusCode = 206
		} else {
			res.statusCode = 416
			range = undefined
		}
		return range
	} else {
		// No ranges, or conditional if-range header failed. Return full file with 200.
	}
}

function validateRange(range, desc) {
	// NOTE: End value that is beyond the size of the file is actualy valid and OK.
	return range.start >= 0
		&& range.start < desc.size
		//&& (range.end === undefined || range.end < desc.size)
}


export function setCacheControlHeaders(req, sink, desc, isPushStream) {
	var modified = desc.mtime.toUTCString()
	//console.log('name', desc.name)
	//console.log('folder', desc.folder)
	//console.log('file', desc.file)
	//console.log('etag', desc.etag)
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
	var ifNoneMatch = req.headers['if-none-match']
	// NOTE: 'if-none-match' could contain list of etags and those might or might not be prepended with W/ and wrapped in quotes.
	if (ifNoneMatch && ifNoneMatch.includes(desc._etag))
		sink.statusCode = 304
	else if (req.headers['if-modified-since'] === modified)
		sink.statusCode = 304

	// Finally set 'cache-control' header to either 'max-age=...' or 'must-revalidate'.
	if (this.maxAge === undefined) {
		// More reliable, HTTP 1.1 and 'must-revalidate' friendly way of determining file freshness.
		sink.setHeader('cache-control', this.cacheControl)
	} else {
		// NOTE: Using time/date/age based makes Chrome store the files in local cache for the given ammount of time
		//       and never ask for them (not even for 304) until they're expired despite 'cache-control' 'must-revalidate'.
		var expires = new Date(Date.now() + this.maxAge * 1000)
		sink.setHeader('expires', expires.toUTCString())
	}
}
