import {debug} from './util.mjs'
import path from 'path'
import os from 'os'

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
	folderBrowser: true,
	// Server can respond with selected chunk of the file, delimeted by the requested 'range' header.
	// WARNING: Only single range is allowed. Multipart ranges are not implemented.
	acceptRanges: true,
	// TODO: Error response
	verboseError: undefined,
	unsafeError: undefined,


	// CORS - CROSS ORIGIN RESOURCE SHARING

	// Cross Origin headers are enabled by default.
	// Boolean or String (in which case it becomes alias for corsOrigin)
	cors: true,
	// Header 'access-control-allow-origin'
	// Allowed sites and origins.
	corsOrigin: '*',
	// Header 'access-control-allow-methods'. String or Array.
	// Methods handled by the server if the request comes from another origin.
	corsMethods: '*',
	// Header 'access-control-allow-headers'. String or Array.
	corsHeaders: '*',
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

	// Object of custom Headers
	// e.g. {'strict-transport-security': 'max-age=0'}
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
	// Default HTTP code to be used for redirecting from HTTP to HTTPS.
	redirectCodeHttps: 301, // Moved Permanently
	// Default HTTP code to be used for redirecting from / to /index.html and vice-versa.
	redirectCode: 302, // Found (temporary redirect)
	// Default mime type for files whose extensions cannot be resolved. (for example arduino .ino files).
	// 'text/plain' results in plain text displayed in browser whereas 'application/octet-stream' triggers download.
	unknownMime: 'text/plain',
	//unknownMime: 'application/octet-stream',


	// CERTIFICATES

	// Paths to custom certificate files. (Bypasses default CA root)
	certPath: undefined, // alias for `crtPath`
	crtPath: undefined,
	keyPath: undefined,
	// In memory data of the certificates.
	cert: undefined,
	key: undefined,
	// Name of the certificate and .crt file created for HTTPS and HTTP2 connections.
	certDir: path.join(os.homedir(), `.anchora-certificates`),


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

}





var presets = {

	dev: {
		// Shows file browser if directory without index.html is visited.
		folderBrowser: true,
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
		// Chrome annoyingly forces domain to always use https once it was used on the domain. This disables it.
		headers: {'strict-transport-security': 'max-age=0'}, // TODO: this may need to be integrated deeper
		// CORS
		cors: true,
		corsOrigin: '*',
		corsMethods: '*',
		corsHeaders: '*',
		// TODO
		verboseError: true,
		unsafeError: true,
	},

	prod: {
		// Does not show file browser to increase security.
		folderBrowser: false,
		//cacheControl: 1000 * 60 * 24,
		// Only pushes certain file types (HTTP2 only).
		pushMode: 'optimized',
		// Enables on-the-fly gzip compressions of files to reduce bandwith.
		gzip: true,
		// Allow upgrading to HTTPS connections if browser requests it. Is not enforced though.
		allowUpgrade: true,
		// CORS
		cors: true,
		corsOrigin: '*',
		corsMethods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
		corsHeaders: ['accept', 'accept-language', 'content-language', 'content-type', 'x-requested-with'],
		// TODO
		verboseError: false,
		unsafeError: false,
	},

}
// aliases
presets.development = presets.dev
presets.production = presets.prod


var serverTypes = {
	http: {
		http:  true,  // Has unsecure port served over http1
		https: false, // Doesn't have secure port served over https
		http2: false, // Doesn't have secure port served over http2
	},
	https: {
		http:  false, // Doesn't have unsecure port served over http1
		https: true,  // Has secure port served over https
		http2: false, // Doesn't have secure port served over http2
	},
	http2: {
		http:  false, // Doesn't have unsecure port served over http1
		https: false, // Doesn't have secure port served over https
		http2: true,  // Has secure port served over http2
	},
	hybrid: {
		// 80 server over HTTP1, 443 served over HTTP2
		http:  true,  // Has unsecure port served over http1
		https: false, // Doesn't have secure port served over https
		http2: true,  // Has secure port served over http2
	},
	both: {
		// 80 server over HTTP, 443 served over HTTPS
		http:  true,  // Has unsecure port served over http1
		https: true,  // Has secure port served over https
		http2: false, // Doesn't have secure port served over http2
	}
}
// aliases
serverTypes.http1 = serverTypes.http



var isPreset     = arg => typeof arg === 'string' && presets[arg] !== undefined
var isTypePreset = arg => typeof arg === 'string' && serverTypes[arg] !== undefined
var isPort       = arg => typeof arg === 'number' || Array.isArray(arg)

export function applyPreset(arg) {
	if (isPreset(arg))
		Object.assign(this, presets[arg])
	else
		debug('Unknown preset', arg)
}

export function applyTypePreset(arg) {
	if (isTypePreset(arg))
		Object.assign(this, serverTypes[arg])
	else
		Object.assign(this, serverTypes.both)
		this.type = undefined
}

export function applyPort(arg) {
	// `port` property is alias for either or both of `portSecure` and `portUnsecure`
	if (typeof arg === 'number') {
		if (arg === 443 || this.https || this.http2)
			this.portSecure = arg
		else
			this.portUnsecure = arg
	} else if (Array.isArray(arg)) {
		this.portUnsecure = arg[0]
		this.portSecure = arg[1]
	}
	this.port = undefined
}


export function applyArgs(args) {
	if (args.length === 0) {
		// NOTE: Class' derivatives using decorators are able to set instance values even
		//       before calling super() so this careful assignment (as to no overwrite anything)
		//       is necessary for some users.
		for (var [key, val] of Object.entries(defaultOptions)) {
			if (this[key] === undefined)
				this[key] = val
		}
		this.autoStart = false
	} else {
		Object.assign(this, defaultOptions)
		for (var arg of args) {
			if (isPreset(arg))
				this.applyPreset(arg)
			else if (isTypePreset(arg))
				this.applyTypePreset(arg)
			else if (isPort(arg))
				this.applyPort(arg)
			else if (typeof arg === 'object')
				Object.assign(this, arg)
			else
				debug('unknown arg', arg)
		}
	}
}

export function normalizeOptions() {

	// Convert and apply `this.type` unless either of `this.http`, `this.https`, `this.http2` is defined.
	if (this.type !== undefined)
		this.applyTypePreset(this.type)

	if (this.port !== undefined)
		this.applyPort(this.port)

	if (this.certPath)
		this.crtPath = this.certPath

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
	if (typeof this.cors === 'string')   this.corsOrigin  = this.cors
	if (Array.isArray(this.corsOrigin))  this.corsOrigin  = this.corsOrigin.join(', ')
	if (Array.isArray(this.corsMethods)) this.corsMethods = this.corsMethods.join(', ')
	if (Array.isArray(this.corsHeaders)) this.corsHeaders = this.corsHeaders.join(', ')

	if (!this.root)
		throw new Error('`root` options is not set')
}