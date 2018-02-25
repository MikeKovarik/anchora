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

	if (sink && sink.setHeader === undefined)
		shimResMethods(sink)

	// Set 200 OK status by default.
	res.statusCode = 200
	sink.setHeader('content-type', desc.mime)

	if (desc.ext === 'php') {
		sink.setHeader('content-type', 'text/html')
		var fileStream = await this.servePhp(req, res, sink, desc)
		sink.writeHead(res.statusCode)
		fileStream.pipe(sink)
		return
	}

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


// TODO: delete
import cp from 'child_process'
import util from 'util'
const exec = util.promisify(cp.exec)
const spawn = cp.spawn
// This only supports GET requests. POST is to be solved sometime in the future.
export async function servePhp(req, res, sink, desc) {
	var env = this.createPhpEnv(req, res, sink, desc)
	try {
		var {stdout, stderr} = await exec(this.phpPath, {env})
	} catch(err) {
		console.error(err)
	}
	if (stdout) {
		stdout = stdout.slice(stdout.indexOf('\r\n\r\n') + 4)
		var buffer = Buffer.from(stdout)
	} else {
		var buffer = Buffer.from(stderr)
	}
	return this.createReadStreamFromBuffer(buffer)
}

export function createPhpEnv(req, res, sink, desc) {
	var url = req.url
	var SCRIPT_NAME = url
	var QUERY_STRING = ''
	if (url.includes('?')) {
		let index = url.indexOf('?')
		QUERY_STRING = url.slice(index + 1)
		SCRIPT_NAME = url.slice(0, index)
	}
	SCRIPT_NAME = decodeURI(SCRIPT_NAME)
	if (req.httpVersion) {
		var SERVER_PROTOCOL = `HTTP/${req.httpVersion}`
	}
	if (req.socket.constructor.name === 'TLSSocket')
		var REQUEST_SCHEME = 'https'
	else
		var REQUEST_SCHEME = 'http'
	var DOCUMENT_ROOT = this.root.replace(/\\/g, '\/')
	var SCRIPT_FILENAME = desc.fsPath.replace(/\\/g, '\/')
	var env = {
		REDIRECT_STATUS: 200,
		GATEWAY_INTERFACE: 'CGI/1.1',
		QUERY_STRING,
		SERVER_PROTOCOL,
		REQUEST_SCHEME,
		REQUEST_URI: url,
		DOCUMENT_ROOT,
		CONTEXT_DOCUMENT_ROOT: DOCUMENT_ROOT,
		SCRIPT_NAME,
		SCRIPT_FILENAME,
		SERVER_PORT: req.socket.localPort,
		SERVER_ADDR: req.socket.localAddress,
		REMOTE_ADDR: req.socket.remoteAddress,
		REQUEST_METHOD: req.method,
		SERVER_SIGNATURE: this.info,
		SERVER_SOFTWARE: this.info,
		//PATH_INFO, // shouldn't be set because it along with SCRIPT_NAME affects PHP_SELF
	}
	var headers = req.headers
	Object.keys(headers)
		.filter(header => !header.startsWith(':')) // HTTP2 is to be solved sometime in the future. 
		.forEach(header => env['HTTP_' + kebabToSnake(header)] = headers[header])
	if (this.phpEnv)
		Object.assign(env, phpEnv)
	return env
}

function kebabToSnake(string) {
	return string.toUpperCase().replace(/-/g, '_')
}