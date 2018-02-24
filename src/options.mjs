import path from 'path'

// options object gets passed as an argument to https.Server or http2.SecureServer (and tls.Server)
// https://nodejs.org/dist/latest-v9.x/docs/api/tls.html#tls_tls_createserver_options_secureconnectionlistener
// https://nodejs.org/dist/latest-v9.x/docs/api/http2.html#http2_http2_createsecureserver_options_onrequesthandler

var defaultOptions = {

	// BASICS

	// Path to the directory which will be hosted as localhost.
	root: process.cwd(),
	// Main file to serve if directory is opened served.
	indexFile: 'index.html',
	// Serve a list of files inside the directory if indexFile is not found.
	dirBrowser: true,
	// Alias for options.version and options.secure. By default 'http1' => version=1 and secure=false.
	type: 'http1',
	secure: false,
	port: [80, 443],
	// Cross Origin headers are enablaed by default.
	cors: true,
	//
	ranges: false, // TODO: work in progress
	// GZIP compression
	gzip: false, // TODO: work in progress
	// Decides on response type and compression if 'accept-encoding' header is present in request.
	// false - Ignores encoding and serves the file as is.
	// 'active' - Files are compressed (gzipped) on the fly, each time it is requested. 
	// 'passive' - Serves user gzipped version of the requested file.
	//             File of the same name with .gz extension is served if it exists.
	encoding: false,


	// HTTP2 PUSH STREAMING DEPENDENCIES

	// Enables HTTP2 push streams.
	// - 'standard'   = rel=preload; as=script TODO
	// - 'aggressive' = parses every file and pushes all valid dependencies linked within the file.
	pushStream: 'aggressive',
	// File MIME types to be pushed.
	// - 'all'         = Push all files
	// - Array<String> = List of MIME types
	pushStreamMimes: [
		'text/html',
		'text/css',
		'text/javascript', // todo remove
		'application/javascript',
		'application/json',
		//'image/svg+xml',
		//'application/font-',
		//'font/',
	],


	// FILE & DEPENDENCY CACHE

	// Keep files cached in memory to speed up delivery of frequently used resources.
	cacheFiles: true,
	// Maximal size of RAM to use for caching files.
	cacheSize: 100 * 1024 * 1024, // 100 MB
	// Maximal file size allowed to cache.
	cacheFileSize: 5 * 1024 * 1024, // 5 MB
	// Approx time for which files remain cached.
	cacheMaxAge: 2 * 60 * 60 * 1000, // 2 hours
	// Interval for checking cache size and cleanup.
	// NOTE: cacheFileTtl is evaluated during this cleanup phase. Increasing cleanup interval increases file ttl.
	cacheCleanupInterval: 5 * 60 * 1000, // 5 minutes.
	// File MIME types to be cached.
	// - 'all'         = store all files
	// - Array<String> = List of MIME types
	cacheMimes: ['text/', 'application/', 'image/'],


	// HEADERS AND OPTIONS

	// string values are directly set as cache-control header
	// true equals to max-age=${maxAge}
	// false equals to no-cache
	// default 'must-revalidate' enables caching, forces requesting every file, but returns 403 if nothing was modified.
	cacheControl: 'must-revalidate',
	// info about server passed as 'server' header
	info: 'Anchora static server',
	// Use unsecure HTTP connextion only to redirect to secure conn.
	upgradeInsecure: false,


	// CERTIFICATES

	// Paths to certificate files.
	crtPath: path.join(process.cwd(), './certificates/selfsigned.crt'),
	keyPath: path.join(process.cwd(), './certificates/selfsigned.key'),
	// In memory data of the certificates.
	cert: undefined,
	key: undefined,
	// Name of the certificate and .crt file created for HTTPS and HTTP2 connections.
	crtName: 'anchora.localhost.self-signed',
	// Custom attrs and options objects can be passed to 'selfsigned' module used for generating certificates.
	selfsignedAttrs: undefined,
	selfsignedOptions: undefined,

}

export function normalizeOptions(...args) {
	switch (args.length) {
		case 3:
			// createServer('type', portUnsecure, 'preset')
			// createServer('type', [portUnsecure, portSecure], 'preset')
			// createServer('type', portUnsecure, {options})
			// createServer('type', [portUnsecure, portSecure], {options})
			var [type, port, userOptions] = args
			userOptions = getPreset(userOptions)
			userOptions.type = type
			userOptions.port = port
			break
		case 2:
			// createServer('type', 'preset')
			// createServer('type', portUnsecure)
			// createServer('type', [portUnsecure, portSecure])
			var [type, arg] = args
			if (Array.isArray(arg) || typeof arg === 'number')
				userOptions = {port: arg}
			else
				userOptions = getPreset(arg)
			userOptions.type = type
			break
		default:
			// createServer(portUnsecure)
			// createServer([portUnsecure, portSecure])
			// createServer('type')
			// createServer({options})
			var [arg] = args
			var argType = typeof arg
			if (Array.isArray(arg) || argType === 'number')
				userOptions = {port: arg}
			else if (argType === 'string')
				userOptions = {type: arg}
			else
				userOptions = arg
			break
	}

	var options = Object.assign({}, defaultOptions, userOptions)

	switch (options.type) {
		case 'http':
			options.version  = 1
			options.unsecure = true  // Has unsecure port served over http1
			options.secure   = false // Doesn't have secure port served over https or http2
			break
		case 'https':
			options.version  = 1
			options.unsecure = false // Doesn't have unsecure port served over http1
			options.secure   = true  // Has secure port served over https or http2
			break
		case 'http2':
			options.version  = 2
			options.unsecure = false // Doesn't have unsecure port served over http1
			options.secure   = true  // Has secure port served over https or http2
			break
		case 'hybrid':
			// 80 server over HTTP1, 443 served over HTTP2
			options.version  = 1 | 2
			options.unsecure = true // Has unsecure port served over http1
			options.secure   = true // Has secure port served over https or http2
			break
		case 'both':
			// 80 server over HTTP, 443 served over HTTPS
			options.version  = 1
			options.unsecure = true // Has unsecure port served over http1
			options.secure   = true // Has secure port served over https or http2
			break
	}

	// Failsafe proofing possibly malformed optionsl

	// HTTP1 does not support streamig (only HTTP2 does).
	if (options.version === 1)
		options.pushStream = false
	// HTTP2 only supports secure connections.
	if (options.version === 2)
		options.secure = true

	if (typeof options.port === 'number') {
		if (options.port === 443)
			options.secure = true
		if (options.secure)
			options.port = [undefined, options.port]
		else
			options.port = [options.port, undefined]
	}

	var cc = options.cacheControl
	if (typeof cc === 'number' || cc === true) {
		options.maxAge = cc
		cc = `max-age=${cc}`
	} else if (cc === false) {
		cc = 'no-cache'
	}

	if (options.gzip === false)
		options.encoding = false
	if (options.gzip === true)
		options.encoding = 'active'

	return options
}

function getPreset(name) {
	if (name === 'dev') {
		return Object.assign({}, defaultOptions, {
			cacheControl: 'must-revalidate',
			encoding: false,
			cors: true,
			dirBrowser: true,
			cacheSize: true,
			upgradeInsecure: false,
		})
	} else if (name === 'production' || name === 'prod') {
		return Object.assign({}, defaultOptions, {
			cacheControl: 1000 * 60 * 24,
			encoding: true,
			dirBrowser: false,
			upgradeInsecure: true,
		})
	} else if (typeof name === 'string') {
		// Unknown preset.
		return {}
	} else {
		// Not a name of preset, probably just options object to be passed through.
		return name
	}
}