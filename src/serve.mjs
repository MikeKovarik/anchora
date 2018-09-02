import path from 'path'
import {HTTPCODE, debug} from './util.mjs'


export async function serve(req, res) {

	//console.log('-----------------------------------------')
	//console.log('serve', req.url)

	var respondCertificate = false
	var serveJson = false

	// TODO: turn folder browser into middleware

	for (let middleware of this.middleware) {
		if (middleware.condition(req)) await middleware.handler(req, res)
		// TODO: detect if the middleware already pipes to res, or ended res and return if so.
	}

	// Sanitize url from secondary queries.
	let url = req.url
	var index = url.indexOf('?')
	if (index !== -1) {
		var content = url.slice(index + 1)
		url = url.slice(0, index)
		switch (content) {
			case 'anchora=cert': respondCertificate = true; break
			case 'anchora=json': serveJson = true; break
		}
	}

	if (respondCertificate)
		return this.serveCert(req, res)

	// Upgrade unsecure HTTP requests to HTTPS if HTTPS is running and 'upgrade-insecure-requests' header
	// is set. Alternatively force redirect everyone all the time with options.forceUpgrade.
	if ((!req.connection.encrypted && this.serverSecure && this.allowUpgrade !== false)
	&& (this.forceUpgrade || req.headers['upgrade-insecure-requests'] === '1')) {
		var host = req.headers.host ? req.headers.host.split(':')[0] : 'localhost'
		var port = this.portSecure !== 443 ? ':' + this.portSecure : ''
		var redirectUrl = 'https://' + host + port + req.url
		res.setHeader('vary', 'upgrade-insecure-requests')
		return res.redirect(this.redirectCodeHttps, redirectUrl)
	}

	// Collect stat, mime and other basic information about the file.
	var desc = await this.openDescriptor(url)

	if (desc.folder && !url.endsWith('/'))
		return res.redirect(301, url + '/')

	// If requested index.html doesn't exist, redirect to the folder and render folder browser
	// instead of returning 404.
	if (!desc.exists && this.folderBrowser && desc.name === 'index.html') {
		var folderUrl = url.slice(0, url.lastIndexOf('/') + 1) || '/'
		return res.redirect(folderUrl)
	}

	// File, nor folder doesn't exist. Throw 404.
	if (!desc.exists)
		return res.serveError(404, undefined, desc)

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
		if (desc.folder) {
			let indexUrl = path.join(url, this.indexFile)
			let indexDesc = await this.openDescriptor(indexUrl)
			if (indexDesc.exists)
				return this.serveFile(req, res, indexDesc)
			else
				return this.serveFolder(req, res, desc, serveJson)
		} else if (desc.file) {
			return this.serveFile(req, res, desc)
		} else {
			return res.serveError(400)
		}
	} catch(err) {
		return res.serveError(500, err)
	}
}

// TODO: move this elsewhere
export function getContentType(mime) {
	if (this.charset)
		return `${mime}; charset=${this.charset}`
	else
		return mime
}
