import path from 'path'
import {HTTPCODE} from './util.mjs'


export async function serve(req, res) {

	// Upgrade unsecure HTTP requests to HTTPS if HTTPS is running and 'upgrade-insecure-requests' header
	// is set. Alternatively force redirect everyone all the time with options.forceUpgrade.
	if ((!req.connection.encrypted && this.serverSecure && this.allowUpgrade !== false)
	&& (this.forceUpgrade || req.headers['upgrade-insecure-requests'] === '1')) {
		var securePort = this.port[1]
		var host = req.headers.host ? req.headers.host.split(':')[0] : 'localhost'
		var redirectUrl = 'https://'
						+ host
						+ (securePort !== 443 ? ':' + securePort : '')
						+ req.url
		res.setHeader('location', redirectUrl)
		res.setHeader('vary', 'upgrade-insecure-requests')
		res.writeHead(301)
		res.end()
		return
	}

	// Collect stat, mime and other basic information about the file.
	var desc = await this.openDescriptor(req.url)

	// File, nor folder doesn't exist. Throw 404.
	if (!desc.exists)
		return this.serveError(res, 404)

	// Copy user defined default headers into response.
	this.setDefaultHeaders(res)

	// Apply CORS headers if allowed.
	if (this.cors)
		this.setCorsHeaders(res)

	// Cancerous Security Policy.
	if (this.csp)
		res.setHeader('content-security-policy', this.csp)

	// Signaling for client that server doesn't/accepts range requests.
	if (!this.acceptRanges || this.acceptRanges === 'none')
		res.setHeader('accept-ranges', 'none')
	else
		res.setHeader('accept-ranges', 'bytes')

	// Try to actually serve the file or folder (render list of contents).
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
