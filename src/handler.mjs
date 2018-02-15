import path from 'path'
import {fs, MIME, ERRCODE, serveError} from './util.mjs'
import {getCachedReadStream, isFileUnchanged, setCacheHeaders} from './cache.mjs'
import {openDescriptor, compressStream} from './files.mjs'
import {renderFolder} from './renderer.mjs'


// Trims query strings (? and everything that follows in url).
function trimQuery(url) {
	var index = url.indexOf('?')
	if (index !== -1)
		return url.slice(0, index)
	return url
}

export async function serve(req, res, options) {
	// Unescapes special characters (%20 to space) and trims query (? and everything that follows)
	var url = trimQuery(decodeURI(req.url))
	// TODO: move trimming (and possibly even decoding) to openDescriptor
	// because parsed urls from files (http2 streaming) might contain ? or escaped chars.

/*
	if (req.httpVersion !== '2.0') {
		if (req.headers['upgrade-insecure-requests'] === '1') {
			res.setHeader('location', 'TODO!')
			res.setHeader('vary', 'upgrade-insecure-requests')
			res.writeHead(301)
			res.end()
		}
	}
*/
	console.log('serve', url)
	try {
		var desc = await openDescriptor(url, options.root)
	} catch(err) {
		console.log('-----------------------------------------')
		console.log('404', url)
		serveError(res, 404, err)
		return
	}

	// todo
	if (options.headers) {
		for (var key in options.headers)
			res.setHeader(key, options.headers[key])
	}

	if (options.info)
		res.setHeader('server', options.info)

	if (options.cors)
		setCorsHeaders(res)

	// TODO
	//if (options.csp)
	//	setCspHeaders(res, options)

	// TODO
	//if (options.range)
	//	setRangeHeaders(res, options)

	try {
		if (desc.folder)
			serveFolder(req, res, desc, options)
		else if (desc.file)
			serveFile(req, res, res.stream || res, desc, options)
		else
			serveError(res, 400)
	} catch(err) {
		console.error(err)
		serveError(res, 500, err)
	}
}


async function serveFolder(req, res, desc, options) {
	console.log('-----------------------------------------')
	console.log('dir', desc.url)
	var indexPath = path.join(desc.fsPath, options.indexFile)
	try {
		await fs.stat(indexPath)
		// Redirect to index.html.
		var indexUrl = path.join(desc.url, options.indexFile)
		res.setHeader('location', indexUrl)
		res.writeHead(301)
		res.end()
	} catch(err) {
		// Render contents of the folder.
		renderFolder(req, res, desc, options)
	}
}


import {stringifyStream, openReadStream, createEtag} from './files.mjs'
import {parse} from 'resource-url-extract'
import {fsCache} from './cache.mjs'

async function serveFile(req, res, sink, desc, options) {
	console.log('-----------------------------------------')
	//var serveType = res === sink || sink === undefined ? 'request' : 'stream'
	var reqType = res.stream === sink ? 'direct' : 'push'
	var serveType = res === sink ? 'request' : 'stream'
	var canPush = res.stream !== undefined
	console.log('serveFile', reqType, serveType, desc.url)
	//console.log('typeof res', typeof res)
	//console.log('typeof res.stream', typeof res.stream)
	//console.log('typeof sink', typeof sink)

	if (sink && sink.setHeader === undefined)
		shimResMethods(sink)
		//shimResMethods(res.stream)

	var etag = createEtag(desc)
	sink.setHeader('etag', etag)
	sink.setHeader('last-modified', desc.mtime.toGMTString())
	sink.setHeader('content-type', desc.mime)

	/*if (options.cacheControl !== false) {
		setCacheHeaders(req, res, desc, options)
		if (isFileUnchanged(req, res, desc)) {
			sink.writeHead(304)
			console.log(304)
			return sink.end()
		}
	}*/

	/*if (options.encoding === 'passive') {
		// TODO: try to get .gz file
	}*/

	var fileStream = openReadStream(desc)
	//var fileStream = getCachedReadStream(desc, options)

	if (options.stream && canPush && isParseable) {

		var isParseable = desc.ext // TODO
		if (isParseable) {
			var [fileStream, urlDependencies] = await todoBetterName(fileStream, desc, etag)
			//console.log('PUSH', urlDependencies)
			if (urlDependencies.length)
				pushFiles(req, res, desc, urlDependencies, options) // TODO: lookup all subdependencies
		}

		// Prevent further actions if this file is to be pushed but the session ended.
		if (canPush && res.stream.destroyed) return

	}

	/*if (options.encoding === 'active') {
		fileStream = compressStream(req, res, fileStream)
		// todo content-length of gzipped stream
		//sink.setHeader('content-length', ???)
	} else {
		sink.setHeader('content-length', desc.size)
	}*/

	console.log('writing to sink', req.url)
	sink.writeHead(res === sink ? 200 : undefined)
	fileStream.pipe(sink)

	/*function finish() {
		fileStream.removeListener('end', finish)
		fileStream.removeListener('error', finish)
		console.log('FINISH', desc)
		fs.close(desc.fd).then(() => console.log(desc.name, 'closed'))
	}
	fileStream.once('end', finish)
	fileStream.once('error', finish)*/

	fileStream.once('error', err => serveError(sink, 500, err))

}

async function todoBetterName(fileStream, desc, etag) {
	try {
	var cached = fsCache.retrieve(desc)
	if (cached && cached.dependencies && cached.desc && cached.desc.etag === etag) {
		return [fileStream, cached.dependencies]
	} else {
		// parse for the first time
		var urls
		var [newFileStream, fileString] = await stringifyStream(fileStream)
		var parsed = parse(fileString, desc.ext)
		if (parsed) {
			// store and load peers
			// Transform sub urls relative to directory into absolute urls starting at root.
			var dirUrl = path.parse(desc.url).dir
			// NOTE: it is necessary for url to use forward slashes / hence the path.posix methods
			urls = parsed.map(subUrl => path.posix.join(dirUrl, subUrl))
			// TODO: some options.cacheFiles option to store or not store the stream (separate from desc and parsed deps)
		} else {
			// no peers
			urls = []
		}
		fsCache.store(desc, undefined, urls)
		return [newFileStream, urls]
	}
} catch(err) {console.error(err)}
	console.log('DOPICEEEEEE')
}


import {shimResMethods} from './shim.mjs'

async function pushFiles(req, res, desc, urls, options) {
	urls.map(url => pushFile(req, res, desc, url, options))
}

async function pushFile(req, res, desc, url, options) {
	console.log('pushFile', desc.name)
	// Do not go on if the parent steam is already closed.
	if (res.stream.destroyed) return
	// Open file's descriptor to gather info about it. Always read the descriptor before file to ensure freshness (through etag).
	var desc = await openDescriptor(url, options.root)
	if (res.stream.destroyed) return
	// Open new push stream between server and client to serve as conduit for the file to be streamed.
	var pushStream = await openPushStream(res.stream, desc.url)
	console.log('open pushFile', desc.name)
	// Adds shimmed http1 like 'res' methods onto 'stream' object.
	shimResMethods(pushStream)
	// Push the file to client as over the newly opened push stream.
	serveFile(req, res, pushStream, desc, options)
}

function openPushStream(stream, url) {
	return new Promise((resolve, reject) => {
		stream.pushStream({':path': url}, (err, pushStream) => {
			if (err)
				reject(err)
			else
				resolve(pushStream)
		})
	})
}



function setCorsHeaders(res) {
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

function setCspHeaders(res, options) {
	// TODO CSP, 'Content-Security-Policy', 'Upgrade-Insecure-Requests'
}

function setRangeHeaders(res, options) {
	// todo: If-Range
	// todo: Content-Range
}


/*

const onRequestHandler = (req, res) => {  
	if (req.url === '/') {
		var file = {
			path: '/style.css',
			filePath: './style.css',
			headers: {'content-type': 'text/css'}
		}
		pushAsset(res.stream, file)
	}
}

const pushAsset = (stream, file) => {  
	const filePath = path.join(__dirname, file.filePath)
	stream.pushStream({ [HTTP2_HEADER_PATH]: file.path }, (pushStream) => {
		pushStream.respondWithFile(filePath, file.headers)
	})
}
*/

/*
function onError(res, err) {
	serveError(res, err.code === 'ENOENT' ? 404 : 500, err)
}
*/



