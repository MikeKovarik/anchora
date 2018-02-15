import path from 'path'
import zlib from 'zlib'
import stream from 'stream'
import {fs, MIME} from './util.mjs'


export async function openDescriptor(url, root) {
	var fsPath = path.join(root, url)
	var {base: name, dir} = path.parse(fsPath)
	var ext = getExt(name)
	var mime = getMime(ext)
	var fd = await fs.open(fsPath, 'r')
	try {
		var stat = await fs.fstat(fd)
		stat.fd = fd
		stat.url = url
		stat.fsPath = fsPath
		stat.dir = dir
		stat.name = name
		stat.ext = ext
		stat.mime = mime
		stat.folder = stat.isDirectory()
		stat.file = stat.isFile()
		if (stat.folder)
			await fs.close(fd)
		else
			stat.etag = createEtag(stat)
		return stat
	} catch(err) {
		await fs.close(fd)
		throw err
	}
}

function getExt(name) {
	return path.extname(name).slice(1)
}
function getMime(ext) {
	return MIME[ext] || 'text/plain'
}

export function createEtag(stat) {
	return Buffer.from(`${stat.size}-${stat.mtimeMs}-${stat.ino}`).toString('base64')
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


export function stringifyStream(originalStream, name) {
	return new Promise((resolve, reject) => {
		// Adding 'data' listener on the original stream would force it into flowing mode, the data would be read
		// once and the stream would close afterwards and become useless.
		// To make the data reusable we need to pass it into another stream and read while doing so.
		var passThrough = new stream.PassThrough
		var data = ''
		var timeout
		function onData(buffer) {
			clearTimeout(timeout)
			data += buffer.toString()
			timeout = setTimeout(onTimeout)
		}
		function onTimeout() {
			clearTimeout(timeout)
			originalStream.removeListener('data', onData)
			originalStream.removeListener('end', onTimeout)
			originalStream.removeListener('error', onTimeout)
			resolve([passThrough, data])
		}
		originalStream.on('data', onData)
		// Node has limit of 80kb somewhere in streams or fs leading to lost 'end' events.
		// Timeouts are utilized to work around it (where needed, smaller files end up firing 'end' event).
		originalStream.once('end', onTimeout)
		originalStream.once('error', onTimeout)
		originalStream.pipe(passThrough)
	})
}

export function openReadStream(desc, range) {
	var streamOptions = {
		fd: desc.fd,
		flags: 'r',
	}
	if (range)
		Object.assign(streamOptions, range)
	return fs.createReadStream(desc.fsPath, streamOptions)
}

export function parseRange() {
	// TODO
	var start, end, length
	return {start, end, length}
}