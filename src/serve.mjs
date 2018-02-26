import {HTTPCODE, isSecure} from './util.mjs'


export async function serve(req, res) {

	if ((!isSecure(req) && this.serverSecure)
	&& (this.forceUpgrade || req.headers['upgrade-insecure-requests'] === '1')) {
		var securePort = this.port[1]
		var redirectUrl = 'https://'
						+ req.headers.host.split(':')[0]
						+ (securePort !== 443 ? ':' + securePort : '')
						+ req.url
		res.setHeader('location', redirectUrl)
		res.setHeader('vary', 'upgrade-insecure-requests')
		res.writeHead(301)
		res.end()
		return
	}


	var desc = await this.openDescriptor(req.url)
	if (!desc.exists)
		return this.serveError(res, 404)

	if (this.headers) {
		for (var key in this.headers)
			res.setHeader(key, this.headers[key])
	}

	if (this.info)
		res.setHeader('server', this.info)

	if (this.cors)
		this.setCorsHeaders(res)

	try {
		if (desc.folder)
			this.serveFolder(req, res, desc)
		else if (desc.file)
			this.serveFile(req, res, res.stream || res, desc)
		else
			this.serveError(res, 400)
	} catch(err) {
		this.serveError(res, 500, err)
	}
}

export function serveError(res, code, err) {
	if (err)
		console.error(err)
	var body = `${code} ${HTTPCODE[code]}`
	if (err) body += ', ' + err
	res.setHeader('content-type', 'text/plain')
	res.setHeader('content-length', Buffer.byteLength(body))
	res.setHeader('cache-control', 'max-age=0')
	res.writeHead(code)
	res.write(body)
	res.end()
}
