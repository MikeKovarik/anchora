import path from 'path'
import stream from 'stream'
import mimeLib from 'mime/lite'
import {debug, fs, sanitizeUrl} from './util.mjs'
import {parse as extractLinks} from 'link-extract'



export async function injectDescriptor(req, res) {
	// Collect stat, mime and other basic information about the file.
	req.desc = await ReqTargetDescriptor.fromUrl(this, req.safeUrl)
}

// NOTE: this class is disposable and is only valid during single request. After that it is disposed.
export class ReqTargetDescriptor {

	static async fromUrl(server, url) {
		var desc = new this(server, url, undefined)
		await desc.ready
		return desc
	}

	static async fromPath(server, fsPath) {
		var desc = new this(server, undefined, fsPath)
		await desc.ready
		return desc
	}

	constructor(server, url, fsPath, readStatImmediately = true) {
		this.server = server
		this.cache = server.cache
		if (url !== undefined)
			this.initUrl(url)
		else
			this.initFs(fsPath)
		this._statWasRead = false
		if (readStatImmediately)
			this.ready = this.readStat()
		// Passing refference to server instance and its options.
	}

	initUrl(url) {
		this.url = sanitizeUrl(url)
		this.initFs(path.join(this.server.root, this.url))
	}

	initFs(fsPath) {
		this.fsPath = fsPath
		var parsed = path.parse(this.fsPath)
		this.name = parsed.base
		this.dir = parsed.dir
		this.ext = path.extname(this.name).slice(1).toLowerCase()
		// NOTE: mime returns null for unknown types. We fall back to plain text in such case.
		this.mime = mimeLib.getType(this.ext) || this.server.unknownMime
	}

	async readStat() {
		// Skip reading fs.stat if it has already been read.
		if (this._statWasRead)
			return
		try {
			let stat = await fs.stat(this.fsPath)
			this.file = stat.isFile()
			//this.folder = !this.file
			this.folder = stat.isDirectory()
			this.size = stat.size
			this.mtime = stat.mtime
			this.mtimeMs = stat.mtimeMs
			this.ino = stat.ino
			if (this.file)
				this.etag = this.createEtag()
			this.exists = true
		} catch(err) {
			this.exists = false
		}
		this._statWasRead = true
		return this
	}

	// Gets cached buffer or opens Opens buffer, cache it, convert to stream and serve.
	async getReadStream(range) {
		// Try to get 
		if (range && range.end === undefined)
			range.end = this.size - 1
		if (this.isCacheable()) {
			var buffer = await this.getBuffer()
			if (range)
				buffer = buffer.slice(range.start, range.end + 1)
			return createReadStreamFromBuffer(buffer)
		} else {
			debug(this.name, 'reading from disk (stream)')
			// Open Stream.
			return fs.createReadStream(this.fsPath, range)
		}
	}

	async getBuffer(cached) {
		// Try to retrieve the buffer from cache if argument is true.
		if (cached === undefined)
			cached = this.cache.get(this.url)
		// Return most up to date buffer.
		if (cached && cached.buffer && this.isUpToDate(cached)) {
			// Return the buffer from cached record if it's up to date.
			debug(this.name, 'retrieving from cache')
			return await cached.buffer
		} else {
			// Cached buffer is not up to date or is not cached at all.
			// Read it fresh from disk.
			debug(this.name, 'reading from disk (buffer)')
			var bufferPromise = fs.readFile(this.fsPath)
			if (this.isCacheable()) {
				this.cache.setBuffer(this, bufferPromise)
				var buffer = await bufferPromise
				this.cache.setBuffer(this, buffer)
				return buffer
			} else {
				return bufferPromise
			}
		}
	}

	isUpToDate(cached) {
		return cached.etag && cached.etag === this.etag
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
	async getDependencies() {
		var allDeps = new Map
		// Try to use cached dependencies if there are any or read and parse the file on spot.
		var cached = this.cache.get(this.url)
		if (cached && cached.deps && cached.etag === this.etag) {
			// The file has been parsed before and it hasn't changed since. Use the cached dependency list.
			debug(this.name, 'deps up to date')
			this._insertDescriptors(allDeps, cached.deps)
		} else {
			// The file hasn't been parsed or it has changed since.
			debug(this.name, 'parsing')
			var buffer = await this.getBuffer(cached)
			// Parse for the first time.
			var descriptors = this.parseDependencies(buffer, this)
			// Store the dependencies as array.
			this.cache.setDeps(this, descriptors.map(desc => desc.url))
			// Add the dependency descriptors into a map of all deps to be pushed.
			descriptors.forEach(desc => allDeps.set(desc.url, desc))
		}

		allDeps.forEach((desc, url) => {
			var cached = this.cache.get(url)
			if (cached && cached.deps)
				this._insertDescriptors(allDeps, cached.deps)
		})
		// Returns map of all of file's dependency and subdependecies in form of their descriptors.
		return Array.from(allDeps.values())
	}

	_insertDescriptors(targetMap, urlArray) {
		urlArray.forEach(url => {
			var desc = new ReqTargetDescriptor(this.server, url, undefined, false)
			targetMap.set(desc.url, desc)
		})
	}

	parseDependencies(buffer, desc) {
		var allUrls = extractLinks(buffer.toString(), desc.ext)
		if (!allUrls || allUrls.length === 0)
			return []
		// Transform sub urls relative to directory into absolute urls starting at root.
		var dirUrl = path.parse(desc.url).dir
		// NOTE: it is necessary for url to use forward slashes / hence the path.posix methods
		return allUrls
			.filter(isUrlRelative)
			.map(relUrl => path.posix.join(dirUrl, relUrl))
			.map(url => new ReqTargetDescriptor(this.server, url, undefined, false))
			.filter(desc => desc.isStreamable())
	}



	toJSON() {
		var    {name, mtimeMs, size, folder, file, url} = this
		return {name, mtimeMs, size, folder, file, url}
	}

	isCacheable() {
		if (this.size > this.cacheMaxFileSize)
			return false
		var mimeList = this.server.cacheMimes
		return mimeList.includes(this.mime)
			|| mimeList.some(prefix => this.mime.startsWith(prefix))
	}

	// Only JS, HTML or CSS files under 1MB of size are parseable.
	isParseable() {
		if (this.size > 1024 * 1024)
			return false
		return this.mime === 'text/html'
			|| this.mime === 'text/javascript'
			|| this.mime === 'application/javascript'
			|| this.mime === 'text/css'
	}

	// Only acceptable urls for caching are relative paths.
	isStreamable() {
		// Ignore css maps
		if (this.ext === 'map')
			return false
		if (this.server.pushMode === 'aggressive')
			return true
		var mimeList = this.server.pushMimes
		return mimeList.includes(this.mime)
			|| mimeList.some(prefix => this.mime.startsWith(prefix))
	}

	createEtag() {
		// ETAG should ideally be generated by a hashing function that uses every byte.
		// That would be inefficient so we're using the W/ weak variant that works well
		// but trades off accuracy for efficiency.
		this._etag = Buffer.from(`${this.size}-${this.mtimeMs}-${this.ino}`).toString('base64')
		return this.etag = `W/"${this._etag}"`
	}

}

function isUrlRelative(url) {
	return url.startsWith('./')
		|| url.startsWith('/')
		|| !url.includes('//')
}

function createReadStreamFromBuffer(buffer) {
	var readable = new stream.Readable
	readable._read = () => {}
	readable.push(buffer)
	readable.push(null)
	return readable
}
