import path from 'path'
import {debug, fs, HTTPCODE} from './util.mjs'
import {shimResMethods} from './shim.mjs'


export async function serveFile(req, res, sink, desc) {
	debug('-----------------------------------------')
	debug('serveFile', req.httpVersion, desc.url)

	//var isHttp1Request = res === sink
	//var isHttp2Stream = res.stream !== undefined
	var isPushStream = res.stream !== undefined && res.stream !== sink

	if (sink && sink.setHeader === undefined)
		shimResMethods(sink)

	// Set 200 OK status by default.
	res.statusCode = 200
	sink.setHeader('content-type', desc.mime)

	// TODO
	//if (this.csp)
	//	this.setCspHeaders(res)

	// Experimental!
	if (desc.ext === 'php')
		return this.serveCgi(req, res, sink, desc, this.phpPath)
	if (desc.ext === 'pl')
		return this.serveCgi(req, res, sink, desc, this.perlPath)

	if (this.cacheControl !== false)
		this.setCacheControlHeaders(req, res, sink, desc, isPushStream)

	var range = this.handleRangeHeaders(req, res, sink, desc)

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