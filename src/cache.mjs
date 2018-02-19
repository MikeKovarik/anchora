//import StreamCache from 'stream-cache'
import path from 'path'
import stream from 'stream'
import {getExt, getMime} from './files.mjs'
import {fs, sanitizeUrl} from './util.mjs'
import {parse} from 'link-extract'


// https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html

// V8 likes predictable objects
export class CacheRecord {
	constructor(desc) {
		this.desc = desc
		this.reads = 0
		this.buffer = undefined
		this.deps = undefined
		this.lastAccess = undefined
	}
}


export class AnchoraCache extends Map {

	constructor(options) {
		super()
		Object.assign(this, options)

		this.interval = setInterval(this.cleanup.bind(this), this.cacheCleanupInterval)
	}

	// NOTE: Does not remove records, only buffered data if any is stored.
	//       Dependency lists are stored forever.
	// TODO: long running server will oveflow 'reads'
	cleanup() {
		var ttl = this.cacheMaxAge
		var memoryTaken = 0
		var records = Array.from(this.values())
		for (var record of records) {
			// Cleanup older records
			if (record.lastAccess + ttl < Date.now())
				record.buffer = undefined
			else
				memoryTaken += record.desc.size
		}
		if (memoryTaken > this.cacheSize) {
			// Sort from least to most used.
			records = records.sort((a, b) => a.reads - b.reads)
			let i = 0
			let record
			while (memoryTaken > this.cacheSize) {
				record = records[i]
				record.buffer = undefined
				memoryTaken -= record.desc.size
				i++
			}
		}
	}

	setBuffer(desc, buffer) {
		var record = this.get(desc.url) || new CacheRecord
		record.buffer = buffer
		record.desc = desc
		record.lastAccess = Date.now()
		this.set(desc.url, record)
	}

	setDeps(desc, deps) {
		var record = this.get(desc.url) || new CacheRecord
		record.deps = deps
		record.desc = desc
		record.lastAccess = Date.now()
		this.set(desc.url, record)
	}

	getBuffer(desc) {
		var record = this.get(desc.url)
		if (record) {
			record.reads++
			record.lastAccess = Date.now()
			return record.buffer
		}
	}

	getDeps(desc) {
		var record = this.get(desc.url)
		if (record) {
			record.reads++
			record.lastAccess = Date.now()
			return record.deps
		}
	}

	retrieve(desc) {
		var record = this.get(desc.url)
		if (record) {
			record.reads++
			record.lastAccess = Date.now()
			return record
		}
	}

}



export async function getCachedStream(desc, range) {
	if (this.isDescCacheable(desc)) {
		// Open buffer, parse it, cache it, convert to stream and serve.
		let cached = this.cache.retrieve(desc)
		if (cached && cached.buffer && cached.desc.etag === desc.etag) {
			var buffer = cached.buffer
			//if (this.debug) console.log('creating stream from cached buffer', buffer.length, 'Bytes', desc.fsPath)
		} else {
			var buffer = await fs.readFile(desc.fsPath)
			//if (this.debug) console.log('creating stream from newly read buffer', buffer.length, 'Bytes', desc.fsPath)
			this.cache.setBuffer(desc, buffer)
		}
		if (range)
			buffer = buffer.slice(range.start, range.end)
		return createReadStreamFromBuffer(buffer)
	} else {
		//if (this.debug) console.log('opening new read stream', desc.fsPath)
		// Open Stream.
		return fs.createReadStream(desc.fsPath, range)
	}
}

function createReadStreamFromBuffer(buffer) {
	var readable = new stream.Readable
	readable._read = () => {}
	readable.push(buffer)
	readable.push(null)
	return readable
}



export async function getDependencies(desc) {
	var cached = this.cache.retrieve(desc)
	if (cached && cached.deps && cached.desc.etag === desc.etag) {
		return cached.deps
	} else {
		if (cached.buffer)
			var buffer = cached.buffer
		else
			var buffer = await fs.readFile(desc.fsPath)
		// Parse for the first time.
		var deps = this.parseDependencies(buffer, desc)
		this.cache.setDeps(desc, deps)
		return deps
	}
}

export function parseDependencies(buffer, desc) {
	var parsed = parse(buffer.toString(), desc.ext)
	if (parsed) {
		// store and load peers
		// Transform sub urls relative to directory into absolute urls starting at root.
		var dirUrl = path.parse(desc.url).dir
		// NOTE: it is necessary for url to use forward slashes / hence the path.posix methods
		return parsed
			.filter(url => this.isUrlStreamable(url))
			.map(relUrl => path.posix.join(dirUrl, relUrl))
			.map(sanitizeUrl)
		// TODO: some options.cacheFiles option to store or not store the stream (separate from desc and parsed deps)
	}
	return []
}

// Only JS, HTML or CSS files under 1MB of size are parseable.
export function isDescParseable(desc) {
	let {mime, size} = desc
	if (size > 1024 * 1024)
		return false
	return mime === 'text/html'
		|| mime === 'text/javascript'
		|| mime === 'text/css'
}

export function isDescCacheable(desc) {
	if (desc.size > this.cacheFileSize)
		return false
	let {mime} = desc
	return this.cacheMimes.includes(mime)
		|| this.cacheMimes.some(prefix => mime.startsWith(prefix))
}

// Only acceptable urls for caching are relative paths.
export function isUrlStreamable(url) {
	if (!isUrlRelative(url))
		return false
	var ext = getExt(url)
	if (ext === 'map')
		return false
	var mime = getMime(ext)
	return this.pushStreamMimes.includes(mime)
		|| this.pushStreamMimes.some(prefix => mime.startsWith(prefix))
}

function isUrlRelative(url) {
	return url.startsWith('./')
		|| url.startsWith('/')
		|| !url.includes('//')
}

export function isHeaderUnchanged(req, res, desc) {
	var reqEtag = req.headers['if-none-match']
	var resEtag = res.getHeader('etag')
	if (reqEtag)
		return reqEtag === resEtag
	var reqModified = req.headers['if-modified-since']
	if (reqModified)
		return reqModified === desc.mtime.toUTCString()
}