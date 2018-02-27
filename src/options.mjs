import {debug} from './util.mjs'
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
	// Alias for options.version and options.secure.
	// 'http' or 'http1' => version=1 and secure=false. By default
	// 'https'           => version=1 and secure=true.
	// 'http2'           => version=2 and secure=true
	// 'both'   = http1 + https
	// 'hybric' = http1 + http2
	type: 'both',
	// True if unsecure HTTP server is running. By default both are running.
	unsecure: true,
	// True if secure HTTPS (or HTTP2) server is running. By default both are running.
	secure: true,
	// Array of [unsecure, secure] server ports.
	port: [80, 443],
	// Server can respond with selected chunk of the file, delimeted by the requested 'range' header.
	// WARNING: Only single range is allowed. Multipart ranges are not implemented.
	range: true,
	// GZIP compression
	gzip: false,
	// Decides on response type and compression if 'accept-encoding' header is present in request.
	// false - Ignores encoding and serves the file as is.
	// 'active' - Files are compressed (gzipped) on the fly, each time it is requested. 
	// 'passive' - Serves user gzipped version of the requested file.
	//             File of the same name with .gz extension is served if it exists.
	encoding: false,


	// CORS - CROSS ORIGIN RESOURCE SHARING

	// Cross Origin headers are enablaed by default.
	// Boolean or String (in which case stands in for corsOrigin)
	cors: true,
	// Header 'access-control-allow-origin'
	// Allowed sites and origins.
	corsOrigin: '*',
	// Header 'access-control-allow-methods'. String or Array.
	// Methods handled by the server if the request comes from another origin.
	corsMethods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
	// Header 'access-control-allow-headers'. String or Array.
	corsHeaders: ['x-requested-with', 'content-type'],
	// Header 'access-control-allow-credentials'. String or Boolean.
	// Allows auth credentials to be passed.
	corsCredentials: true,
	// Header'content-security-policy'
	// False or String
	csp: false,


	// HTTP2 PUSH STREAMING DEPENDENCIES

	// Enables HTTP2 push streams.
	// - 'optimized'  = parses every parseable file, pushes only select types of links within file. Scripts and styles by default.
	// - 'aggressive' = parses every parseable file, pushes all valid dependencies linked within the file.
	pushStream: 'optimized',
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
	cacheMimes: [
		//'text/',
		'text/cache-manifest',
		'text/css',
		'text/html',
		'text/plain',
		'application/javascript',
		'application/json',
		'application/xml',
		'image/'
	],


	// HEADERS AND OPTIONS

	// Object of custom 
	headers: undefined,
	// string values are directly set as cache-control header
	// true   = equals to `max-age=${maxAge}` Also disables 304
	// false  = equals to no-cache
	// default = 'must-revalidate' enables caching, forces requesting every file, but returns 403 if nothing was modified.
	cacheControl: 'must-revalidate',
	// Number
	maxAge: undefined,
	// Forces user into HTTPS connection if the initial request is unsecure HTTP and if the server runs both HTTP alongside HTTPS.
	forceUpgrade: false,
	// Default mime type for files whose extensions cannot be resolved. (for example arduino .ino files).
	// 'text/plain' results in plain text displayed in browser whereas 'application/octet-stream' triggers download.
	unknownMime: 'text/plain',
	//unknownMime: 'application/octet-stream',


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


	// CGI - EPERIMENTAL!!!

	// Environment variables to be passed into the script that end up in $_SERVER.
	phpEnv: undefined,
	// Path to php-cgi.exe PHP CGI interface.
	phpPath: undefined,
	// Path to Perl CGI interface.
	perlPath: undefined,

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
		case 'http1':
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
		default:
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

	// Array of pushable mimes as value of 'pushStream' is a shortcut for 'optimized' mode. 
	if (Array.isArray(options.pushStream)) {
		options.pushStreamMimes = options.pushStream
		options.pushStream = 'optimized'
	}

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

	if (typeof corsOrigin === 'object')
		corsOrigin = corsOrigin.join(', ')
	if (typeof corsMethods === 'object')
		corsMethods = corsMethods.join(', ')
	if (typeof corsHeaders === 'object')
		corsHeaders = corsHeaders.join(', ')

	if (!options.root)
		throw new Error('`root` options is not set')

	return options
}

function getPreset(name) {
	if (name === 'dev') {
		return Object.assign({}, defaultOptions, {
			dirBrowser: true,
			cacheControl: 'must-revalidate',
			pushStream: 'aggressive',
			encoding: false,
			forceUpgrade: false,
			cors: true,
			cacheSize: true,
		})
	} else if (name === 'production' || name === 'prod') {
		return Object.assign({}, defaultOptions, {
			dirBrowser: false,
			cacheControl: 1000 * 60 * 24,
			pushStream: 'optimized',
			encoding: true,
			forceUpgrade: true,
		})
	} else if (typeof name === 'string') {
		debug('Unknown preset')
		return {}
	} else {
		// Not a name of preset, probably just options object to be passed through.
		return name
	}
}