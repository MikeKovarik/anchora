(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('fs'), require('path'), require('util'), require('debug'), require('url'), require('child_process'), require('selfsigned'), require('zlib'), require('stream'), require('mime/lite'), require('link-extract'), require('events'), require('http'), require('https'), require('http2')) :
	typeof define === 'function' && define.amd ? define(['exports', 'fs', 'path', 'util', 'debug', 'url', 'child_process', 'selfsigned', 'zlib', 'stream', 'mime/lite', 'link-extract', 'events', 'http', 'https', 'http2'], factory) :
	(factory((global.anchora = {}),global.fs,global.path,global.util,global.debug,global.url,global.child_process,global.selfsigned,global.zlib,global.stream,global['mime/lite'],global['link-extract'],global.events,global.http,global.https,global.http2));
}(this, (function (exports,fsSync,path,util,nodeDebug,urlModule,cp,selfsigned,zlib,stream,mimeLib,linkExtract,events,http,https,http2) { 'use strict';

fsSync = fsSync && fsSync.hasOwnProperty('default') ? fsSync['default'] : fsSync;
path = path && path.hasOwnProperty('default') ? path['default'] : path;
util = util && util.hasOwnProperty('default') ? util['default'] : util;
nodeDebug = nodeDebug && nodeDebug.hasOwnProperty('default') ? nodeDebug['default'] : nodeDebug;
urlModule = urlModule && urlModule.hasOwnProperty('default') ? urlModule['default'] : urlModule;
cp = cp && cp.hasOwnProperty('default') ? cp['default'] : cp;
selfsigned = selfsigned && selfsigned.hasOwnProperty('default') ? selfsigned['default'] : selfsigned;
zlib = zlib && zlib.hasOwnProperty('default') ? zlib['default'] : zlib;
stream = stream && stream.hasOwnProperty('default') ? stream['default'] : stream;
mimeLib = mimeLib && mimeLib.hasOwnProperty('default') ? mimeLib['default'] : mimeLib;
events = events && events.hasOwnProperty('default') ? events['default'] : events;
http = http && http.hasOwnProperty('default') ? http['default'] : http;
https = https && https.hasOwnProperty('default') ? https['default'] : https;
http2 = http2 && http2.hasOwnProperty('default') ? http2['default'] : http2;

// Use 'debug' module by default but allow user to use custom logging function.
var originalDebug = nodeDebug('anchora');
exports.debug = originalDebug;
function changeDebugger(customLog) {
	exports.debug = customLog;
}
function resetDebugger() {
	exports.debug = originalDebug;
}

var {promisify} = util;
var fs = {
	readdir: promisify(fsSync.readdir),
	readFile: promisify(fsSync.readFile),
	writeFile: promisify(fsSync.writeFile),
	stat: promisify(fsSync.stat),
	createReadStream: fsSync.createReadStream,
	mkdir: promisify(fsSync.mkdir),
};

const HTTPCODE = {
	200: 'OK',
	206: 'Partial Content',
	301: 'Moved Permanently',
	302: 'Moved Temporarily',
	304: 'Not Modified',
	400: 'Bad Request',
	403: 'Forbidden',
	404: 'Not Found',
	416: 'Requested Range Not Satisfiable',
	500: 'Internal Server Error',
};

// Unescapes special characters and removes query and hashes.
// Trims query strings (? and everything that follows in url).
function sanitizeUrl(url) {
	url = decodeURI(url);
	var index = url.indexOf('?');
	if (index !== -1)
		return url.slice(0, index)
	return url
}

// options object gets passed as an argument to https.Server or http2.SecureServer (and tls.Server)
// https://nodejs.org/dist/latest-v9.x/docs/api/tls.html#tls_tls_createserver_options_secureconnectionlistener
// https://nodejs.org/dist/latest-v9.x/docs/api/http2.html#http2_http2_createsecureserver_options_onrequesthandler

var defaultOptions = {

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

};

function applyArgs(args) {
	Object.assign(this, defaultOptions);

	switch (args.length) {
		case 3:
			// createServer('type', port, 'preset')
			// createServer('type', [portUnsecure, portSecure], 'preset')
			// createServer('type', port, {options})
			// createServer('type', [portUnsecure, portSecure], {options})
			var [type, port, arg] = args;
			this.applyPreset(arg);
			this.type = type;
			this.port = port;
			break
		case 2:
			// createServer('type', 'preset')
			// createServer('type', port)
			// createServer('type', [ports, portSecure])
			var [type, arg] = args;
			if (Array.isArray(arg) || typeof arg === 'number')
				this.port = arg;
			else
				this.applyPreset(arg);
			this.type = type;
			break
		default:
			// createServer([portUnsecure, portSecure])
			// createServer(port)
			// createServer('type')
			// createServer('preset')
			// createServer({options})
			var [arg] = args;
			var argType = typeof arg;
			if (Array.isArray(arg)) {
				this.type = 'both';
				this.port = arg;
			} else if (argType === 'number') {
				this.port = arg;
			} else if (argType === 'string' || argType === 'object') {
				this.applyPreset(arg);
			}
			break
	}
}

function applyPreset(arg) {
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
		};
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
		};
	} else if (typeof arg === 'string') {
		exports.debug('Unknown preset');
		var options = {};
	} else if (typeof arg === 'object') {
		// Not a name of preset, probably just options object to be passed through.
		var options = arg;
	}
	Object.assign(this, options);
}

function applyTypePreset() {
	switch (this.type) {
		case 'http':
		case 'http1':
			this.http  = true;  // Has unsecure port served over http1
			this.https = false; // Doesn't have secure port served over https
			this.http2 = false; // Doesn't have secure port served over http2
			break
		case 'https':
			this.http  = false; // Doesn't have unsecure port served over http1
			this.https = true;  // Has secure port served over https
			this.http2 = false; // Doesn't have secure port served over http2
			break
		case 'http2':
			this.http  = false; // Doesn't have unsecure port served over http1
			this.https = false; // Doesn't have secure port served over https
			this.http2 = true;  // Has secure port served over http2
			break
		case 'hybrid':
			// 80 server over HTTP1, 443 served over HTTP2
			this.http  = true;  // Has unsecure port served over http1
			this.https = false; // Doesn't have secure port served over https
			this.http2 = true;  // Has secure port served over http2
			break
		default:
		case 'both':
			// 80 server over HTTP, 443 served over HTTPS
			this.http  = true;  // Has unsecure port served over http1
			this.https = true;  // Has secure port served over https
			this.http2 = false; // Doesn't have secure port served over http2
			break
	}
	this.type = undefined;
}

function applyPort(port) {
	// `port` is alias for either or both of `portSecure` and `portUnsecure`
	if (typeof port === 'number') {
		if (port === 443 || this.https || this.http2)
			this.portSecure = port;
		else
			this.portUnsecure = port;
	} else if (Array.isArray(port)) {
		this.portUnsecure = port[0];
		this.portSecure = port[1];
	}
	this.port = undefined;
}

function normalizeOptions() {

	// Convert and apply `this.type` unless either of `this.http`, `this.https`, `this.http2` is defined.
	if (this.type !== undefined)
		this.applyTypePreset();

	if (this.port !== undefined)
		this.applyPort(this.port);

	if (this.crtPath)
		this.certPath = this.crtPath;

	this.defaultCertPath = path.join(this.certDir, `${this.certName}.crt`);
	this.defaultKeyPath  = path.join(this.certDir, `${this.certName}.key`);

	// HTTP1 does not support streamig (only HTTP2 does).
	//if (!this.http2)
	//	this.pushMode = false

	// If `pushMode` isn't boolean or name of the mode, it is an array of mimes allowed for pushing
	// and therefore an alias for `pushMimes` and 'optimized' push mode.
	if (Array.isArray(this.pushMode)) {
		this.pushMimes = this.pushMode;
		this.pushMode = 'optimized';
	} else if (this.pushMode === 'false') {
		this.pushMode === false;
	}

	var cc = this.cacheControl;
	if (typeof cc === 'number' || cc === true) {
		this.maxAge = cc;
		cc = `max-age=${cc}`;
	} else if (cc === false) {
		cc = 'no-cache';
	}
	this.cacheControl = cc;

	// `encoding` is more complex setting. Most just want to set `gzip` alias and be done with it.
	if (this.encoding === undefined)
		this.encoding = this.gzip;
	// Actively compresses every served file.
	if (this.encoding === true)
		this.encoding = 'active';

	// `cors` is either boolean on string of origin path and therefore alias for `corsOrigin`.
	if (typeof this.cors === 'string')
		this.corsOrigin = this.cors;
	if (Array.isArray(this.corsOrigin))
		this.corsOrigin = this.corsOrigin.join(', ');
	if (Array.isArray(this.corsMethods))
		this.corsMethods = this.corsMethods.join(', ');
	if (Array.isArray(this.corsHeaders))
		this.corsHeaders = this.corsHeaders.join(', ');

	if (!this.root)
		throw new Error('`root` options is not set')
}

var optionsProto = Object.freeze({
	defaultOptions: defaultOptions,
	applyArgs: applyArgs,
	applyPreset: applyPreset,
	applyTypePreset: applyTypePreset,
	applyPort: applyPort,
	normalizeOptions: normalizeOptions
});

// Shims some http2 colon headers into http1 'req' object.
function shimHttp1ToBeLikeHttp2(req) {
	var {headers} = req;
	if (headers.host === undefined)
		headers.host = headers[':authority'];
	if (headers[':authority'] === undefined)
		headers[':authority'] = headers.host;
	headers[':path'] = req.url;
	headers[':method'] = req.method;
	headers[':scheme'] = req.connection.encrypted ? 'https' : 'http';
}

// Returns http1 like 'req' object out of http2 headers.
function createHttp1LikeReq(headers) {
	if (headers.host === undefined)
		headers.host = headers[':authority'];
	return {
		url: headers[':path'],
		method: headers[':method'],
		headers,
	}
}

function shimResMethods(stream$$1) {
	//
	stream$$1.stream = stream$$1;
	//
	stream$$1._resHeaders = {};
	stream$$1.setHeader = setHeader;
	stream$$1.getHeader = getHeader;
	//
	stream$$1.writeHead = writeHead;
}

function getHeader(name) {
	return this._resHeaders[name.toLowerCase()]
}

function setHeader(name, value) {
	this._resHeaders[name.toLowerCase()] = value;
}

function writeHead(code = this.statusCode, resHeaders) {
	// TODO: handle case sensitivity of headers
	if (resHeaders)
		resHeaders = Object.assign(this._resHeaders, resHeaders);
	else
		resHeaders = this._resHeaders;
	resHeaders[':status'] = code;
	this.respond(resHeaders);
}

// V8 likes predictable objects
class CacheRecord {
	constructor(desc) {
		this.etag = undefined;
		this.size = 0;
		this.reads = 0;
		this.buffer = undefined;
		this.deps = undefined;
		this.lastAccess = undefined;
	}
}


class AnchoraCache extends Map {

	constructor(server) {
		super();
		this.server = server;
		this.cleanup = this.cleanup.bind(this);
		this.cleanupInterval = setInterval(this.cleanup, this.server.cacheCleanupInterval);
	}

	get memory() {
		var memoryTaken = 0;
		var records = Array.from(this.values());
		var timeThreshold = Date.now() - this.server.cacheMaxAge;
		for (var record of records) {
			// Cleanup older records
			if (record.lastAccess < timeThreshold)
				record.buffer = undefined;
			else if (record.buffer)
				memoryTaken += record.size;
		}
		return memoryTaken
	}

	// NOTE: Does not remove records, only buffered data if any is stored.
	//       Dependency lists are stored forever.
	// TODO: long running server will oveflow 'reads'
	cleanup() {
		var {cacheSize} = this.server;
		var memoryTaken = this.memory;
		exports.debug('cleaning cache, currently stored', formatBytes(memoryTaken));
		if (memoryTaken > cacheSize) {
			// Sort from least to most used.
			records = Array.from(this.values()).sort((a, b) => a.reads - b.reads);
			let i = 0;
			let record;
			while (memoryTaken > cacheSize) {
				record = records[i];
				record.buffer = undefined;
				memoryTaken -= record.size;
				i++;
			}
		}
	}

	setBuffer(desc, buffer) {
		var record = this.get(desc.url) || new CacheRecord;
		record.buffer = buffer;
		record.etag = desc.etag;
		record.size = desc.size;
		record.lastAccess = Date.now();
		this.set(desc.url, record);
	}

	setDeps(desc, deps) {
		var record = this.get(desc.url) || new CacheRecord;
		record.deps = deps;
		record.etag = desc.etag;
		record.size = desc.size;
		record.lastAccess = Date.now();
		this.set(desc.url, record);
	}

	get(url) {
		var record = super.get(url);
		if (record) {
			record.reads++;
			record.lastAccess = Date.now();
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

async function serve(req, res) {

	// Upgrade unsecure HTTP requests to HTTPS if HTTPS is running and 'upgrade-insecure-requests' header
	// is set. Alternatively force redirect everyone all the time with options.forceUpgrade.
	if ((!req.connection.encrypted && this.serverSecure && this.allowUpgrade !== false)
	&& (this.forceUpgrade || req.headers['upgrade-insecure-requests'] === '1')) {
		var host = req.headers.host ? req.headers.host.split(':')[0] : 'localhost';
		var redirectUrl = 'https://'
						+ host
						+ (this.portSecure !== 443 ? ':' + this.portSecure : '')
						+ req.url;
		res.setHeader('location', redirectUrl);
		res.setHeader('vary', 'upgrade-insecure-requests');
		res.writeHead(301);
		res.end();
		return
	}

	// Collect stat, mime and other basic information about the file.
	var desc = await this.openDescriptor(req.url);

	// File, nor folder doesn't exist. Throw 404.
	if (!desc.exists) {
		exports.debug(desc.fsPath, 404, 'Not Found');
		return this.serveError(res, 404)
	}

	// Copy user defined default headers into response.
	this.setDefaultHeaders(res);

	// Apply CORS headers if allowed.
	if (this.cors)
		this.setCorsHeaders(res);

	// Cancerous Security Policy.
	if (this.csp)
		res.setHeader('content-security-policy', this.csp);

	// Signaling for client that server doesn't/accepts range requests.
	if (!this.acceptRanges || this.acceptRanges === 'none')
		res.setHeader('accept-ranges', 'none');
	else
		res.setHeader('accept-ranges', 'bytes');

	// Try to actually serve the file or folder (render list of contents).
	try {
		if (desc.folder)
			this.serveFolder(req, res, desc);
		else if (desc.file)
			this.serveFile(req, res, res.stream || res, desc);
		else
			this.serveError(res, 400);
	} catch(err) {
		this.serveError(res, 500, err);
	}
}

function serveError(res, code, err) {
	if (err) console.error(err);
	var body = `${code} ${HTTPCODE[code]}`;
	if (err) body += ', ' + err;
	res.setHeader('content-type', this.getContentType('text/plain'));
	res.setHeader('content-length', Buffer.byteLength(body));
	res.setHeader('cache-control', 'max-age=0');
	res.writeHead(code);
	res.write(body);
	res.end();
}

function getContentType(mime) {
	if (this.charset)
		return `${mime}; charset=${this.charset}`
	else
		return mime
}

var serveProto = Object.freeze({
	serve: serve,
	serveError: serveError,
	getContentType: getContentType
});

// 'req' & 'res' = Are the 'http' module's basic methods for handling request and serving response
// 'sink'        = Is used in place of 'res' to simplify work with both 'http' and 'http2' modules.
//                 In case of 'http' module: 'sink' === 'res'
//                 In case of 'http' module: file's 'stream', ('res.stream' if allowHTTP1 is enabled)
//                                           or a dependency's pushstream
// 'desc'        = Url, paths and stat info about the file we're about to serve.
async function serveFile(req, res, sink, desc) {

	//var isHttp1Request = res === sink
	//var isHttp2Stream = res.stream !== undefined
	var isPushStream = res.stream !== undefined && res.stream !== sink;
	exports.debug('-----------------------------------------');
	exports.debug('serveFile', req.httpVersion, isPushStream ? 'push' : 'request', desc.url);

	// Since we're combining 'http' and 'http2' modules and their different APIs, we need
	// to ensure presence of basic methods like .setHeader() on the sink stream object.
	if (sink && sink.setHeader === undefined)
		shimResMethods(sink);

	// Set 200 OK status by default.
	sink.statusCode = 200;
	sink.setHeader('content-type', this.getContentType(desc.mime));

	if (this.extension[desc.ext]) {
		try {
			let result = await this.extension[desc.ext](req, res, sink, desc);
			if (result !== undefined) {
				sink.writeHead(200);
				sink.write(result);
				sink.end();
			}
		} catch(err) {
			this.serveError(sink, 500, err);
		}
		return
	}

	// Experimental!
	if (this.cgi) {
		if (this.phpPath && desc.ext === 'php')
			return this.serveCgi(req, res, sink, desc, this.phpPath)
		if (this.rubyPath && desc.ext === 'rb')
			return this.serveCgi(req, res, sink, desc, this.rubyPath)
		if (this.perlPath && desc.ext === 'pl')
			return this.serveCgi(req, res, sink, desc, this.perlPath)
	}

	if (this.cacheControl !== false)
		this.setCacheControlHeaders(req, sink, desc, isPushStream);

	// Handle requests with 'range' header if allowed.
	// WARNING: Only partial implementation. Multipart requests not implemented.
	var range;
	if (this.acceptRanges && req.headers.range && !isPushStream)
		range = this.handleRangeHeaders(req, res, desc);

	// Waiting for ssync operations to finish might've left us with closed stream.
	if (sink.destroyed)
		return exports.debug(desc.name, 'cancelled, stream is closed')

	// Pushing peer dependencies can only be done in HTTP2 if parent stream
	// (of the initially requested file) exists and is still open.
	if (this.canPush(res) && desc.isParseable())
		await this.parseFileAndPushDependencies(req, res, desc);

	// Waiting for ssync operations to finish might've left us with closed stream.
	if (sink.destroyed)
		return exports.debug(desc.name, 'cancelled, stream is closed')

	// Now that we've taken care of push stream (and started pushing dependency files)
	// we can prevent unnecessay read and serving of file if it's unchanged.
	if (sink.statusCode === 304) {
		exports.debug(desc.name, 'unchanged, sending 304 and no data');
		sink.writeHead(sink.statusCode);
		sink.end();
		return
	}

	// Begin to actually reading the file (from disk or cache)
	exports.debug(desc.name, 'getting file');
	var fileStream;
	// Try to look for previously compressed file with .gz extension
	if (this.encoding === 'passive') {
		let gzippedDesc = await this.openDescriptor(desc.url + '.gz');
		if (gzippedDesc.exists) {
			sink.setHeader('content-encoding', 'gzip');
			exports.debug(desc.name, 'using pre-gzipped', gzippedDesc.name, instead);
			fileStream = await gzippedDesc.getReadStream(range);
		}
	}
	// Read the original file if .gz file is not found or enabled 
	if (!fileStream)
		fileStream = await desc.getReadStream(range);

	// Waiting for ssync operations to finish might've left us with closed stream.
	if (sink.destroyed)
		return exports.debug(desc.name, 'cancelled, stream is closed')

	// Compress (mostly GZIP) the file if active encoding is enabled.
	if (this.encoding === 'active') {
		let compressor = this.createCompressorStream(req, sink);
		fileStream = fileStream.pipe(compressor);
		sink.setHeader('transfer-encoding', 'chunked');
	} else if (range) {
		sink.setHeader('transfer-encoding', 'chunked');
	} else {
		sink.setHeader('content-length', desc.size);
	}

	// And finally serve the file by piping its read stream into sink stream.
	exports.debug(desc.name, 'sending data');
	sink.once('close', () => exports.debug(desc.name, 'sent, closing stream'));
	sink.writeHead(sink.statusCode);
	fileStream.pipe(sink);
	fileStream.once('error', err => this.serveError(sink, 500, err));
}

async function parseFileAndPushDependencies(req, res, desc) {
	if (res.pushedUrls === undefined)
		res.pushedUrls = new Set;
	let deps = await desc.getDependencies();
	exports.debug(desc.name, 'pushable deps', deps.map(d => d.url));
	// Every push, no matter how deep in the dependency tree it is, always relies on
	// original request's res.stream.
	if (deps.length && !this.isPushStreamClosed(res.stream)) {
		exports.debug(desc.name, 'pushing dependencies');
		// Opening push streams for all the dependencies at the same time in parallel.
		var promises = deps
			// Prevent push if this file hasalready been pushed (or is currently being pushed).
			.filter(depDesc => !res.pushedUrls.has(depDesc.url))
			.map(depDesc => this.pushFile(req, res, depDesc));
		// Waiting for push streams to open (only to be open, not for files to be sent!)
		// before serving the requested main file. Not waiting would cause closure of
		// the main stream and cancelation of all pushes (and their respective push streams).
		await Promise.all(promises);
		exports.debug(desc.name, 'dependency push streams opened');
	}
}

// Opens new push stream between server and client to serve as conduit for the file to be pushed through.
async function pushFile(req, res, desc) {
	if (this.isPushStreamClosed(res.stream))
		return exports.debug(desc.name, 'push not initated, stream is closed')
	// File hasn't been pushed yet, add it to the list of files to not push anymore
	// (if it's also a dependency of some other file in the project)
	res.pushedUrls.add(desc.url);
	// Open push stream.
	exports.debug(desc.name, 'push initated');
	try {
		// Open new push stream between server and client to serve as conduit for the file to be streamed.
		var pushStream = await openPushStream(res.stream, desc.url);
		exports.debug(desc.name, 'push open');
	} catch(err) {
		// Failed to open push stream.
		exports.debug(desc.name, 'push errored', err);
		res.pushedUrls.delete(desc.url);
		return
	}
	// Open file's descriptor to gather info about it.
	await desc.readStat();
	// Do not go on if the parent stream is already closed.
	if (!desc.exists || this.isPushStreamClosed(res.stream)) {
		exports.debug(desc.name, 'push cancelled');
		pushStream.destroy();
		return
	}
	// Adds shimmed http1 like 'res' methods onto 'stream' object.
	shimResMethods(pushStream);
	// Push the file to client as over the newly opened push stream.
	this.serveFile(req, res, pushStream, desc);
}


function canPush(res) {
	return this.http2
		&& this.pushMode
		&& res.stream
		&& !isPushStreamClosed(res.stream)
}

function isPushStreamClosed(stream$$1) {
	return stream$$1.destroyed || !stream$$1.pushAllowed
}

function openPushStream(parentStream, url) {
	return new Promise((resolve, reject) => {
		parentStream.pushStream({':path': url}, (err, pushStream) => {
			if (err)
				reject(err);
			else
				resolve(pushStream);
		});
	})
}

var serveFileProto = Object.freeze({
	serveFile: serveFile,
	parseFileAndPushDependencies: parseFileAndPushDependencies,
	pushFile: pushFile,
	canPush: canPush,
	isPushStreamClosed: isPushStreamClosed
});

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function commonjsRequire () {
	throw new Error('Dynamic requires are not currently supported by rollup-plugin-commonjs');
}

function unwrapExports (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var dirname = createCommonjsModule(function (module) {
// SIGH...
// https://github.com/nodejs/node-eps/blob/master/002-es-modules.md#4512-getting-cjs-variables-workaround
// Bundling is a pain as well.
if (__dirname.endsWith('src'))
	module.exports = __dirname;
else
	module.exports = path.join(__dirname, './src');
});

async function serveFolder(req, res, desc) {
	exports.debug('-----------------------------------------');
	exports.debug('serveFolder', desc.url);
	var indexPath = path.join(desc.fsPath, this.indexFile);
	try {
		// Trying to redirect to index.html.
		await fs.stat(indexPath);
		var indexUrl = path.join(desc.url, this.indexFile);
		res.setHeader('location', indexUrl);
		res.writeHead(301);
		res.end();
	} catch(err) {
		// Render contents of the folder if 'dirBrowser' is enabled or return 404.
		if (this.dirBrowser)
			this.renderFolder(req, res, desc, this);
		else
			this.serveError(res, 404, err);
	}
}

var fsBrowserCode;
fs.readFile(path.join(dirname, './dir-browser.html'))
	.then(buffer => fsBrowserCode = buffer.toString());

async function renderFolder(req, res, desc) {
	var folderData = await this.readDirJson(desc);
	if (req.url.endsWith('?anchora=json')) {
		res.setHeader('content-type', 'application/json');
		res.writeHead(200);
		res.end(JSON.stringify(folderData));
	} else {
		var html = fsBrowserCode;
		html = html.replace('/* TO BE ADDED BY SERVER HERE */', '= ' + JSON.stringify(folderData));
		res.setHeader('content-type', 'text/html');
		res.writeHead(200);
		res.end(html);
	}
}

async function readDirJson(desc) {
	var {fsPath, url} = desc;
	var names = await fs.readdir(fsPath);
	var promises = names.map(name => this.openDescriptor(path.posix.join(url, name)));
	return {
		url,
		descriptors: await Promise.all(promises)
	}
}


var serveDirectoryProto = Object.freeze({
	serveFolder: serveFolder,
	renderFolder: renderFolder,
	readDirJson: readDirJson
});

// BEWARE! Following code is an experimental implementation of CGI interface for
// running PHP and other scripting languages. Currently tightly coupled and not
// very well tested. Help and contributions are welcomed.

async function serveCgi(req, res, sink, desc, cgiPath) {
	var env = this.createCgiEnv(req, sink, desc);
	var cgi = cp.spawn(cgiPath, [], {env});

	// POST body is piped to 'stdin' of the CGI.
	if (req.readable)
		req.pipe(cgi.stdin);
	else if (req.body)
		cgi.stdin.end(req.body);

	var stdout = '';
	var onData = buffer => {
		var string = buffer.toString();
		stdout += string;
		var headerSeparator;
		if (string.includes('\r\n\r\n'))
			headerSeparator = '\r\n\r\n';
		else
			headerSeparator = '\n\n';
		if (headerSeparator !== undefined) {
			// Parse headers out of the stdout dump we've collected so far and write
			// it to the sink along with following first chunk of body.
			this.parseAndSendCgiHeaders(sink, stdout, headerSeparator);
			stdout = undefined;
			// Remove this header-parsing listener and start piping straight into sink.
			cgi.stdout.removeListener('data', onData);
			cgi.stdout.pipe(sink);
		}
	};

	cgi.stdout.on('data', onData);

	var onError = err => this.serveError(sink, 500, err);
	cgi.stderr.once('data', onError);

	cgi.once('close', code => {
        if (code)
            console.error(`CGI exited with code ${code}`);
		cgi.stderr.removeListener('data', onError);
    });

}


function parseAndSendCgiHeaders(sink, stdout, headerSeparator) {
	// Locate end of header / beggining of body
	var separatorLength = headerSeparator.length;
	let index = stdout.indexOf(headerSeparator);
	// Parse headers created inside the script and apply them the response Node is creating.
	let headers = stdout.slice(0, index).split(separatorLength === 4 ? '\r\n' : '\n');
	for (var i = 0; i < headers.length; i++) {
		var [name, value] = headers[i].split(':');
		name = name.toLowerCase();
		// Status header has to be ignored and used for assigning res.statusCode.
		if (name === 'status') {
			sink.statusCode = parseInt(value);
			continue
		}
		sink.setHeader(name, value || '');
	}
	// Script might return chunked response instead of exactly sized one.
	if (!sink.getHeader('content-length'))
		sink.setHeader('transfer-encoding', 'chunked');
	sink.writeHead(sink.statusCode);
	// Also write the beggining of the body that remains to the sink. 
	let bodyChunk = stdout.slice(index + separatorLength);
	sink.write(bodyChunk);
}


function createCgiEnv(req, sink, desc) {
	var uri = urlModule.parse(req.url);

	var REQUEST_SCHEME = req.headers[':scheme'];

	var root = this.root.replace(/\\/g, '\/');

	var env = {
		REDIRECT_STATUS: 200,
		GATEWAY_INTERFACE: 'CGI/1.1',
		SERVER_PROTOCOL: `HTTP/${req.httpVersion}`,
		//REQUEST_SCHEME,
		REQUEST_METHOD: req.method,
		QUERY_STRING: uri.query || '',
		REQUEST_URI: uri.href,
		SCRIPT_NAME: decodeURI(uri.pathname),
		SCRIPT_FILENAME: desc.fsPath.replace(/\\/g, '\/'),
		SERVER_ROOT: root,
		DOCUMENT_ROOT: root,
		CONTEXT_DOCUMENT_ROOT: root,
		SERVER_PORT: req.socket.localPort,
		SERVER_ADDR: req.socket.localAddress,
		REMOTE_ADDR: req.socket.remoteAddress,
		REMOTE_PORT: req.socket.remotePort,
		SERVER_SIGNATURE: `<address>${this.anchoraInfo}</address>`,
		SERVER_SOFTWARE: this.anchoraInfo,
		//PATH_INFO: '/',
	};

	// Passing headers from req.
	var headers = req.headers;
	for (var name in req.headers) {
		if (name.startsWith(':'))
			continue // HTTP2 is to be solved sometime in the future. 
		env['HTTP_' + name.toUpperCase().replace(/-/g, '_')] = headers[name];
	}
	if (req.headers.authorization)
		env.AUTH_TYPE = req.headers.authorization.split(' ')[0];

	// These are critical for POST requests with body.
	// PHP Wouldn't know how long of a body to expect without content length.
	if (req.headers['content-length'])
		env.CONTENT_LENGTH = req.headers['content-length'];
	if (req.headers['content-type'])
		env.CONTENT_TYPE = req.headers['content-type'];
	//if (req.headers['transfer-encoding'])
	//	env.TRANSFER_ENCODING = req.headers['transfer-encoding']

	// Adding custom user headers.
	if (this.cgiEnv)
		Object.assign(env, cgiEnv);

	return env
}

var serveCgiProto = Object.freeze({
	serveCgi: serveCgi,
	parseAndSendCgiHeaders: parseAndSendCgiHeaders,
	createCgiEnv: createCgiEnv
});

selfsigned.generate = util.promisify(selfsigned.generate);


// NOTE: Node's HTTPS and HTTP2 classes accept object with {key, cert} properties
//       but the file's extensions are .key and .crt therefore property names 'cert' and 'certPath'
//       are used in the options object.

async function loadOrGenerateCertificate() {
	if (this.certPath && this.keyPath) {
		await this.loadCertificate();
	} else {
		this.certPath = this.defaultCertPath;
		this.keyPath  = this.defaultKeyPath;
		try {
			await this.loadCertificate();
		} catch(err) {
			await this.generateCertificate();
			await this.storeCertificate();
			await this.installCertificate();
		}
	}
}

async function loadCertificate() {
	try {
		exports.debug('loading certificate');
		this.cert = await fs.readFile(this.certPath);
		this.key  = await fs.readFile(this.keyPath);
		exports.debug('certificate loaded');
	} catch(err) {
		throw new Error(`loading certificate failed, ${err.message}`)
	}
}

async function generateCertificate() {
	try {
		exports.debug('generating certificate');
		// NOTE: selfsigned won't create certificate unless the name is 'commonName'
		var selfsignedAttrs   = this.selfsignedAttrs   || [{name: 'commonName', value: 'localhost'}];
		var selfsignedOptions = this.selfsignedOptions || {days: 365};
		var result = await selfsigned.generate(selfsignedAttrs, selfsignedOptions);
		this.cert = result.cert;
		this.key  = result.private;
		exports.debug('certificate generated');
	} catch(err) {
		throw new Error(`generating certificate failed, ${err.message}`)
	}
}

async function storeCertificate() {
	try {
		await ensureDirectory(this.certDir);
		await fs.writeFile(this.certPath, this.cert);
		await fs.writeFile(this.keyPath,  this.key),
		exports.debug('certificate stored');
	} catch(err) {
		throw new Error(`storing certificate failed, ${err.message}`)
	}
}

async function installCertificate() {
	try {
		exports.debug('installing certificate');
		switch (process.platform) {
			case 'win32':
				await exec(`certutil -addstore -user -f root "${this.certPath}"`);
			case 'darwin':
				// TODO
				return
			default:
				// copy crt file to
				await ensureDirectory(`/usr/share/ca-certificates/extra/`);
				await fs.writeFile(`/usr/share/ca-certificates/extra/${this.certName}.cert`, this.cert);
				//return exec('sudo update-ca-certificates')
		}
		exports.debug('certificate installed');
	} catch(err) {
		throw new Error(`certificate installation failed, ${err.message}`)
	}
}

async function ensureDirectory(directory) {
	try {
		await fs.stat(directory);
	} catch(err) {
		await fs.mkdir(directory);
	}
}

function exec(command) {
	return new Promise((resolve, reject) => {
		cp.exec(command, (error, stdout, stderr) => {
			if (error || stderr)
				reject(error || stderr);
			else
				resolve(stdout);
		});
	})
}


var certProto = Object.freeze({
	loadOrGenerateCertificate: loadOrGenerateCertificate,
	loadCertificate: loadCertificate,
	generateCertificate: generateCertificate,
	storeCertificate: storeCertificate,
	installCertificate: installCertificate
});

function setDefaultHeaders(res) {
	// Copy user defined default headers into response.
	if (this.headers)
		for (var key in this.headers)
			res.setHeader(key, this.headers[key]);
	// Assign headers with information about Anchora and version.
	res.setHeader('server', this.anchoraInfo);
	res.setHeader('x-powered-by', this.anchoraInfo);
}

function setCorsHeaders(res) {
	// Website you wish to allow to connect
	var origin = typeof this.cors === 'string' ? this.cors : this.corsOrigin;
	res.setHeader('access-control-allow-origin', origin);
	// Request methods you wish to allow
	res.setHeader('access-control-allow-methods', this.corsMethods);
	// Request headers you wish to allow
	res.setHeader('access-control-allow-headers', this.corsHeaders);
	// Set to true if you need the website to include cookies in the requests sent
	// to the API (e.g. in case you use sessions)
	res.setHeader('access-control-allow-credentials', this.corsCredentials);
}

function handleRangeHeaders(req, res, desc) {
	var rangeHeader = req.headers.range;
	var ifRangeHeader = req.headers['if-range'];
	if (ifRangeHeader) {
		// TODO
		// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Range
		var conditionFulfilled = false; // TODO
		if (!conditionFulfilled)
			return
	}
	// TODO: If-Range
	var ranges = rangeHeader
		.slice(rangeHeader.indexOf('=') + 1)
		.split(',')
		.map(rangeString => {
			let split = rangeString.split('-');
			return {
				start: parseInt(split[0]),
				end:   split[1] ? parseInt(split[1]) : undefined
			}
		});

	if (ranges && ranges.length) {
		// One or more ranges were requested.
		// WARNING: Multipart ranges are not yet supported.
		var range = ranges[0];
		if (validateRange(range, desc)) {
			res.statusCode = 206;
		} else {
			res.statusCode = 416;
			range = undefined;
		}
		return range
	} else {
		// No ranges, or conditional if-range header failed. Return full file with 200.
	}
}

function validateRange(range, desc) {
	// NOTE: End value that is beyond the size of the file is actualy valid and OK.
	return range.start >= 0
		&& range.start < desc.size
		//&& (range.end === undefined || range.end < desc.size)
}


function setCacheControlHeaders(req, sink, desc, isPushStream) {
	var modified = desc.mtime.toUTCString();
	sink.setHeader('last-modified', modified);
	sink.setHeader('etag', desc.etag);

	// No need to set further cache headers for pushed files.
	if (isPushStream)
		return

	// Prevent additional cache realted headers if cache is explicitly disabled by the request.
	var cacheControl = req.headers['cache-control'] || req.headers.pragma;
	if (cacheControl === 'no-cache' || cacheControl === 'max-age=0')
		return

	// Client sent us info about version of the file he has stored in browser cache.
	// If file hasn't changed since hte last time it was server, we might skip sending it again. 
	var ifNoneMatch = req.headers['if-none-match'];
	// NOTE: 'if-none-match' could contain list of etags and those might or might not be prepended with W/ and wrapped in quotes.
	if (ifNoneMatch && ifNoneMatch.includes(desc._etag))
		sink.statusCode = 304;
	else if (req.headers['if-modified-since'] === modified)
		sink.statusCode = 304;

	// Finally set 'cache-control' header to either 'max-age=...' or 'must-revalidate'.
	if (this.maxAge === undefined) {
		// More reliable, HTTP 1.1 and 'must-revalidate' friendly way of determining file freshness.
		sink.setHeader('cache-control', this.cacheControl);
	} else {
		// NOTE: Using time/date/age based makes Chrome store the files in local cache for the given ammount of time
		//       and never ask for them (not even for 304) until they're expired despite 'cache-control' 'must-revalidate'.
		var expires = new Date(Date.now() + this.maxAge * 1000);
		sink.setHeader('expires', expires.toUTCString());
	}
}


var headersProto = Object.freeze({
	setDefaultHeaders: setDefaultHeaders,
	setCorsHeaders: setCorsHeaders,
	handleRangeHeaders: handleRangeHeaders,
	setCacheControlHeaders: setCacheControlHeaders
});

function openDescriptor(url, readStatImmediately = true) {
	var desc = new ReqTargetDescriptor(this, url, readStatImmediately);
	if (readStatImmediately)
		return desc.ready
	return desc
}

// NOTE: this class is disposable and is only valid during single request. After that it is disposed.
class ReqTargetDescriptor {

	constructor(server, url, readStatImmediately = true) {
		this.url = sanitizeUrl(url);
		this.fsPath = path.join(server.root, this.url);
		var parsed = path.parse(this.fsPath);
		this.name = parsed.base;
		this.dir = parsed.dir;
		this.ext = path.extname(this.name).slice(1).toLowerCase();
		// NOTE: mime returns null for unknown types. We fall back to plain text in such case.
		this.mime = mimeLib.getType(this.ext) || server.unknownMime;
		this._statWasRead = false;
		if (readStatImmediately)
			this.ready = this.readStat();
		// Passing refference to server instance and its options.
		this.server = server;
		this.cache = server.cache;
	}

	async readStat() {
		// Skip reading fs.stat if it has already been read.
		if (this._statWasRead)
			return
		try {
			let stat = await fs.stat(this.fsPath);
			this.file = stat.isFile();
			this.folder = !this.file;
			//this.folder = stat.isDirectory()
			this.size = stat.size;
			this.mtime = stat.mtime;
			this.mtimeMs = stat.mtimeMs;
			this.ino = stat.ino;
			if (this.file)
				this.etag = this.createEtag();
			this.exists = true;
		} catch(err) {
			this.exists = false;
		}
		this._statWasRead = true;
		return this
	}

	// Gets cached buffer or opens Opens buffer, cache it, convert to stream and serve.
	async getReadStream(range) {
		// Try to get 
		if (range && range.end === undefined)
			range.end = this.size - 1;
		if (this.isCacheable()) {
			var buffer = await this.getBuffer();
			if (range)
				buffer = buffer.slice(range.start, range.end + 1);
			return createReadStreamFromBuffer(buffer)
		} else {
			exports.debug(this.name, 'reading from disk (stream)');
			// Open Stream.
			return fs.createReadStream(this.fsPath, range)
		}
	}

	async getBuffer(cached) {
		// Try to retrieve the buffer from cache if argument is true.
		if (cached === undefined)
			cached = this.cache.get(this.url);
		// Return most up to date buffer.
		if (cached && cached.buffer && this.isUpToDate(cached)) {
			// Return the buffer from cached record if it's up to date.
			exports.debug(this.name, 'retrieving from cache');
			return await cached.buffer
		} else {
			// Cached buffer is not up to date or is not cached at all.
			// Read it fresh from disk.
			exports.debug(this.name, 'reading from disk (buffer)');
			var bufferPromise = fs.readFile(this.fsPath);
			if (this.isCacheable()) {
				this.cache.setBuffer(this, bufferPromise);
				var buffer = await bufferPromise;
				this.cache.setBuffer(this, buffer);
				return buffer
			} else {
				return bufferPromise
			}
		}
	}

	isUpToDate(cached) {
		return cached.etag && cached.etag === this.etag
	}


	// Return list of file's dependencies (fresh) and estimate of nested dependencies.
	// That is to prevent unnecessary slow disk reads of all files because window of opportunity
	// for pushing is short and checking freshness and possible reparsing of each file
	// would take a long time.
	// Best case scenario: Dependency files didn't change since we last parsed them.
	//                     Full and correct dependency tree is acquired.
	// Worst case scenario: Most dependency files either change or aren't parsed yet.
	//                      We're pushing incomplete list of files some of which might not be needed at all.
	//                      Client then re-requests missing files with another GETs. We cache and parse it then.
	async getDependencies() {
		var allDeps = new Map;
		// Try to use cached dependencies if there are any or read and parse the file on spot.
		var cached = this.cache.get(this.url);
		if (cached && cached.deps && cached.etag === this.etag) {
			// The file has been parsed before and it hasn't changed since. Use the cached dependency list.
			exports.debug(this.name, 'deps up to date');
			this._insertDescriptors(allDeps, cached.deps);
		} else {
			// The file hasn't been parsed or it has changed since.
			exports.debug(this.name, 'parsing');
			var buffer = await this.getBuffer(cached);
			// Parse for the first time.
			var descriptors = this.parseDependencies(buffer, this);
			// Store the dependencies as array.
			this.cache.setDeps(this, descriptors.map(desc => desc.url));
			// Add the dependency descriptors into a map of all deps to be pushed.
			descriptors.forEach(desc => {
				allDeps.set(desc.url, desc);
			});
		}

		allDeps.forEach((desc, url) => {
			var cached = this.cache.get(url);
			if (cached && cached.deps)
				this._insertDescriptors(allDeps, cached.deps);
		});
		// Returns map of all of file's dependency and subdependecies in form of their descriptors.
		return Array.from(allDeps.values())
	}

	_insertDescriptors(targetMap, urlArray) {
		urlArray.forEach(url => {
			var desc = new ReqTargetDescriptor(this.server, url, false);
			targetMap.set(desc.url, desc);
		});
	}

	parseDependencies(buffer, desc) {
		var allUrls = linkExtract.parse(buffer.toString(), desc.ext);
		if (!allUrls || allUrls.length === 0)
			return []
		// Transform sub urls relative to directory into absolute urls starting at root.
		var dirUrl = path.parse(desc.url).dir;
		// NOTE: it is necessary for url to use forward slashes / hence the path.posix methods
		return allUrls
			.filter(isUrlRelative)
			.map(relUrl => {
				var newUrl = path.posix.join(dirUrl, relUrl);
				return new ReqTargetDescriptor(this.server, newUrl, false)
			})
			.filter(desc => desc.isStreamable())
	}



	toJSON() {
		var    {name, mtimeMs, size, folder, file, url} = this;
		return {name, mtimeMs, size, folder, file, url}
	}

	isCacheable() {
		if (this.size > this.cacheMaxFileSize)
			return false
		var mimeList = this.server.cacheMimes;
		return mimeList.includes(this.mime)
			|| mimeList.some(prefix => this.mime.startsWith(prefix))
	}

	// Only JS, HTML or CSS files under 1MB of size are parseable.
	isParseable() {
		if (this.size > 1024 * 1024)
			return false
		return this.mime === 'text/html'
			|| this.mime === 'text/javascript'
			|| this.mime === 'application/javascript'
			|| this.mime === 'text/css'
	}

	// Only acceptable urls for caching are relative paths.
	isStreamable() {
		// Ignore css maps
		if (this.ext === 'map')
			return false
		if (this.server.pushMode === 'aggressive')
			return true
		var mimeList = this.server.pushMimes;
		return mimeList.includes(this.mime)
			|| mimeList.some(prefix => this.mime.startsWith(prefix))
	}

	createEtag() {
		// ETAG should ideally be generated by a hashing function that uses every byte.
		// That would be inefficient so we're using the W/ weak variant that works well
		// but trades off accuracy for efficiency.
		this._etag = Buffer.from(`${this.size}-${this.mtimeMs}-${this.ino}`).toString('base64');
		return this.etag = `W/"${this._etag}"`
	}

}

function isUrlRelative(url) {
	return url.startsWith('./')
		|| url.startsWith('/')
		|| !url.includes('//')
}

function createReadStreamFromBuffer(buffer) {
	var readable = new stream.Readable;
	readable._read = () => {};
	readable.push(buffer);
	readable.push(null);
	return readable
}

function createCompressorStream(req, sink) {
	var acceptEncoding = req.headers['accept-encoding'];
	if (!acceptEncoding)
		return
	if (acceptEncoding.includes('gzip')) {
		// A compression format using the Lempel-Ziv coding (LZ77), with a 32-bit CRC.
		sink.setHeader('content-encoding', 'gzip');
		return zlib.createGzip()
	}
	if (acceptEncoding.includes('deflate')) {
		// A compression format using the zlib structure, with the deflate compression algorithm.
		sink.setHeader('content-encoding', 'deflate');
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


var filesProto = Object.freeze({
	openDescriptor: openDescriptor,
	createReadStreamFromBuffer: createReadStreamFromBuffer,
	createCompressorStream: createCompressorStream
});

var name = "anchora";
var version = "1.0.0";
var description = "";
var author = "Mike Kovařík";
var license = "MIT";
var repository = {"type":"git","url":"https://github.com/MikeKovarik/anchora.git"};
var keywords = ["http","http2","push","static","file","server","https"];
var scripts = {"demo-simple":"node examples/simple.js","demo-simple-esm":"node --experimental-modules examples/simple.mjs","demo-http2":"node --experimental-modules examples/http2hybrid.mjs","debug":"node --experimental-modules --inspect examples/http2hybrid.mjs","demo-php":"node --experimental-modules examples/php.mjs"};
var dependencies = {"debug":"^3.1.0","link-extract":"0.0.3","mime":"^2.2.0","selfsigned":"^1.10.2"};
var devDependencies = {"chai":"^4.1.2","chai-string":"^1.4.0","mocha":"^5.0.1","node-fetch":"^2.0.0","rollup":"^0.56.5","rollup-plugin-commonjs":"^9.1.0","rollup-plugin-json":"^2.3.0","url-search-params":"^0.10.0"};
var pkg = {
	name: name,
	version: version,
	description: description,
	author: author,
	license: license,
	repository: repository,
	keywords: keywords,
	scripts: scripts,
	dependencies: dependencies,
	devDependencies: devDependencies,
	"@std/esm": {"cjs":true}
};

// TODO: non blocking parsing of subdependencies (dependecies in pushstream)
// TODO: consider implementing preload attribute and header
// TODO: enable CGI for HTTP2. because HTTP2 doesn't have 'req', it's just shimmed plain object
//       (var req = shimReqHttp1(headers)) but it needs to be stream to be piped from
//       req.pipe(cgi.stdin)

class AnchoraServer {

	constructor(...args) {
		this.anchoraInfo = `Anchora-Static-Server/${pkg.version} Node/${process.version}`;

		this.onRequest = this.onRequest.bind(this);
		this.onStream = this.onStream.bind(this);

		if (args.length) {
			this.applyArgs(args);
		} else {
			// NOTE: Class' derivatives using decorators are able to set instance values even
			//       before calling super() so this careful assignment (as to no overwrite anything)
			//       is necessary for some users.
			for (var [key, val] of Object.entries(defaultOptions)) {
				if (this[key] === undefined)
					this[key] = defaultOptions[key];
			}
			this.autoStart = false;
		}
		this.normalizeOptions();

		// Enable 'debug' module and set DEBUG env variable if options.debug is set
		if (this.debug) {
			if (!process.env.DEBUG.includes('anchora'))
				process.env.DEBUG = 'anchora,' + process.env.DEBUG;
		}

		if (process.env.DEBUG) {
			process.on('unhandledRejection', dump => {
				console.log('unhandledRejection', dump);
			});
			process.on('uncaughtException', dump => {
				console.log('uncaughtException', dump);
			});
		}

		this.cache = new AnchoraCache(this);

		if (this.autoStart !== false)
			this.ready = this.listen();
	}

	async listen(...ports) {
		this.normalizeOptions();

		// Close previous sessions, prepare reusal of the class
		await this.close();

		// Convert optional port arguments and apply the to the instance.
		if (ports.length === 1)
			this.applyPort(...ports);
		else if (ports.length > 1)
			this.applyPort(ports);

		if (this.portUnsecure && typeof this.portUnsecure !== 'number') {
			this.portUnsecure = parseInt(this.portUnsecure);
			if (Number.isNan(this.portUnsecure))
				throw new Error(`Secure Port is incorrect. 'portUnsecure' has to be number`)
		}

		if (this.portSecure && typeof this.portSecure !== 'number') {
			this.portSecure = parseInt(this.portSecure);
			if (Number.isNan(this.portSecure))
				throw new Error(`Secure Port is incorrect. 'portSecure' has to be number`)
		}

		// Load or generate self-signed (for localhost and dev purposes only) certificates needed for HTTPS or HTTP2.
		if (this.https || this.http2)
			await this.loadOrGenerateCertificate();

		// HTTP1 can support both unsecure (HTTP) and secure (HTTPS) connections.
		if (this.http)
			this.serverUnsecure = http.createServer();
		if (this.https)
			this.serverSecure = https.createServer(this);

		// HTTP2 only supports secure connections.
		if (this.http2)
			this.serverSecure = http2.createSecureServer(this);

		// Enable Node's HTTP2 implementation to fall back to HTTP1 api and support HTTPS with HTTP2 server.
		if (this.http)
			this.allowHTTP1 = true;

		// HTTP2 does not support unsecure connections. Only HTTP1 with its 'request' event does.
		if (this.http)
			this.serverUnsecure.on('request', this.onRequest);

		// All secure connections (either over HTTP2 or HTTPS) are primarily handled with 'request' event.
		// HTTP2 falls back to 'request' unless this.allowHTTP1 is false or undefined.
		// In other words: hybrid mode (HTTP2 with support for HTTP1S) will primarily use the older v1 'request' API.
		if (this.http2 && !this.allowHTTP1)
			this.serverSecure.on('stream', this.onStream);
		else if (this.http2 || this.https)
			this.serverSecure.on('request', this.onRequest);

		// Start listening.
		await this._listen();

		if (this.listening && this.debug !== false) {
			exports.debug(`root: ${this.root}`);
			exports.debug(`gzip: ${this.gzip}, cors: ${this.cors}, pushMode: ${this.pushMode}`);
		}
	}

	// Start listening on both unsecure and secure servers in parallel.
	_listen() {
		this.activeSockets = new Set;
		return Promise.all([
			this.serverUnsecure && this.setupServer(this.serverUnsecure, this.portUnsecure, 'HTTP'),
			this.serverSecure && this.setupServer(this.serverSecure, this.portSecure, this.http2 ? 'HTTP2' : 'HTTPS'),
		])
	}
	// Forcefuly close both servers.
	async close() {
		// Destroy all keep-alive and otherwise open sockets because Node won't do it for us and we'd be stuck.
		if (this.activeSockets)
			this.activeSockets.forEach(socket => socket.destroy());
		// Actually close the servers now.
		await Promise.all([
			this.serverUnsecure && this.closeServer(this.serverUnsecure, this.portUnsecure, 'HTTP'),
			this.serverSecure && this.closeServer(this.serverSecure, this.portSecure, this.http2 ? 'HTTP2' : 'HTTPS'),
		]);
		// Remove refferences to the servers.
		this.serverSecure = undefined;
		this.serverUnsecure = undefined;
	}

	setupServer(server, port, name$$1) {
		// Keep track of active sockets so the keep-alive ones can be manualy destroyed when calling .close()
		// because Node doesn't do it for and and leave's us hanging.
		server.on('connection', socket => {
			this.activeSockets.add(socket);
			socket.on('close', () => this.activeSockets.delete(socket));
		});
		// Start listening and print appropriate info.
		return this._listenAsync(server, port)
			.then(listening => {
				if (listening) this.logInfo(`${name$$1} server listening on port ${port}`);
				else this.logError(`EADDRINUSE: Port ${port} taken. ${name$$1} server could not start`);
			})
			.catch(err => this.logError(err))
	}
	async closeServer(server, port, name$$1) {
		if (server && server.listening) {
			server.removeAllListeners();
			await new Promise(resolve => server.close(resolve));
			this.logInfo(`${name$$1} server stopped listening on port ${port}`);
		}
	}

	_listenAsync(server, port) {
		return new Promise((resolve, reject) => {
			function onError(err) {
				if (err.code === 'EADDRINUSE') {
					server.removeListener('listening', onListen);
					server.close(() => resolve(false));
				} else {
					reject(err);
				}
				server.removeListener('error', onError);
			}
			function onListen() {
				server.removeListener('error', onError);
				resolve(true);
			}
			server.once('error', onError);
			server.once('listening', onListen);
			server.listen(port);
		})
	}

	// Handler for HTTP1 'request' event and shim differences between HTTP2 before it's passed to universal handler.
	onRequest(req, res) {
		exports.debug('\n###', req.method, 'request', req.httpVersion, req.url);
		// Basic shims of http2 properties (http2 colon headers) on 'req' object.
		shimHttp1ToBeLikeHttp2(req);
		// Serve the request with unified handler.
		this.serve(req, res);
	}

	// Handler for HTTP2 'request' event and shim differences between HTTP1 before it's passed to universal handler.
	onStream(stream$$1, headers) {
		exports.debug('\n###', req.method, 'stream', req.url);
		// Shims http1 like 'req' object out of http2 headers.
		var req = createHttp1LikeReq(headers);
		// Adds shimmed http1 like 'res' methods onto 'stream' object.
		shimResMethods(stream$$1);
		// Serve the request with unified handler.
		this.serve(req, stream$$1);
	}

	get listening() {
		var value = this.serverSecure && this.serverSecure.listening
				 || this.serverUnsecure && this.serverUnsecure.listening;
		return !!value
	}

	// TODO: replace console.log/error with different verbosity level of debug()
	logInfo(...args) {
		if (process.env.debug)
			exports.debug(...args);
		else if (this.debug !== false)
			console.log(...args);
	}
	logError(...args) {
		if (process.env.debug)
			exports.debug(...args);
		else if (this.debug !== false)
			console.error(...args);
	}

	// Mimicking EventEmiter and routing event handlers to both servers

	on(...args) {
		if (this.serverSecure)   this.serverSecure.on(...args);
		if (this.serverUnsecure) this.serverUnsecure.on(...args);
	}
	once(...args) {
		if (this.serverSecure)   this.serverSecure.once(...args);
		if (this.serverUnsecure) this.serverUnsecure.once(...args);
	}
	removeListener(...args) {
		if (this.serverSecure)   this.serverSecure.removeListener(...args);
		if (this.serverUnsecure) this.serverUnsecure.removeListener(...args);
	}
	removeAllListeners(...args) {
		if (this.serverSecure)   this.serverSecure.removeAllListeners(...args);
		if (this.serverUnsecure) this.serverUnsecure.removeAllListeners(...args);
	}

}

var externalProto = [
	...Object.entries(optionsProto),
	...Object.entries(serveProto),
	...Object.entries(serveFileProto),
	...Object.entries(serveDirectoryProto),
	...Object.entries(serveCgiProto),
	...Object.entries(certProto),
	...Object.entries(headersProto),
	...Object.entries(filesProto),
];

for (var [name$1, method] of externalProto)
	AnchoraServer.prototype[name$1] = method;

function createServer(...args) {
	return new AnchoraServer(...args)
}

exports.createServer = createServer;
exports.defaultOptions = defaultOptions;
exports.AnchoraServer = AnchoraServer;
exports.changeDebugger = changeDebugger;
exports.resetDebugger = resetDebugger;
exports.fs = fs;
exports.HTTPCODE = HTTPCODE;
exports.sanitizeUrl = sanitizeUrl;

Object.defineProperty(exports, '__esModule', { value: true });

})));
