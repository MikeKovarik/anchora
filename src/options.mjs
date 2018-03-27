import {debug} from './util.mjs'
import path from 'path'

// options object gets passed as an argument to https.Server or http2.SecureServer (and tls.Server)
// https://nodejs.org/dist/latest-v9.x/docs/api/tls.html#tls_tls_createserver_options_secureconnectionlistener
// https://nodejs.org/dist/latest-v9.x/docs/api/http2.html#http2_http2_createsecureserver_options_onrequesthandler

export var defaultOptions = {

	// BASICS

	// Alias for `options.portUnsecure` and/or `options.portSecure`.
	// Values can be: - Array of [`options.portUnsecure`, `options.portSecure`].
	//                - Single Number that becomes `options.portUnsecure` by default
	//                  or `options.portSecure` if it equals 433 or if `options.https` or `options.http2` is enabled.
	port: undefined, // [80, 443]

	// Port number of HTTP server.
	portUnsecure: 80,
	// Port number of HTTPS or HTTP2 server.
	portSecure: 443,


	// Alias for `options.http`, `options.https`, `options.http2`.
	// - 'both'   => `options.http=true`,  `options.https=true`,  `options.http2=false` // default
	// - 'http'   => `options.http=true`,  `options.https=false`, `options.http2=false`
	// - 'http1'  => `options.http=true`,  `options.https=false`, `options.http2=false`
	// - 'https'  => `options.http=false`, `options.https=true`,  `options.http2=false`
	// - 'http2'  => `options.http=false`, `options.https=false`, `options.http2=true`
	// - 'hybrid' => `options.http=true`,  `options.https=false`, `options.http2=true`
	type: undefined,

	// Enables HTTP/1.1 unsecure server (node module 'http')
	http:  true,
	// Enables HTTPS/1.1 unsecure server (node module 'https')
	https: true,
	// Enables HTTPS/2.0 unsecure server (node module 'http2')
	http2: false,


	// Enables GZIP compression. Alias for `options.encoding`
	gzip: false,
	// Decides on response type and compression if 'accept-encoding' header is present in request.
	// - false            = Ignores encoding and serves the file as is.
	// - true or 'active' = Files are compressed (gzipped) on the fly, each time it is requested. 
	// - 'passive'        = Serves user gzipped version of the requested file.
	//                      File of the same name with .gz extension is served if it exists.
	// false by default via `options.gzip`
	encoding: undefined,

	// Path to the directory which will be hosted as localhost.
	root: process.cwd(),
	// Main file to serve if directory is opened served.
	indexFile: 'index.html',
	// Serve a list of files inside the directory if indexFile is not found.
	dirBrowser: true,
	// Server can respond with selected chunk of the file, delimeted by the requested 'range' header.
	// WARNING: Only single range is allowed. Multipart ranges are not implemented.
	acceptRanges: true,


	// CORS - CROSS ORIGIN RESOURCE SHARING

	// Cross Origin headers are enabled by default.
	// Boolean or String (in which case it becomes alias for corsOrigin)
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
	// Charset to include in 'content-type' header. By default 'utf-8', necessary for most texts and documents
	// that don't set it explicitly inside (like html)
	charset: 'utf-8',


	// HTTP2 PUSH STREAMING DEPENDENCIES

	// Enables HTTP2 push streams.
	// - 'optimized'  = Parses every parseable file, pushes only select types of links within file. Scripts and styles by default.
	// - 'aggressive' = Parses every parseable file, pushes all valid dependencies linked within the file.
	// - false        = Disables HTTP2 push streams.
	pushMode: 'optimized',
	// File MIME types to be pushed.
	// - 'all'         = Push all files
	// - Array<String> = List of MIME types
	pushMimes: [
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
	cacheMaxFileSize: 5 * 1024 * 1024, // 5 MB
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
	// Allow or disables upgrading at all.
	allowUpgrade: true,
	// Default mime type for files whose extensions cannot be resolved. (for example arduino .ino files).
	// 'text/plain' results in plain text displayed in browser whereas 'application/octet-stream' triggers download.
	unknownMime: 'text/plain',
	//unknownMime: 'application/octet-stream',


	// CERTIFICATES

	// Paths to certificate files.
	certPath: undefined,
	crtPath: undefined, // alias for `certPath`
	keyPath: undefined,
	// In memory data of the certificates.
	cert: undefined,
	key: undefined,
	// Name of the certificate and .crt file created for HTTPS and HTTP2 connections.
	certDir: path.join(process.cwd(), `./certificates/`),
	certName: 'anchora.localhost.self-signed',
	// Custom attrs and options objects can be passed to 'selfsigned' module used for generating certificates.
	selfsignedAttrs: undefined,
	selfsignedOptions: undefined,


	// CGI - EPERIMENTAL!!!

	// Enables execution of PHP, Ruby, Perl and other CGI scripts
	cgi: false,
	// Environment variables to be passed into the script that end up in $_SERVER.
	cgiEnv: undefined,
	// Path to php-cgi.exe PHP CGI interface.
	phpPath: undefined,
	// Path to Perl CGI interface.
	rubyPath: undefined,
	// Path to Perl CGI interface.
	perlPath: undefined,

	// Extension API.
	// You can set custom handler for certain file extensions and either handle whole response or your own
	// or just return the data and let Anchora handle the rest
	// Custom handler received 4 arguments:
	// - `req`, `res` = typical http request/response objects.
	// - `sink` = current stream, typically res===sink except for http2 push streams.
	// - `desc` = file descriptor, extends results of fs.stat.
	// Custom handler can either handle responding and return nothing, or return data to be handled and sent by Anchora.
	// Example:
	//   Simple one-liner that reads file, passes it to some 3rd party markdown parser and returns the result back to anchora.
	//   options.extension.md = (req, res, sink, desc) => markdownToHtml(fs.readFileSync(desc.fsPath))
	extension: {},

}

export function applyArgs(args) {
	Object.assign(this, defaultOptions)

	switch (args.length) {
		case 3:
			// createServer('type', port, 'preset')
			// createServer('type', [portUnsecure, portSecure], 'preset')
			// createServer('type', port, {options})
			// createServer('type', [portUnsecure, portSecure], {options})
			var [type, port, arg] = args
			this.applyPreset(arg)
			this.type = type
			this.port = port
			break
		case 2:
			// createServer('type', 'preset')
			// createServer('type', port)
			// createServer('type', [ports, portSecure])
			var [type, arg] = args
			if (Array.isArray(arg) || typeof arg === 'number')
				this.port = arg
			else
				this.applyPreset(arg)
			this.type = type
			break
		default:
			// createServer([portUnsecure, portSecure])
			// createServer(port)
			// createServer('type')
			// createServer('preset')
			// createServer({options})
			var [arg] = args
			var argType = typeof arg
			if (Array.isArray(arg)) {
				this.type = 'both'
				this.port = arg
			} else if (argType === 'number') {
				this.port = arg
			} else if (argType === 'string' || argType === 'object') {
				this.applyPreset(arg)
			}
			break
	}
}

export function applyPreset(arg) {
	if (arg === 'dev') {
		var options = {
			// Shows file browser if directory without index.html is visited.
			dirBrowser: true,
			// Sets 'cache-control' header to 'must-revalidate' and handles cache using ETags.
			cacheControl: 'must-revalidate',
			// Pushes all file types (HTTP2 only).
			pushMode: 'aggressive',
			// Disables on-the-fly gzip encoding.
			gzip: false,
			// Includes CORS headers in all responses.
			cors: true,
			// Forbids upgrading unsecure HTTP connections to HTTPS (or HTTP2).
			forceUpgrade: false,
			allowUpgrade: false,
		}
	} else if (arg === 'production' || arg === 'prod') {
		var options = {
			// Does not show file browser to increase security.
			dirBrowser: false,
			//cacheControl: 1000 * 60 * 24,
			// Only pushes certain file types (HTTP2 only).
			pushMode: 'optimized',
			// Enables on-the-fly gzip compressions of files to reduce bandwith.
			gzip: true,
			// Allow upgrading to HTTPS connections if browser requests it. Is not enforced though.
			allowUpgrade: true,
		}
	} else if (typeof arg === 'string') {
		debug('Unknown preset')
		var options = {}
	} else if (typeof arg === 'object') {
		// Not a name of preset, probably just options object to be passed through.
		var options = arg
	}
	Object.assign(this, options)
}

export function applyTypePreset() {
	switch (this.type) {
		case 'http':
		case 'http1':
			this.http  = true  // Has unsecure port served over http1
			this.https = false // Doesn't have secure port served over https
			this.http2 = false // Doesn't have secure port served over http2
			break
		case 'https':
			this.http  = false // Doesn't have unsecure port served over http1
			this.https = true  // Has secure port served over https
			this.http2 = false // Doesn't have secure port served over http2
			break
		case 'http2':
			this.http  = false // Doesn't have unsecure port served over http1
			this.https = false // Doesn't have secure port served over https
			this.http2 = true  // Has secure port served over http2
			break
		case 'hybrid':
			// 80 server over HTTP1, 443 served over HTTP2
			this.http  = true  // Has unsecure port served over http1
			this.https = false // Doesn't have secure port served over https
			this.http2 = true  // Has secure port served over http2
			break
		default:
		case 'both':
			// 80 server over HTTP, 443 served over HTTPS
			this.http  = true  // Has unsecure port served over http1
			this.https = true  // Has secure port served over https
			this.http2 = false // Doesn't have secure port served over http2
			break
	}
	this.type = undefined
}

export function applyPort(port) {
	// `port` is alias for either or both of `portSecure` and `portUnsecure`
	if (typeof port === 'number') {
		if (port === 443 || this.https || this.http2)
			this.portSecure = port
		else
			this.portUnsecure = port
	} else if (Array.isArray(port)) {
		this.portUnsecure = port[0]
		this.portSecure = port[1]
	}
	this.port = undefined
}

export function normalizeOptions() {

	// Convert and apply `this.type` unless either of `this.http`, `this.https`, `this.http2` is defined.
	if (this.type !== undefined)
		this.applyTypePreset()

	if (this.port !== undefined)
		this.applyPort(this.port)

	if (this.crtPath)
		this.certPath = this.crtPath

	this.defaultCertPath = path.join(this.certDir, `${this.certName}.crt`)
	this.defaultKeyPath  = path.join(this.certDir, `${this.certName}.key`)

	// HTTP1 does not support streamig (only HTTP2 does).
	//if (!this.http2)
	//	this.pushMode = false

	// If `pushMode` isn't boolean or name of the mode, it is an array of mimes allowed for pushing
	// and therefore an alias for `pushMimes` and 'optimized' push mode.
	if (Array.isArray(this.pushMode)) {
		this.pushMimes = this.pushMode
		this.pushMode = 'optimized'
	} else if (this.pushMode === 'false') {
		this.pushMode === false
	}

	var cc = this.cacheControl
	if (typeof cc === 'number' || cc === true) {
		this.maxAge = cc
		cc = `max-age=${cc}`
	} else if (cc === false) {
		cc = 'no-cache'
	}
	this.cacheControl = cc

	// `encoding` is more complex setting. Most just want to set `gzip` alias and be done with it.
	if (this.encoding === undefined)
		this.encoding = this.gzip
	// Actively compresses every served file.
	if (this.encoding === true)
		this.encoding = 'active'

	// `cors` is either boolean on string of origin path and therefore alias for `corsOrigin`.
	if (typeof this.cors === 'string')
		this.corsOrigin = this.cors
	if (Array.isArray(this.corsOrigin))
		this.corsOrigin = this.corsOrigin.join(', ')
	if (Array.isArray(this.corsMethods))
		this.corsMethods = this.corsMethods.join(', ')
	if (Array.isArray(this.corsHeaders))
		this.corsHeaders = this.corsHeaders.join(', ')

	if (!this.root)
		throw new Error('`root` options is not set')
}