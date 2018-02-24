import path from 'path'
import {debug, fs, HTTPCODE} from './util.mjs'
import {shimResMethods} from './shim.mjs'


var promiseTimeout = (millis = 0) => new Promise(resolve => setTimeout(resolve, millis))

export async function serve(req, res) {

	if (req.httpVersion !== '2.0'
	&&  this.upgradeInsecure
	&&  req.headers['upgrade-insecure-requests'] === '1') {
		res.setHeader('location', 'TODO!')
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
			this.serveError(res, 400)
	} catch(err) {
		console.error(err)
		this.serveError(res, 500, err)
	}
}


export async function serveFolder(req, res, desc) {
	debug('-----------------------------------------')
	debug('serveFolder', desc.url)
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
			this.serveError(res, 404, err)
	}
}


export async function serveFile(req, res, sink, desc) {
	debug('-----------------------------------------')
	debug('serveFile', req.httpVersion, desc.url)

	//var isHttp1Request = res === sink
	//var isHttp2Stream = res.stream !== undefined
	var isPushStream = res.stream !== undefined && res.stream !== sink

	// Set OK status by default.
	res.statusCode = 200

	if (sink && sink.setHeader === undefined)
		shimResMethods(sink)

	sink.setHeader('content-type', desc.mime)

	if (this.cacheControl !== false) {
		sink.setHeader('etag', desc.etag)
		sink.setHeader('last-modified', desc.mtime.toUTCString())
		if (isPushStream) {
			// todo: use settings to use or block etag.
			//sink.setHeader('etag', desc.etag)
			//sink.setHeader('last-modified', desc.mtime.toUTCString())
			// set etag and last modified
			// push stream does not have its own req.
		} else {
			// setcache headers based on req.
			//this.setCacheHeaders(req, res, desc, this)
			//if (!isPushStream && desc.isUnchanged(req, res)) {
			//	res.statusCode = 304
			//}
		}
		//this.setCacheHeaders(req, res, desc, this)
		// TODO: Dont necessarily return yet but check dependencies despite 304.
		//       Index may be unchanged but js dependecy migt have changed.
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
				res.statusCode = 206
			} else {
				// No ranges, or conditional if-range header failed. Return full file with 200.
			}
			this.setRangeHeaders(res)	
		}
	} else {
		sink.setHeader('accept-ranges', 'none')
	}

	if (sink.destroyed)
		return debug(desc.name, 'prematurely closing, stream destroyed')

	// Pushing peer dependencies can only be done in HTTP2 if parent stream
	// (of the initially requested file) exists and is still open.
	var canPush = this.pushStream && res.stream && res.stream.pushAllowed// && !isPushStream
	if (canPush && desc.isParseable()) {
		let deps = await desc.getDependencies()
		debug(desc.name, 'pushable dependencies', deps)
		if (deps.length && !res.stream.destroyed) {
			var promises = deps.map(url => this.pushFile(req, res, url))
			// Waiting for push streams to open (only to be open, not for files to be sent!)
			// before serving requested main file would cause closing of the main stream
			// and cancelation of all pushes (and their respective push streams).
			await Promise.all(promises)
		}
	}

	if (sink.destroyed)
		return debug(desc.name, 'prematurely closing, stream destroyed')

	// Now that we've taken care of push stream (and started pushing dependency files)
	// we can prevent unnecessay read and serving of file if it's unchanged.
	if (res.statusCode === 304) {
		debug(desc.name, 'unchanged, sending 304 and no data')
		sink.writeHead(res.statusCode)
		sink.end()
		return
	}

	debug(desc.name, 'reading file')
	var fileStream
	if (this.encoding === 'passive') {
		// TODO: try to get .gz file
		let gzippedDesc = await this.openDescriptor(desc.url + '.gz')
		if (gzippedDesc.exists) {
			debug(desc.name, 'using pre-gzipped', gzippedDesc.name, instead)
			fileStream = await gzippedDesc.getCachedStream(range)
		}
	}
	if (!fileStream)
		fileStream = await desc.getCachedStream(range)

	if (sink.destroyed)
		return debug(desc.name, 'prematurely closing, stream destroyed')

	if (this.encoding === 'active') {
		let compressor = this.createCompressorStream(req, res)
		fileStream = fileStream.pipe(compressor)
		sink.setHeader('transfer-encoding', 'chunked')
	} else if (range) {
		sink.setHeader('transfer-encoding', 'chunked')
	} else {
		sink.setHeader('content-length', desc.size)
	}

	debug(desc.name, 'sending data')
	sink.once('end', () => debug(desc.name, 'end'))
	sink.writeHead(res.statusCode)
	fileStream.pipe(sink)
	fileStream.once('error', err => this.serveError(sink, 500, err))
}

export async function pushFile(req, res, url) {
	debug(url, 'push initated')
	// Open file's descriptor to gather info about it. Always read the descriptor before file to ensure freshness (through etag).
	var desc = await this.openDescriptor(url)
	if (!desc.exists) return
	// Do not go on if the parent steam is already closed.
	if (res.stream.destroyed)
		return debug(desc.name, 'push canceled')
	try {
		// Open new push stream between server and client to serve as conduit for the file to be streamed.
		var pushStream = await openPushStream(res.stream, desc.url)
		debug(desc.name, 'push ready')
	} catch(err) {
		// Failed to open push stream.
		debug(desc.name, 'push canceled')
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