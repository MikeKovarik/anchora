//import StreamCache from 'stream-cache'
import path from 'path'
import stream from 'stream'
import mimeLib from 'mime/lite'
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

	get memory() {
		var ttl = this.cacheMaxAge
		var memoryTaken = 0
		var records = Array.from(this.values())
		for (var record of records) {
			// Cleanup older records
			if (record.lastAccess + ttl < Date.now())
				record.buffer = undefined
			else if (record.buffer)
				memoryTaken += record.desc.size
		}
		return memoryTaken
	}

	// NOTE: Does not remove records, only buffered data if any is stored.
	//       Dependency lists are stored forever.
	// TODO: long running server will oveflow 'reads'
	cleanup() {
		var memoryTaken = this.memory
		if (memoryTaken > this.cacheSize) {
			// Sort from least to most used.
			records = Array.from(this.values()).sort((a, b) => a.reads - b.reads)
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
/*
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
*/
	retrieve(desc) {
		var record = this.get(desc.url)
		if (record) {
			record.reads++
			record.lastAccess = Date.now()
			return record
		}
	}

}




// Gets cached buffer or opens Opens buffer, cache it, convert to stream and serve.
export async function getCachedStream(desc, range) {
	// Try to get 
	if (desc.isCacheable()) {
		var buffer = await this.getCachedBuffer(desc)
		if (range)
			buffer = buffer.slice(range.start, range.end)
		return createReadStreamFromBuffer(buffer)
	} else {
		// Open Stream.
		return fs.createReadStream(desc.fsPath, range)
	}
}

export async function getCachedBuffer(desc) {
	let cached = this.cache.retrieve(desc)
	if (cached && cached.buffer && cached.desc.etag === desc.etag)
		return cached.buffer
	else
		return this.getFreshBuffer(desc)
}
export async function getFreshBuffer(desc) {
	var buffer = await fs.readFile(desc.fsPath)
	if (desc.isCacheable())
		this.cache.setBuffer(desc, buffer)
	return buffer
}


export async function getDependencies(desc) {
	var cached = this.cache.retrieve(desc)
	if (cached && cached.deps && cached.desc.etag === desc.etag) {
		var directDeps = cached.deps
	} else {
		var buffer = cached && cached.buffer || await this.getFreshBuffer(desc)
		// Parse for the first time.
		var directDeps = this.parseDependencies(buffer, desc)
		this.cache.setDeps(desc, directDeps)
	}
	// Return list of file's dependencies (fresh) and estimate of nested dependencies.
	// That is to prevent unnecessary slow disk reads of all files because window of opportunity
	// for pushing is short and checking freshness and possible reparsing of each file
	// would take a long time.
	// Best case scenario: Dependency files didn't change since we last parsed them.
	//                     Full and correct dependency tree is acquired.
	// Worst case scenario: Most dependency files either change or aren't parsed yet.
	//                      We're pushing incomplete list of files some of which might not be needed at all.
	//                      Client then re-requests missing files with another GETs. We cache and parse it then.
	return this.getNestedDependencies(directDeps)
}

export function getNestedDependencies(directDeps) {
	var allDeps = [...directDeps]
	for (var i = 0; i < allDeps.length; i++) {
		var cached = this.cache.get(allDeps[i])
		if (cached && cached.deps)
			mergeArrays(allDeps, cached.deps)
	}
	return allDeps
}

function mergeArrays(arr1, arr2) {
	for (var i = 0; i < arr2.length; i++)
		if (!arr1.includes(arr2[i]))
			arr1.push(arr2[i])
}

export function parseDependencies(buffer, desc) {
	var parsed = parse(buffer.toString(), desc.ext)
	if (parsed) {
		// store and load peers
		// Transform sub urls relative to directory into absolute urls starting at root.
		var dirUrl = path.parse(desc.url).dir
		// NOTE: it is necessary for url to use forward slashes / hence the path.posix methods
		return parsed
			.filter(url => isStreamable(url, this.pushStreamMimes))
			.map(relUrl => path.posix.join(dirUrl, relUrl))
			.map(sanitizeUrl)
		// TODO: some options.cacheFiles option to store or not store the stream (separate from desc and parsed deps)
	}
	return []
}

// Only acceptable urls for caching are relative paths.
function isStreamable(url, mimeList) {
	if (!isUrlRelative(url))
		return false
	var ext = path.extname(url).slice(1)
	// Ignore css maps
	if (ext === 'map')
		return false
	var mime = mimeLib.getType(ext)
	return mimeList.includes(mime)
		|| mimeList.some(prefix => mime.startsWith(prefix))
}

function isUrlRelative(url) {
	return url.startsWith('./')
		|| url.startsWith('/')
		|| !url.includes('//')
}


/*
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
*/


export function isHeaderUnchanged(req, res, desc) {
	var reqEtag = req.headers['if-none-match']
	var resEtag = res.getHeader('etag')
	if (reqEtag)
		return reqEtag === resEtag
	var reqModified = req.headers['if-modified-since']
	if (reqModified)
		return reqModified === desc.mtime.toUTCString()
}


function createReadStreamFromBuffer(buffer) {
	var readable = new stream.Readable
	readable._read = () => {}
	readable.push(buffer)
	readable.push(null)
	return readable
}