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
	listDir: true,
	port: [80, 443],
	// Alias for options.version and options.secure. By default 'http1' => version=1 and secure=false.
	type: 'http1',
	secure: false,
	stream: true,


	// HEADERS AND OPTIONS

	// Cross Origin headers are enablaed by default.
	cors: true,
	// GZIP compression
	gzip: false, // TODO: work in progress
	// string values are directly set as cache-control header
	// true equals to max-age=${maxAge}
	// false equals to no-cache
	// default 'must-revalidate' enables caching, forces requesting every file, but returns 403 if nothing was modified.
	cacheControl: 'must-revalidate',
	// keep files (buffer and streams) in memory for repeated reloading the same resources
	serverCache: 1024 * 1024 * 100,
	// true, false, 'passive', 'active'
	encoding: 'passive',
	// info about server passed as 'server' header
	info: 'Anchora static server',


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

export default defaultOptions

export function getOptions(...args) {
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
		options.stream = false
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

	return options
}

function getPreset(name) {
	if (name === 'dev') {
		return Object.assign({}, defaultOptions, {
			cacheControl: 'must-revalidate',
			encoding: false,
			cors: true,
			listDir: true,
			serverCache: true,
		})
	} else if (name === 'production' || name === 'prod') {
		return Object.assign({}, defaultOptions, {
			cacheControl: 1000 * 60 * 24,
			encoding: true,
			listDir: false,
		})
	} else if (typeof name === 'string') {
		// Unknown preset.
		return {}
	} else {
		// Not a name of preset, probably just options object to be passed through.
		return name
	}
}