import path from 'path'
import {debug, fs, HTTPCODE} from './util.mjs'
import {shimResMethods} from './shim.mjs'


// 'req' & 'res' = Are the 'http' module's basic methods for handling request and serving response
// 'sink'        = Is used in place of 'res' to simplify work with both 'http' and 'http2' modules.
//                 In case of 'http' module: 'sink' === 'res'
//                 In case of 'http' module: file's 'stream', ('res.stream' if allowHTTP1 is enabled)
//                                           or a dependency's pushstream
// 'desc'        = Url, paths and stat info about the file we're about to serve.
export async function serveFile(req, res, desc, sink = res.stream || res) {
	//var isHttp1Request = res === sink
	//var isHttp2Stream = res.stream !== undefined
	var isPushStream = res.stream !== undefined && res.stream !== sink
	debug('-----------------------------------------')
	debug('serveFile', req.httpVersion, isPushStream ? 'push' : 'request', desc.url)

	//console.log('-----------------------------------------')
	//console.log('serveFile', desc.url)
	//console.log('isPushStream', isPushStream, req.httpVersion)

	// Since we're combining 'http' and 'http2' modules and their different APIs, we need
	// to ensure presence of basic methods like .setHeader() on the sink stream object.
	if (sink && sink.setHeader === undefined)
		shimResMethods(sink)

	// Set 200 OK status by default.
	sink.statusCode = 200
	sink.setHeader('content-type', this.getContentType(desc.mime))

	// Experimental plugins
	if (this.plugins[desc.ext]) {
		try {
			let result = await this.plugins[desc.ext](req, res, sink, desc)
			if (result !== undefined) {
				sink.writeHead(200)
				sink.write(result)
				sink.end()
			}
		} catch(err) {
			this.serveError(sink, 500, err)
		}
		return
	}

	// Experimental CGI (PHP)!
	if (this.cgi) {
		if (this.phpPath && desc.ext === 'php')
			return this.serveCgi(req, res, sink, desc, this.phpPath)
		if (this.rubyPath && desc.ext === 'rb')
			return this.serveCgi(req, res, sink, desc, this.rubyPath)
		if (this.perlPath && desc.ext === 'pl')
			return this.serveCgi(req, res, sink, desc, this.perlPath)
	}

	if (this.cacheControl !== false)
		this.setCacheControlHeaders(req, sink, desc, isPushStream)

	// Handle requests with 'range' header if allowed.
	// WARNING: Only partial implementation. Multipart requests not implemented.
	var range
	if (this.acceptRanges && req.headers.range && !isPushStream)
		range = this.handleRangeHeaders(req, res, desc)

	// Waiting for ssync operations to finish might've left us with closed stream.
	if (sink.destroyed)
		return debug(desc.name, 'cancelled, stream is closed')

	// Pushing peer dependencies can only be done in HTTP2 if parent stream
	// (of the initially requested file) exists and is still open.
	if (this.canPush(res) && desc.isParseable())
		await this.parseFileAndPushDependencies(req, res, desc)

	// Waiting for ssync operations to finish might've left us with closed stream.
	if (sink.destroyed)
		return debug(desc.name, 'cancelled, stream is closed')

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
		return debug(desc.name, 'cancelled, stream is closed')

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
	sink.once('close', () => debug(desc.name, 'sent, closing stream'))
	sink.writeHead(sink.statusCode)
	fileStream.pipe(sink)
	fileStream.once('error', err => this.serveError(sink, 500, err))
}

export async function parseFileAndPushDependencies(req, res, desc) {
	if (res.pushedUrls === undefined)
		res.pushedUrls = new Set
	let deps = await desc.getDependencies()
	console.log(desc.name, 'pushable deps', deps.map(d => d.url))
	// Every push, no matter how deep in the dependency tree it is, always relies on
	// original request's res.stream.
	if (deps.length && !this.isPushStreamClosed(res.stream)) {
		debug(desc.name, 'pushing dependencies')
		// Opening push streams for all the dependencies at the same time in parallel.
		var promises = deps
			// Prevent push if this file hasalready been pushed (or is currently being pushed).
			.filter(depDesc => !res.pushedUrls.has(depDesc.url))
			.map(depDesc => this.pushFile(req, res, depDesc))
		// Waiting for push streams to open (only to be open, not for files to be sent!)
		// before serving the requested main file. Not waiting would cause closure of
		// the main stream and cancelation of all pushes (and their respective push streams).
		await Promise.all(promises)
		debug(desc.name, 'dependency push streams opened')
	}
}

// Opens new push stream between server and client to serve as conduit for the file to be pushed through.
export async function pushFile(req, res, desc) {
	if (this.isPushStreamClosed(res.stream))
		return debug(desc.name, 'push not initated, stream is closed')
	// File hasn't been pushed yet, add it to the list of files to not push anymore
	// (if it's also a dependency of some other file in the project)
	res.pushedUrls.add(desc.url)
	// Open push stream.
	debug(desc.name, 'push initated')
	try {
		// Open new push stream between server and client to serve as conduit for the file to be streamed.
		var pushStream = await openPushStream(res.stream, desc.url)
		debug(desc.name, 'push open')
	} catch(err) {
		// Failed to open push stream.
		debug(desc.name, 'push errored', err)
		res.pushedUrls.delete(desc.url)
		return
	}
	// Open file's descriptor to gather info about it.
	await desc.readStat()
	// Do not go on if the parent stream is already closed.
	if (!desc.exists || this.isPushStreamClosed(res.stream)) {
		debug(desc.name, 'push cancelled')
		pushStream.destroy()
		return
	}
	// Adds shimmed http1 like 'res' methods onto 'stream' object.
	shimResMethods(pushStream)
	// Push the file to client as over the newly opened push stream.
	this.serveFile(req, res, desc, pushStream)
}


export function canPush(res) {
	return this.http2
		&& !!this.pushMode
		&& !!res.stream
		&& !isPushStreamClosed(res.stream)
}

export function isPushStreamClosed(stream) {
	return stream.destroyed || !stream.pushAllowed
}

function openPushStream(parentStream, url) {
	return new Promise((resolve, reject) => {
		parentStream.pushStream({':path': url}, (err, pushStream) => {
			if (err)
				reject(err)
			else
				resolve(pushStream)
		})
	})
}