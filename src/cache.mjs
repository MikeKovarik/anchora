//import StreamCache from 'stream-cache'
import {openReadStream, createEtag} from './files.mjs'


// https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html

class FsCache extends Map {

	// TODO, return subdependencies
	retrieve(desc, includeSubDependencies = false) {
		var record = this.get(desc.url)
		/*if (record && includeSubDependencies) {
			record = Object.assign({}, record)
			record.dependencies = [...record.dependencies]
			// note: this does not go through all subbranches and subdependencies.
			record.dependencies.forEach(depUrl => {
				this.get(depUrl)
					.dependencies
					.forEach(url => {
						if (!record.dependencies.includes(url))
							record.dependencies.push(url)
					})
			})
		}*/
		return record
	}

	store(desc, stream, dependencies) {
		//console.log('--- CACHE', desc.url, dependencies)
		this.set(desc.url, {desc, stream, dependencies})
	}

	extend(desc, stream, dependencies) {
		//console.log('--- CACHE', desc.url, dependencies)
		var record = this.get(desc.url) || {}
		record.desc = desc
		record.stream = stream || record.stream
		record.dependencies = dependencies || record.dependencies
		this.set(desc.url, record)
	}

}

export var fsCache = new FsCache

export function setCacheHeaders(req, res, desc, options) {
	// It is important to specify:
	// - one of 'expires' or 'cache-control' max-age
	// - one of 'last-modified' or 'etag'
	// It is redundant to specify both ('expires' and cc or modified and etag)
	var cacheControl = req.headers['cache-control'] || req.headers.pragma
	//console.log('cacheControl', cacheControl)
	if (cacheControl === 'no-cache' || cacheControl === 'max-age=0')
		return
	// A way to tell if the file is un/changed.
	// NOTE: if both 'last-modified' and 'etag' (or 'expires' and 'cache-control' max-age) were specified
	//       Chrome would never send 'if-none-match' or 'if-modified-since' headers, making 304 impossible.
	//       Local cache also likely eats all requests despite 'cache-control' 'must-revalidate'.
	if (options.maxAge === undefined) {
		// More reliable, HTTP 1.1 and 'must-revalidate' friendly way of determining file freshness.
		res.setHeader('etag', createEtag(desc))
		res.setHeader('cache-control', options.cacheControl)
	} else {
		// NOTE: Using time/date/age based makes Chrome store the files in local cache for the given ammount of time
		//       and never ask for them (not even for 304) until they're expired despite 'cache-control' 'must-revalidate'.
		res.setHeader('last-modified', desc.mtime.toGMTString())
		var expires = new Date(Date.now() + options.maxAge * 1000)
		res.setHeader('expires', expires.toGMTString())
	}
}

export function isFileUnchanged(req, res, desc) {
	//console.log('if-match           ', req.headers['if-match'])
	//console.log('if-none-match      ', req.headers['if-none-match'], '|', resEtag)
	//console.log('if-modified-since  ', req.headers['if-modified-since'  ], '|', desc.mtime.toGMTString())
	//console.log('if-unmodified-since', req.headers['if-unmodified-since'])
	var reqModified = req.headers['if-modified-since']
	var reqEtag = req.headers['if-none-match']
	var resEtag = res.getHeader('etag')
	return reqEtag && reqEtag === resEtag
		|| reqModified && reqModified === desc.mtime.toGMTString()
}

export function getCachedReadStream(desc, options) {
	if (options.cacheControl) {
		var cacheRecord = fsCache.get(desc.url)
		if (cacheRecord !== undefined && cacheRecord.etag === desc.etag) {
			console.log('retrieving from memory cache')
			return cacheRecord.stream
		} else {
			console.log('reading & caching', desc.name)
			var stream = new StreamCache()
			fsCache.store(desc, stream)
			openReadStream(desc).pipe(cacheRecord.stream)
			return stream
		}
	} else {
		console.log('reading from disk', desc.name)
		return openReadStream(desc)
	}
}

/*
export function getCachedReadStream(desc, options) {
	if (options.cacheControl) {
		var cacheRecord = fsCache.get(desc.url)
		if (cacheRecord === undefined || hasDescChanged(cacheRecord.desc, desc)) {
			console.log('reading & caching', desc.name)
			cacheRecord = {
				desc,
				stream: new StreamCache()
			}
			openReadStream(desc).pipe(cacheRecord.stream)
			fsCache.set(desc.url, cacheRecord)
		} else {
			console.log('retrieving from memory cache')
		}
		return cacheRecord.stream
	} else {
		console.log('reading from disk', desc.name)
		return openReadStream(desc)
	}
}
*/
export function hasDescChanged(cachedDesc, desc) {
	return cachedDesc.size !== desc.size
		|| cachedDesc.ino !== desc.ino
		|| cachedDesc.mtimeMs !== desc.mtimeMs
}
