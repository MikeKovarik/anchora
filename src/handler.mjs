import path from 'path'
import {fs, MIME, HTTPCODE, serveError, sanitizeUrl} from './util.mjs'
import {shimResMethods} from './shim.mjs'


export async function serve(req, res) {
	// Unescapes special characters (%20 to space) and trims query (? and everything that follows)
	var url = sanitizeUrl(req.url)
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
	//console.log('serve', url)
	try {
		var desc = await this.openDescriptor(url)
	} catch(err) {
		//console.log('-----------------------------------------')
		//console.log('404', url)
		serveError(res, 404, err)
		return
	}

	if (this.headers) {
		for (var key in this.headers)
			res.setHeader(key, this.headers[key])
	}

	if (this.info)
		res.setHeader('server', this.info)

	if (this.cors)
		this.setCorsHeaders(res)

	// TODO
	//if (this.csp)
	//	this.setCspHeaders(res)

	// TODO
	//if (this.range)
	//	this.setRangeHeaders(res)

	try {
		if (desc.folder)
			this.serveFolder(req, res, desc)
		else if (desc.file)
			this.serveFile(req, res, res.stream || res, desc)
		else
			serveError(res, 400)
	} catch(err) {
		console.error(err)
		serveError(res, 500, err)
	}
}


export async function serveFolder(req, res, desc) {
	if (this.debug) {
		console.log('-----------------------------------------')
		console.log('dir', desc.url)
	}
	var indexPath = path.join(desc.fsPath, this.indexFile)
	try {
		// Trying to redirect to index.html.
		await fs.stat(indexPath)
		var indexUrl = path.join(desc.url, this.indexFile)
		res.setHeader('location', indexUrl)
		res.writeHead(301)
		res.end()
	} catch(err) {
		// Render contents of the folder if 'dirBrowser' is enabled or return 404.
		if (this.dirBrowser)
			this.renderFolder(req, res, desc, this)
		else
			serveError(res, 404, err)
	}
}


export async function serveFile(req, res, sink, desc) {
	if (this.debug) {
		console.log('-----------------------------------------')
		var reqType = res.stream === sink ? 'direct' : 'push'
		var serveType = res === sink ? 'request' : 'stream'
		console.log('serveFile', reqType, serveType, req.httpVersion, desc.url)
	}

	if (sink && sink.setHeader === undefined)
		shimResMethods(sink)

	sink.setHeader('content-type', desc.mime)

	if (this.cacheControl !== false) {
		//var etag = createEtag(desc)
		//sink.setHeader('etag', etag)
		//sink.setHeader('last-modified', desc.mtime.toUTCString())
		this.setCacheHeaders(req, res, desc, this)
		// TODO: how to go about 303 with push streams
		//if (this.isFileUnchanged(req, res, desc)) {
		//	sink.writeHead(304)
		//	sink.end()
		//	return
		//}
	}

	var range
	if (this.ranges) {
		sink.setHeader('accept-ranges', 'bytes')
		if (req.headers.range) {
			let ranges = this.parseRangeHeader(req)
			if (ranges) {
				// One or more ranges were requested.
				// WARNING: Multipart ranges are not yet supported.
				range = ranges[0]
				// TODO: 206 HAS TO BE SENT BACK INSTEAD OF 200 !!!!!!!!!!!!!
			} else {
				// No ranges, or conditional if-range header failed. Return full file with 200.
			}
			this.setRangeHeaders(res)	
		}
	} else {
		sink.setHeader('accept-ranges', 'none')
	}

	/*if (this.encoding === 'passive') {
		// TODO: try to get .gz file
	}*/

	var fileStream = await this.getCachedStream(desc, range)

	if (this.encoding === 'active') {
		fileStream = this.compressStream(req, res, fileStream)
		sink.setHeader('transfer-encoding', 'chunked')
	} else if (!this.ranges || this.ranges && !req.headers.range) {
		sink.setHeader('content-length', desc.size)
	}

	// Pushing peer dependencies can only be done in HTTP2 if parent stream
	// (of the initially requested file) exists and is still open.
	var canPush = this.pushStream && res.stream !== undefined
	if (canPush && this.isDescParseable(desc)) {
		let deps = await this.getDependencies(desc)
		if (this.debug) console.log('pushable dependencies', desc.name, deps)
		if (deps.length && !res.stream.destroyed) {
			var promises = deps.map(url => this.pushFile(req, res, url))
			// Waiting for push streams to open (only to be open, not for files to be sent!)
			// before serving requested main file would cause closing of the main stream
			// and cancelation of all pushes (and their respective push streams).
			await Promise.all(promises)
		}
	}

	sink.writeHead(res === sink ? 200 : undefined)
	if (this.debug) console.log('sending data', desc.url)
	fileStream.pipe(sink)

	fileStream.once('error', err => serveError(sink, 500, err))
}

export async function pushFile(req, res, url) {
	if (this.debug) console.log('push initated', url)
	// Open file's descriptor to gather info about it. Always read the descriptor before file to ensure freshness (through etag).
	var desc = await this.openDescriptor(url)
	// Do not go on if the parent steam is already closed.
	if (res.stream.destroyed) {
		if (this.debug) console.log('push canceled', desc.url)
		return
	}
	try {
		// Open new push stream between server and client to serve as conduit for the file to be streamed.
		var pushStream = await openPushStream(res.stream, desc.url)
		if (this.debug) console.log('push ready', desc.url)
	} catch(err) {
		if (this.debug) console.log('push canceled', desc.url)
		// Failed to open push stream.
		return
	}
	// Adds shimmed http1 like 'res' methods onto 'stream' object.
	shimResMethods(pushStream)
	// Push the file to client as over the newly opened push stream.
	this.serveFile(req, res, pushStream, desc)
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
