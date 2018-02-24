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

export function setCacheHeaders(req, res, desc) {
	// It is important to specify:
	// - one of 'expires' or 'cache-control' max-age
	// - one of 'last-modified' or 'etag'
	// It is redundant to specify both ('expires' and cc or modified and etag)
	var cacheControl = req.headers['cache-control'] || req.headers.pragma
	//console.log('cacheControl', cacheControl)
	if (cacheControl === 'no-cache' || cacheControl === 'max-age=0')
		return
	// A way to tell if the file is un/changed.
	// NOTE: if both 'last-modified' and 'etag' (or 'expires' and 'cache-control' max-age) were specified
	//       Chrome would never send 'if-none-match' or 'if-modified-since' headers, making 304 impossible.
	//       Local cache also likely eats all requests despite 'cache-control' 'must-revalidate'.
	if (this.maxAge === undefined) {
		// More reliable, HTTP 1.1 and 'must-revalidate' friendly way of determining file freshness.
		res.setHeader('etag', desc.etag)
		res.setHeader('cache-control', this.cacheControl)
	} else {
		// NOTE: Using time/date/age based makes Chrome store the files in local cache for the given ammount of time
		//       and never ask for them (not even for 304) until they're expired despite 'cache-control' 'must-revalidate'.
		res.setHeader('last-modified', desc.mtime.toUTCString())
		var expires = new Date(Date.now() + this.maxAge * 1000)
		res.setHeader('expires', expires.toUTCString())
	}
}