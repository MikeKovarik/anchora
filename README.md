[![NPM](https://nodei.co/npm/anchora.png)](https://nodei.co/npm/anchora/)

[![NPM version](https://img.shields.io/npm/v/anchora.svg)](https://www.npmjs.com/package/anchora)
[![Dependency Status](https://david-dm.org/MikeKovarik/anchora.svg)](https://david-dm.org/MikeKovarik/anchora)
[![devDependency Status](https://david-dm.org/MikeKovarik/anchora/dev-status.svg)](https://david-dm.org/MikeKovarik/anchora#info=devDependencies)
[![Maintenance Status](http://img.shields.io/badge/status-maintained-brightgreen.svg)](https://github.com/MikeKovarik/anchora/pulse)
[![Discord](https://img.shields.io/discord/419198557363634178.svg)](https://discord.gg/v2mUmeD)
[![Gitter](https://badges.gitter.im/MikeKovarik/anchora.svg)](https://gitter.im/MikeKovarik/anchora?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

# Anchora: HTTP/2.0 Static Server

⚓ Powerful yet simple HTTP/2 static server for node. Push enabled!

## What?

Anchora is a HTTP static server module for Node.js. Simple, fast, powerful, flexible, yada yada yada...

But really. It does a lot out of the box with no configuration. Even **HTTP2** and **Push Streams** of file dependencies.

This repository contains the Anchora Engine used in and originally developed for but not limited to use in [Anchora App](https://github.com/MikeKovarik/anchora-app) (A simple Windows store app providing UI around this engine).



## Why?

Why another static server for node? There are many already in the npm registry.

It wasn't initial intention to compete with them.

Anchora was originally developed for an app that would replace Apache or XAMPP and become frontend dev's best friend. But it has since outgrew the app and became npm module, with friendly API, to be used by devs like you ;).

Most importantly - none of the existing modules implement HTTP2 and Push Streams. Anchora does. And comes preconfigured with CORS, generates self-signed HTTPS certificates, and more.



## FAQ

* **Who is this for** Frontend developers and tinkerers.
* **What does it do out of the box?** All that your heart desires. HTTP2 push streams, CORS, HTTP & HTTPS servers, GZIP, advanced caching (both client and server side), auto generated HTTPS certificates, redirects, ...
* **HTTPS?** Yes. We'll generate and install CA for you and sign every localhost cert with it.
* **Can I use it to test service workers?** Just install the CA certificate on your phone.
* **So it suports HTTP2?** YES! YES! It's the sole reason why I developed yet another static serve.
* **And HTTP2 Push Streams?** Yup. Automatically, out of the box, with zero configuration.
* **How does the Push work?** HTML, JS and CSS files are parsed and dependency links extracted and cached (until the file changes again) for future use. But don't worry. It's async and designed to not slow down content serving.
* **Can this server run PHP, Ruby, Python or any other CGI script?** Well, yes. But it's still experimental, for localhost tinkering until proven stable. See `/examples` for PHP demo. Help with testing from users of said languages would be great
* **Is this project production ready?** Not really, hopefuly some day.
* **How stable is it?** Fairly. It's used and dogfed daily and maintained regularly. Though Node's 'http2' module is still unstable.
* **Caching?** Customizable. Tuned for effective development. Frequent files are kept in memory to reduce disk reads, `cache-control=must-revalidate`, 304s are served if file is unchanged (thanks to ETag).



## Features

Anchora is designed to support the hottest tech. Automatically and out of the box. With ease.

* **HTTP2 push streams**.
  * Automatic parsing of files and delivering their (sub)dependencies.
  * Parses HTML, JS and CSS files, extracts links, generates tree of dependencies. Uses [`link-extract`](https://www.npmjs.com/package/link-extract) module.
* **Caching**
  * **ETag**: Creates 'fingerprint' of served files. It ensures serving always up-to-date files. Unlike expiration time based caching.
  * Client-side: **304 Not Modified** & `must-revalidate`. All files are cached along with their ETags which are then used in future requests. Server only responds if the file changed since (and the file's ETag is different).
  * Server-side: Stores frequently used files in memory to reduce disk reads.
  * By default tuned for effective and blazing fast frontend development.
* **HTTPS certificates**
  * Generates (and installs) Root CA
  * Generates self-signed localhost certificates. Per IP. Signed by the CA (automatically trusted by browsers).
  * Complies with all the latest security restrictions & annoyances in Chrome.
  * Or supply your won cert.
  * HTTPS localhost has never been simpler.
* Compression
  * **GZIP** and Deflate
  * Passive mode. Tries to serve pre-compressed .gz alternatives of the requested file.
* **CORS** headers.
* Can run HTTP and HTTPS (or HTTP2 hybrid) server simultaneously
* HTTP to HTTPS upgrade redirect (either forced or requested with `upgrade-insecure-requests` header)
* CGI: PHP and other scripting laguages support (experimental).
* Ranges (partial support).
* Custom HTTP headers
* Extensible API (such as Markdown renderer)



## Installation & Usage

```
npm install anchora
```


### Example

```js
import anchora from 'anchora'

// creates http & https servers listening on ports 80 & 443 (by default)
var server = anchora.createServer('both')
// which is also default setting and is the same as
var server = anchora.createServer()

// creates http server listening on port 80 (by default)
var server = anchora.createServer('http1')

// creates http server listening on port 80
var server = anchora.createServer('http1', 8080)

// creates https server listening on port 443 (by default)
// and enables Gzip compression
var server = anchora.createServer('https', {gzip: true})

// creates http & https servers listening on port 80 & 443 (by default)
// and applies following options (via 'dev' preset):
// enabled CORS headers, disabled GZIP, shows directory browser, sets 'cache-control' header to 'must-revalidate'
var server = anchora.createServer('dev')

// creates http & http2 (via 'hybrid' server type) servers, with 'dev' preset options, listening on port 80 & 443 (by default)
var server = anchora.createServer('hybrid', 'dev')

// creates http2 (via 'http2' server type) server, with 'dev' preset options, listening on port 3000
var server = anchora.createServer('http2', 'dev', 3000)
```


## API


### `anchora.createServer()`

Creates server(s). Similar to [`https.createServer`](https://nodejs.org/api/http.html#http_http_createserver_options_requestlistener) & [`https.createServer`](https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener) except for the listener argument.

Accepts various arguments

```js
createServer([portUnsecure, portSecure])
createServer(port)
createServer('type')
createServer('preset')
createServer({options})
createServer('type', 'preset')
createServer('type', port)
createServer('type', [portUnsecure, portSecure])
createServer('type', port, 'preset')
createServer('type', [portUnsecure, portSecure], 'preset')
createServer('type', port, {options})
createServer('type', [portUnsecure, portSecure], {options})
```

### `server#listen([ports])`

Starts listening (both) server(s) on previously configure ports or those passed in argument.

### `server#close()`

Closes (both) server(s).

### `server#listening`

Returns true of false is server(s) are running.


### Server types

One of following types can be used as a `type` argument for `.createServer()`.

 * `http`, `http1` - creates `http` server at port 80
 * `https` - creates `https` server at port 443
 * `http2` - creates `http2` server at port 443
 * `hybrid` - creates `http` & `https` servers at ports 80 & 443
 * `both` - creates `http` & `http2` servers at ports 80 & 443


### Presets

One of following presets can be used as a `preset` argument for `.createServer()`.

`dev` - Applies following options:
```js
{
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
  headers: {'strict-transport-security': 'max-age=0'}
}
```

`prod`, `production` - Applies following options:
```js
{
  // Does not show file browser to increase security.
  folderBrowser: false,
  // Only pushes certain file types (HTTP2 only).
  pushMode: 'optimized',
  // Enables on-the-fly gzip compressions of files to reduce bandwith.
  gzip: true,
  // Allow upgrading to HTTPS connections if browser requests it. Is not enforced though.
  allowUpgrade: true,
}
```

### Options

```js
{

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
  certDir: path.join(process.cwd(), `./certificates/`),


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

  // Plugin API.
  // You can set custom handler for certain file extensions and either handle whole response or your own
  // or just return the data and let Anchora handle the rest
  // Custom handler received 4 arguments:
  // - `req`, `res` = typical http request/response objects.
  // - `sink` = current stream, typically res===sink except for http2 push streams.
  // - `desc` = file descriptor, extends results of fs.stat.
  // Custom handler can either handle responding and return nothing, or return data to be handled and sent by Anchora.
  // Example:
  //   Simple one-liner that reads file, passes it to some 3rd party markdown parser and returns the result back to anchora.
  //   options.plugins.md = (req, res, sink, desc) => markdownToHtml(fs.readFileSync(desc.fsPath))
  plugins: {},

}
```


## How it works.

Anchora uses all three node modules: `http` and either of `https` or `http2` in conjunction (since browsers only support HTTP2 secure connections, i.e. HTTP2 in HTTPS mode) atop which is compat layer for handling both 1.1 and 2.0 requests. ALPN negotiation allows supporting both HTTPS and HTTP2 over the same socket. Anchora then proceeds to open push streams with dependency files if and where available. 

See more [Node HTTP2 documentation](https://nodejs.org/dist/latest-v9.x/docs/api/http2.html#http2_compatibility_api) for more on compatibility.

Node's `http2` module is still in flux and conscidered experimental. Anchora's push stream implementation might contain few bugs and implementation in browser's is also doubtful (when considering module scripts in Chrome for example). Expect it to not work at some level (should not break but degrade degracefuly though) and do not use it in production yet.

**Tested on Node 9.5 - 9.9.** Older versions will not work due to changing API of `http2` module.


## Supported headers

#### Basic

* `content-type`
* `content-length`
* `transfer-encoding`

#### GZIP and Deflate compression

* `accept-encoding`

#### Caching, ETAG

* `cache-control`
* `etag`
* `last-modified`
* `expires`
* `if-modified-since`
* `if-none-match`

#### CORS & CSP

* `access-control-allow-methods`
* `access-control-allow-headers`
* `access-control-allow-credentials`
* `content-security-policy`

#### Ranges

* `accept-ranges`
* `range`
* `content-range`
* `if-range` ???

#### Redirects

* `location`
* `upgrade-insecure-requests`

#### not supported

* `if-match`
* `if-unmodified-since`
* `if-range`


## Ideas for the future 

* CLI
* **host proxy & custom domains** - usee 'host' header to use different root folder. Useful when custom domains in hosts file are created where each domain could point to a different project folder.
* service workers?
* Further work on enabling CGI, or perhaps implementation of FastCGI, testing and adding support for more languages other than PHP.
* Conditional requests.



## Join the discussion

Wanna come say hi, discuss the ideas and features, help out with fixing bugs or sharing about your workflow so that we could make Anchora suit you even better?
Join our strictly casual [discord server](https://discord.gg/3qUU6wK) or [Gitter](https://gitter.im/MikeKovarik/anchora)



## Get it as an app!

Anchora powers Anchora App for Windows 10. Get it from [Windows Store]() or check out the [source code](https://github.com/MikeKovarik/anchora-app).

<p align="center">
  <img src="https://raw.githubusercontent.com/MikeKovarik/anchora-app/master/promo.jpg">
</p>



## Credits

Made by Mike Kovařík, Mutiny.cz
