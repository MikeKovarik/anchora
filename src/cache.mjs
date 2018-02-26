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


export class AnchoraCache extends Map {

	constructor(options) {
		super()
		Object.assign(this, options)
		this.cleanupInterval = setInterval(this.cleanup.bind(this), this.cacheCleanupInterval)
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
				memoryTaken += record.size
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
