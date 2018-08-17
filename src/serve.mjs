import path from 'path'
import {HTTPCODE, debug} from './util.mjs'


export async function serve(req, res) {

	// Upgrade unsecure HTTP requests to HTTPS if HTTPS is running and 'upgrade-insecure-requests' header
	// is set. Alternatively force redirect everyone all the time with options.forceUpgrade.
	if ((!req.connection.encrypted && this.serverSecure && this.allowUpgrade !== false)
	&& (this.forceUpgrade || req.headers['upgrade-insecure-requests'] === '1')) {
		var host = req.headers.host ? req.headers.host.split(':')[0] : 'localhost'
		var port = this.portSecure !== 443 ? ':' + this.portSecure : ''
		var redirectUrl = 'https://' + host + port + req.url
		res.setHeader('vary', 'upgrade-insecure-requests')
		return this.redirect(req, res, this.redirectCodeHttps, redirectUrl)
	}

	// Collect stat, mime and other basic information about the file.
	var desc = await this.openDescriptor(req.url)

	if (desc.folder && !req.url.endsWith('/'))
		return this.redirect(req, res, 301, req.url + '/')

	// If requested index.html doesn't exist, redirect to the folder and render folder browser
	// instead of returning 404.
	if (!desc.exists && this.folderBrowser && desc.name === 'index.html') {
		var sections = req.url.split('/')
		sections[sections.length - 1] = ''
		var folderUrl = sections.join('/') || '/'
		return this.redirect(req, res, folderUrl)
	}

	if (req.url.endsWith('?anchora=cert'))
		return this.serveCert(req, res)

	// File, nor folder doesn't exist. Throw 404.
	if (!desc.exists)
		return this.serveError(res, 404, undefined, desc)

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
			let url = req.url
			if (url.endsWith('?anchora=json'))
				url = url.slice(0, -13)
			let indexUrl = path.join(url, this.indexFile)
			let indexDesc = await this.openDescriptor(indexUrl)
			if (indexDesc.exists)
				return this.serveFile(req, res, indexDesc)
			else
				return this.serveFolder(req, res, desc)
		} else if (desc.file) {
			return this.serveFile(req, res, desc)
		} else {
			return this.serveError(res, 400)
		}
	} catch(err) {
		return this.serveError(res, 500, err)
	}
}

export function serveError(res, code, err = '', desc) {
	if (err)  console.error(err)
	if (desc) debug(desc.fsPath, code, HTTPCODE[code])
	var body = `${code} ${HTTPCODE[code]}\n${err}`
	res.setHeader('content-type', this.getContentType('text/plain'))
	res.setHeader('content-length', Buffer.byteLength(body))
	res.setHeader('cache-control', 'max-age=0')
	res.writeHead(code)
	res.write(body)
	res.end()
}

export function getContentType(mime) {
	if (this.charset)
		return `${mime}; charset=${this.charset}`
	else
		return mime
}

export async function redirect(req, res, code, location) {
	if (code !== undefined && location === undefined) {
		location = code
		code = this.redirectCode
	}
	res.setHeader('location', location)
	res.writeHead(code)
	res.end()
}