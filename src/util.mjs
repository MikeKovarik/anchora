import fsSync from 'fs'
import pathModule from 'path'
import util from 'util'
var {promisify} = util


// TODO: remove
process.on('unhandledRejection', reason => {
	console.log('unhandledRejection', reason)
})
process.on('uncaughtException', reason => {
	console.log('uncaughtException', reason)
})

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

export const MIME = {
	html: 'text/html',
	png:  'image/png',
	js:   'text/javascript',
	mjs:  'text/javascript',
	css:  'text/css',
	json: 'application/json',
	// images
	svg:  'image/svg+xml',
	ico:  'image/x-icon',
	jpeg: 'image/jpeg',
	jpg:  'image/jpeg',
	png:  'image/png',
	// music
	wav:  'audio/wav',
	mp3:  'audio/mpeg',
	// documents
	pdf:  'application/pdf',
	md:   'text/markdown',
	doc:  'application/msword',
	txt:  'text/plain',
}

export const ERRCODE = {
	200: 'OK',
	206: 'Partial Content',
	301: 'Moved Permanently',
	302: 'Moved Temporarily',
	400: 'Bad Request',
	403: 'Forbidden',
	404: 'Not Found',
	500: 'Internal Server Error',
}

export function getMime(ext) {
	return MIME[ext] || 'text/plain'
}

export function serveError(res, code, err) {
	var body = `${code} ${ERRCODE[code]}`
	if (err) body += ', ' + err
	res.setHeader('content-type', 'text/plain')
	res.setHeader('content-length', Buffer.byteLength(body))
	res.setHeader('cache-control', 'max-age=0')
	res.writeHead(code)
	res.write(body)
	res.end()
}
