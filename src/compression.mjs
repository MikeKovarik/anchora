import zlib from 'zlib'


export function createCompressorStream(req, sink) {
	var acceptEncoding = req.headers['accept-encoding']
	if (!acceptEncoding)
		return
	if (acceptEncoding.includes('gzip')) {
		// A compression format using the Lempel-Ziv coding (LZ77), with a 32-bit CRC.
		sink.setHeader('content-encoding', 'gzip')
		return zlib.createGzip()
	}
	if (acceptEncoding.includes('deflate')) {
		// A compression format using the zlib structure, with the deflate compression algorithm.
		sink.setHeader('content-encoding', 'deflate')
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
