import fsSync from 'fs'
import pathModule from 'path'
import util from 'util'
import nodeDebug from 'debug'


export var debug = nodeDebug('anchora')

var {promisify} = util
export var fs = {
	exists: promisify(fsSync.exists),
	access: promisify(fsSync.access),
	readdir: promisify(fsSync.readdir),
	readFile: promisify(fsSync.readFile),
	writeFile: promisify(fsSync.writeFile),
	open: promisify(fsSync.open),
	close: promisify(fsSync.close),
	stat: promisify(fsSync.stat),
	fstat: promisify(fsSync.fstat),
	createReadStream: fsSync.createReadStream,
	mkdir: promisify(fsSync.mkdir),
}

export const HTTPCODE = {
	200: 'OK',
	206: 'Partial Content',
	301: 'Moved Permanently',
	302: 'Moved Temporarily',
	304: 'Not Modified',
	400: 'Bad Request',
	403: 'Forbidden',
	404: 'Not Found',
	416: 'Requested Range Not Satisfiable',
	500: 'Internal Server Error',
}

export function exec(command) {
	return new Promise((resolve, reject) => {
		cp.exec(command, (error, stdout, stderr) => {
			if (error || stderr)
				reject(error || stderr)
			else
				resolve(stdout)
		})
	})
}

// Trims query strings (? and everything that follows in url).
function trimQuery(url) {
	var index = url.indexOf('?')
	if (index !== -1)
		return url.slice(0, index)
	return url
}

// Unescapes special characters and removes query and hashes.
export function sanitizeUrl(url) {
	return trimQuery(decodeURI(url))
}

export function isSecure(req) {
	var {name} = req.socket.constructor
	return name === 'TLSSocket'
		|| name === 'bound TLSSocket'
}