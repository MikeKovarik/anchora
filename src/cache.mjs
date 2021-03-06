import {debug} from './util.mjs'


// V8 likes predictable objects
export class CacheRecord {
	constructor(desc) {
		this.etag = undefined
		this.size = 0
		this.reads = 0
		this.buffer = undefined
		this.deps = undefined
		this.lastAccess = undefined
	}
}


export class Cache extends Map {

	constructor(server) {
		super()
		this.server = server
		this.cleanup = this.cleanup.bind(this)
	}

	start() {
		this.cleanupInterval = setInterval(this.cleanup, this.server.cacheCleanupInterval)
	}

	stop() {
		clearInterval(this.cleanupInterval)
	}

	get memory() {
		var memoryTaken = 0
		var records = Array.from(this.values())
		var timeThreshold = Date.now() - this.server.cacheMaxAge
		for (var record of records) {
			// Cleanup older records
			if (record.lastAccess < timeThreshold)
				record.buffer = undefined
			else if (record.buffer)
				memoryTaken += record.size
		}
		return memoryTaken
	}

	// NOTE: Does not remove records, only buffered data if any is stored.
	//       Dependency lists are stored forever.
	// TODO: long running server will oveflow 'reads'
	cleanup() {
		var {cacheSize} = this.server
		var memoryTaken = this.memory
		debug('cleaning cache, currently stored', formatBytes(memoryTaken))
		if (memoryTaken > cacheSize) {
			// Sort from least to most used.
			records = Array.from(this.values()).sort((a, b) => a.reads - b.reads)
			let i = 0
			let record
			while (memoryTaken > cacheSize) {
				record = records[i]
				record.buffer = undefined
				memoryTaken -= record.size
				i++
			}
		}
	}

	setBuffer(desc, buffer) {
		var record = this.get(desc.url) || new CacheRecord
		record.buffer = buffer
		record.etag = desc.etag
		record.size = desc.size
		record.lastAccess = Date.now()
		this.set(desc.url, record)
	}

	setDeps(desc, deps) {
		var record = this.get(desc.url) || new CacheRecord
		record.deps = deps
		record.etag = desc.etag
		record.size = desc.size
		record.lastAccess = Date.now()
		this.set(desc.url, record)
	}

	get(url) {
		var record = super.get(url)
		if (record) {
			record.reads++
			record.lastAccess = Date.now()
			return record
		}
	}

}

function formatBytes(bytes) {
	if (bytes < 1024)
		return bytes + ' Bytes'
	else if (bytes < 1048576)
		return (bytes / 1024).toFixed(2) + ' KB'
	else if (bytes < 1073741824)
		return (bytes / 1048576).toFixed(2) + ' MB'
	else
		return (bytes / 1073741824).toFixed(2) + ' GB'
}