import path from 'path'
import zlib from 'zlib'
import {fs, MIME, sanitizeUrl} from './util.mjs'


export async function openDescriptor(url, root = this.root) {
	// Unescapes special characters (%20 to space) and trims query (? and everything that follows)
	url = sanitizeUrl(url)
	var fsPath = path.join(root, url)
	var {base: name, dir} = path.parse(fsPath)
	var ext = getExt(name)
	var mime = getMime(ext)
	var fd = await fs.open(fsPath, 'r')
	try {
		var desc = await fs.fstat(fd)
		desc.url = url
		desc.fsPath = fsPath
		desc.dir = dir
		desc.name = name
		desc.ext = ext
		desc.mime = mime
		desc.folder = desc.isDirectory()
		desc.file = desc.isFile()
		if (desc.file)
			desc.etag = createEtag(desc)
		await fs.close(fd)
		return desc
	} catch(err) {
		await fs.close(fd)
		throw err
	}
}

export function getExt(url) {
	return path.extname(url).slice(1)
}
export function getMime(ext) {
	return MIME[ext] || 'text/plain'
}


export function createEtag(desc) {
	return Buffer.from(`${desc.size}-${desc.mtimeMs}-${desc.ino}`).toString('base64')
}


export function compressStream(req, res, rawStream) {
	var acceptEncoding = req.headers['accept-encoding']
	if (!acceptEncoding)
		return rawStream
	if (acceptEncoding.includes('gzip')) {
		// A compression format using the Lempel-Ziv coding (LZ77), with a 32-bit CRC.
		res.setHeader('content-encoding', 'gzip')
		return rawStream.pipe(zlib.createGzip())
	}
	if (acceptEncoding.includes('deflate')) {
		// A compression format using the zlib structure, with the deflate compression algorithm.
		res.setHeader('content-encoding', 'deflate')
		return rawStream.pipe(zlib.createDeflate())
	}
	/*
	if (acceptEncoding.includes('compress')) {
		// A compression format using the Lempel-Ziv-Welch (LZW) algorithm.
	}
	if (acceptEncoding.includes('br')) {
		// A compression format using the Brotli algorithm.
	}
	*/
	return rawStream
}

export async function ensureDirectory(directory) {
	try {
		await fs.stat(directory)
	} catch(err) {
		await fs.mkdir(directory)
	}
}
