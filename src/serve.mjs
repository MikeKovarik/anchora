import path from 'path'
import {HTTPCODE, debug} from './util.mjs'



import querystring from 'querystring'
export function queryParser(req, res) {
	req.safeUrl = req.url
	req.query = {}
	// Sanitize url from secondary queries.
	// TODO: cram the sanitized url back into req (extension)
	var index = req.url.indexOf('?')
	if (index !== -1) {
		req.safeUrl = req.url.slice(0, index) // TODO
		var paramsString = req.url.slice(index + 1)
		req.query = querystring.parse(paramsString)
	}
}

export async function serveCertIfNeeded(req, res) {
	if (req.query.anchora === 'cert')
		this.serveCert(req, res)
}

export async function injectDescriptor(req, res) {
	// Collect stat, mime and other basic information about the file.
	req.desc = await this.openDescriptor(req.safeUrl)
}

