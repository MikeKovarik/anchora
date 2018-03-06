import path from 'path'
import {debug, fs, HTTPCODE} from './util.mjs'
import {shimResMethods} from './shim.mjs'


// 'req' & 'res' = Are the 'http' module's basic methods for handling request and serving response
// 'sink'        = Is used in place of 'res' to simplify work with both 'http' and 'http2' modules.
//                 In case of 'http' module: 'sink' === 'res'
//                 In case of 'http' module: file's 'stream', ('res.stream' if allowHTTP1 is enabled)
//                                           or a dependency's pushstream
// 'desc'        = Url, paths and stat info about the file we're about to serve.
export async function serveFile(req, res, sink, desc) {

	//var isHttp1Request = res === sink
	//var isHttp2Stream = res.stream !== undefined
	var isPushStream = res.stream !== undefined && res.stream !== sink
	debug('-----------------------------------------')
	debug('serveFile', req.httpVersion, isPushStream ? 'push' : 'request', desc.url)

	// Since we're combining 'http' and 'http2' modules and their different APIs, we need
	// to ensure presence of basic methods like .setHeader() on the sink stream object.
	if (sink && sink.setHeader === undefined)
		shimResMethods(sink)

	// Set 200 OK status by default.
	sink.statusCode = 200
	sink.setHeader('content-type', desc.mime)

	// Experimental!
	if (this.phpPath && desc.ext === 'php')
		return this.serveCgi(req, res, sink, desc, this.phpPath)
	if (this.perlPath && desc.ext === 'pl')
		return this.serveCgi(req, res, sink, desc, this.perlPath)

	if (this.cacheControl !== false)
		this.setCacheControlHeaders(req, sink, desc, isPushStream)

	// Handle requests with 'range' header if allowed.
	// WARNING: Only partial implementation. Multipart requests not implemented.
	var range
	if (this.acceptRanges && req.headers.range && !isPushStream)
		range = this.handleRangeHeaders(req, res, desc)

	// Waiting for ssync operations to finish might've left us with closed stream.
	if (sink.destroyed)
		return debug(desc.name, 'prematurely closing, stream destroyed')

	// Pushing peer dependencies can only be done in HTTP2 if parent stream
	// (of the initially requested file) exists and is still open.
	var canPush = this.pushMode && res.stream && res.stream.pushAllowed// && !isPushStream
	if (canPush && desc.isParseable()) {
		let deps = await desc.getDependencies()
		debug(desc.name, 'pushable deps', Array.from(deps.keys()))
		if (deps.size && !sink.destroyed) {
			var promises = []
			for (let [depUrl, depDesc] of deps) {
				promises.push(this.pushFile(req, res, depDesc))
			}
			// Waiting for push streams to open (only to be open, not for files to be sent!)
			// before serving requested main file would cause closing of the main stream
			// and cancelation of all pushes (and their respective push streams).
			await Promise.all(promises)
		}
		debug(desc.name, 'dependency push streams opened')
	}

	// Waiting for ssync operations to finish might've left us with closed stream.
	if (sink.destroyed)
		return debug(desc.name, 'prematurely closing, stream destroyed')

	// Now that we've taken care of push stream (and started pushing dependency files)
	// we can prevent unnecessay read and serving of file if it's unchanged.
	if (sink.statusCode === 304) {
		debug(desc.name, 'unchanged, sending 304 and no data')
		sink.writeHead(sink.statusCode)
		sink.end()
		return
	}

	// Begin to actually reading the file (from disk or cache)
	debug(desc.name, 'getting file')
	var fileStream
	// Try to look for previously compressed file with .gz extension
	if (this.encoding === 'passive') {
		let gzippedDesc = await this.openDescriptor(desc.url + '.gz')
		if (gzippedDesc.exists) {
			sink.setHeader('content-encoding', 'gzip')
			debug(desc.name, 'using pre-gzipped', gzippedDesc.name, instead)
			fileStream = await gzippedDesc.getReadStream(range)
		}
	}
	// Read the original file if .gz file is not found or enabled 
	if (!fileStream)
		fileStream = await desc.getReadStream(range)

	// Waiting for ssync operations to finish might've left us with closed stream.
	if (sink.destroyed)
		return debug(desc.name, 'prematurely closing, stream destroyed')

	// Compress (mostly GZIP) the file if active encoding is enabled.
	if (this.encoding === 'active') {
		let compressor = this.createCompressorStream(req, sink)
		fileStream = fileStream.pipe(compressor)
		sink.setHeader('transfer-encoding', 'chunked')
	} else if (range) {
		sink.setHeader('transfer-encoding', 'chunked')
	} else {
		sink.setHeader('content-length', desc.size)
	}

	// And finally serve the file by piping its read stream into sink stream.
	debug(desc.name, 'sending data')
	sink.once('close', () => debug(desc.name, 'sent, stream closed'))
	sink.writeHead(sink.statusCode)
	fileStream.pipe(sink)
	fileStream.once('error', err => this.serveError(sink, 500, err))
}


export async function pushFile(req, res, desc) {
	debug(desc.name, 'push initated')
	try {
		// Open new push stream between server and client to serve as conduit for the file to be streamed.
		var pushStream = await openPushStream(res.stream, desc.url)
		debug(desc.name, 'push open')
	} catch(err) {
		// Failed to open push stream.
		debug(desc.name, 'push errored', err)
		return
	}
	// Open file's descriptor to gather info about it.
	if (desc.fileInfoRead !== true)
		await desc.readStat()
	// Do not go on if the parent steam is already closed.
	if (!desc.exists || res.stream.destroyed) {
		debug(desc.name, 'push canceled')
		pushStream.end()
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