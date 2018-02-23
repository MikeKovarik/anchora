import path from 'path'
import zlib from 'zlib'
import mimeLib from 'mime/lite'
import {fs, sanitizeUrl} from './util.mjs'


class FileDescriptor {

	constructor(root, url, options, canReadStat = true) {
		//this.root = root
		this.url = sanitizeUrl(url)
		this.fsPath = path.join(root, this.url)
		var parsed = path.parse(this.fsPath)
		this.name = parsed.base
		this.dir = parsed.dir
		this.ext = path.extname(this.name).slice(1)
		this.mime = mimeLib.getType(this.ext)
		if (canReadStat)
			this.ready = this.readStat()
		this._options = options
	}

	async readStat() {
		try {
			let stat = await fs.stat(this.fsPath)
			this.file = stat.isFile()
			this.folder = !this.file
			//this.folder = stat.isDirectory()
			this.size = stat.size
			this.mtime = stat.mtime
			this.mtimeMs = stat.mtimeMs
			this.ino = stat.ino
			if (this.file)
				this.etag = createEtag(stat)
			this.exists = true
		} catch(err) {
			this.exists = false
		}
	}

	isCacheable() {
		if (this.size > this.cacheFileSize)
			return false
		var mimeList = this._options.cacheMimes
		return mimeList.includes(this.mime)
			|| mimeList.some(prefix => this.mime.startsWith(prefix))
	}

	// Only JS, HTML or CSS files under 1MB of size are parseable.
	isParseable() {
		if (this.size > 1024 * 1024)
			return false
		return this.mime === 'text/html'
			|| this.mime === 'text/javascript'
			|| this.mime === 'text/css'
	}

	toJSON() {
		var    {name, mtimeMs, size, folder, file, url} = this
		return {name, mtimeMs, size, folder, file, url}
	}

}

export async function openDescriptor(url, canReadStat = true) {
	// Unescapes special characters (%20 to space) and trims query (? and everything that follows)
	var desc = new FileDescriptor(this.root, url, this, canReadStat)
	if (canReadStat)
		await desc.ready
	return desc
}


export function createEtag(desc) {
	return Buffer.from(`${desc.size}-${desc.mtimeMs}-${desc.ino}`).toString('base64')
}


export function getCompressorStream(req, res) {
	var acceptEncoding = req.headers['accept-encoding']
	if (!acceptEncoding)
		return
	if (acceptEncoding.includes('gzip')) {
		// A compression format using the Lempel-Ziv coding (LZ77), with a 32-bit CRC.
		res.setHeader('content-encoding', 'gzip')
		return zlib.createGzip()
	}
	if (acceptEncoding.includes('deflate')) {
		// A compression format using the zlib structure, with the deflate compression algorithm.
		res.setHeader('content-encoding', 'deflate')
		return zlib.createDeflate()
	}
	/*
	if (acceptEncoding.includes('compress')) {
		// A compression format using the Lempel-Ziv-Welch (LZW) algorithm.
	}
	if (acceptEncoding.includes('br')) {
		// A compression format using the Brotli algorithm.
	}
	*/
}

export async function ensureDirectory(directory) {
	try {
		await fs.stat(directory)
	} catch(err) {
		await fs.mkdir(directory)
	}
}
