import path from 'path'
import {HTTPCODE, debug} from './util.mjs'



import querystring from 'querystring'
export function queryParser(req, res) {
	req.query = {}
	// Sanitize url from secondary queries.
	// TODO: cram the sanitized url back into req (extension)
	var index = req.url.indexOf('?')
	if (index !== -1) {
		req.url2 = req.url.slice(0, index) // TODO
		var paramsString = req.url.slice(index + 1)
		req.query = querystring.parse(paramsString)
	}
}



export async function serveCertIfNeeded(req, res) {
	if (req.query.anchora === 'cert')
		return this.serveCert(req, res)
}

export async function handleHttpsRedirect(req, res) {
	// Upgrade unsecure HTTP requests to HTTPS if HTTPS is running and 'upgrade-insecure-requests' header
	// is set. Alternatively force redirect everyone all the time with options.forceUpgrade.
	var canUpgrade = !req.connection.encrypted && this.serverSecure && this.allowUpgrade !== false
	var upgradeRequested = req.headers['upgrade-insecure-requests'] === '1'
	if (canUpgrade && (this.forceUpgrade || upgradeRequested)) {
		var host = req.headers.host ? req.headers.host.split(':')[0] : 'localhost'
		var port = this.portSecure !== 443 ? ':' + this.portSecure : ''
		var redirectUrl = 'https://' + host + port + req.url
		res.setHeader('vary', 'upgrade-insecure-requests')
		return res.redirect(this.redirectCodeHttps, redirectUrl)
	}
}

export async function injectDescriptor(req, res) {
	let url = req.url2 || req.url // TODO: FIX
	// Collect stat, mime and other basic information about the file.
	req.desc = await this.openDescriptor(url)
}

export async function beforeServe(req, res) {
	var finished = false
	finished = await this.queryParser(req, res)
	if (finished) return
	finished = await this.serveCertIfNeeded(req, res)
	if (finished) return
	finished = await this.handleHttpsRedirect(req, res)
	if (finished) return
	finished = await this.injectDescriptor(req, res)
	if (finished) return
	// Copy user defined default headers into response.
	finished = await this.setDefaultHeaders(req, res)
	if (finished) return
	// Apply CORS headers if allowed.
	finished = await this.setCorsHeaders(req, res)
	if (finished) return
}

export async function serve(req, res) {
	debug('serve')
	let url = req.url2 || req.url // TODO: FIX

	//var finished = await this.handle(req, res)
	//if (finished) return

	if (req.desc.folder && !url.endsWith('/')) {
		debug('redirect, appending / slash to folder url')
		return res.redirect(301, url + '/')
	}

	// If requested index.html doesn't exist, redirect to the folder and render folder browser
	// instead of returning 404.
	if (this.folderBrowser) {
		var {desc} = req
		if (!desc.exists && desc.file && desc.name === this.indexFile) {
			debug(`redirecting to folder, index doesnt't exist`)
			var folderUrl = url.slice(0, url.lastIndexOf('/') + 1) || '/'
			return res.redirect(folderUrl)
		}
	}

	// File, nor folder doesn't exist. Throw 404.
	if (!req.desc.exists)
		return res.error(404)

	// Cancerous Security Policy.
	if (this.csp)
		res.setHeader('content-security-policy', this.csp)

	// Try to actually serve the file or folder (render list of contents).
	try {
		console.log('try serve')
		if (req.desc.folder) {
			let indexUrl = path.join(url, this.indexFile)
			let indexDesc = await this.openDescriptor(indexUrl)
			if (indexDesc.exists) {
				req.desc = indexDesc
				console.log('try serve folder index')
				return this.serveFile(req, res)
			} else {
				console.log('try serve folder data')
				return this.serveFolder(req, res)
			}
		} else if (req.desc.file) {
			console.log('try serve file')
			return this.serveFile(req, res)
		} else {
			console.log('try serve error')
			return res.error(400)
		}
	} catch(err) {
		return res.error(500, err)
	}
}