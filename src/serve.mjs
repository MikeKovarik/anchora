import querystring from 'querystring'


export function parseUrlQuery(req, res) {
	// Sanitize url from secondary queries.
	// TODO: cram the sanitized url back into req (extension)
	var index = req.url.indexOf('?')
	if (index !== -1) {
		req.safeUrl = req.url.slice(0, index) // TODO
		var paramsString = req.url.slice(index + 1)
		req.query = querystring.parse(paramsString)
	} else {
		req.safeUrl = req.url
		req.query = {}
	}
}

export async function serve404IfNotFound(req, res) {
	// File, nor folder doesn't exist. Throw 404.
	if (!req.desc.exists)
		return res.error(404)
}

