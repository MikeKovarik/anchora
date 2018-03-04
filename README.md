# Anchora: HTTP Static Server

## What

Anchora is a http static server module for Node.js. Simple, fast, powerful, flexible, yada yada yada...

But really. It does a lot out of the box with no configuration. Even **HTTP2** and **Push Streams** of file dependencies.

This repository contains the Anchora Engine used in and originally developed for but not limited to use in [Anchora App](https://github.com/MikeKovarik/anchora-app) (A simple Windows store app providing UI around this engine).



## Why

Why another static server for node? There are many already in the npm registry.

It wasn't initial intention to compete with them.

Anchora was originally developed for an app that would replace Apache or XAMPP and become frontend dev's best friend. But it has since outgrew the app and became npm module, with friendly API, to be used by devs like you ;).

Most importantly - none of the existing modules implement HTTP2 and Push Streams. Anchora does. And comes preconfigured with CORS, generates self-signed HTTPS certificates, and more.



## FAQ

* *Who is this for* **Frontend developers and tinkerers.**
* *What does it do out of the box?* **All that your heart desires. HTTP2 push streams, CORS, both HTTP & HTTPS servers, GZIP, advanced caching (both client and server side), auto generated HTTPS certificates, redirects, ...**
* *So it suports HTTP2?* **YES! YES! It's the sole reason why I developed yet another static serve.**
* *And HTTP2 Push Streams?* **Yup. Automatically, out of the box, with zero configuration.**
* *How does the Push work?* **HTML, JS and CSS files are parsed and dependency links extracted and cached (until the file changes again) for future use. But don't worry. It's async and designed to not slow down content serving.**
* *Can this server run PHP, Ruby, Python or any other CGI script?* **Yes! But it's still experimental, for localhost tinkering until proven stable. See /examples for PHP demo.**
* *Is this project production ready?* **Not really, hopefuly some day.**
* *How stable is it?* **Fairly. It's used and dogfed daily and maintained regularly. Though Node's 'http2' module is still unstable.**
* *Caching?* **Tuned for effective development but customizable. Frequent files are kept in memory to reduce disk reads, 'cache-control' header is set to 'must-revalidate' and returns 304 if the file is unchanged.**



## Features

Anchora is designed to support the hottest tech. Automatically and out of the box. With ease.

* **HTTP2 push streams**.
	* Automatic parsing of files and delivering their dependencies. *Parses HTML, JS and CSS files, extracts links, generates tree of dependencies. Uses [`link-extract`](https://www.npmjs.com/package/link-extract) module.*
* Caching. *Tuned for effective and blazing fast frontend development.*
	* **ETag**: *Creates 'fingerprint' of served files. It ensures serving always up-to-date files. Unlike expiration time based caching.*
	* Client-side: **304 Not Modified** & 'must-revalidate'. *All files are cached along with their ETags which are then used in future requests. Server only responds if the file has changed since (and file's ETag is different).*
	* Server-side: *Stores frequently used files in memory to reduce disk reads.*
* Automatically generated self-signed certificates. *Makes HTTPS localhost development simple.*
* Compression
	* **GZIP** and Deflate
	* Passive mode. Tries to serve pre-compressed .gz alternatives of the requested file.
* **CORS** headers.
* HTTP to HTTPS upgrade redirect (either forced or requested with `upgrade-insecure-requests` header)
* CGI: PHP and other scripting laguages support (experimental).
* Ranges (partial support).
* Custom HTTP headers



## Installation & Usage

```
npm install anchora
```



## How

Anchora uses all three node modules: `http` and either of `https` or `http2` in conjunction (since browsers only support HTTP2 secure connections, i.e. HTTP2 in HTTPS mode) atop which is compat layer for handling both 1.1 and 2.0 requests. ALPN negotiation allows supporting both HTTPS and HTTP2 over the same socket. Anchora then proceeds to open push streams with dependency files if and where available. 

See more [Node HTTP2 documentation](https://nodejs.org/dist/latest-v9.x/docs/api/http2.html#http2_compatibility_api) for more on compatibility and TODO

`http2` module is still in flux and 



### Supported headers

**Basics**

* `content-type`
* `content-length`
* `transfer-encoding`

**GZIP and Deflate compression**

* `accept-encoding`

**Caching, ETAG**

* `cache-control`
* `etag`
* `last-modified`
* `expires`
* `if-modified-since`
* `if-none-match`

**CORS & CSP**

* `access-control-allow-methods`
* `access-control-allow-headers`
* `access-control-allow-credentials`
* `content-security-policy`

**Ranges**

* `accept-ranges`
* `range`
* `content-range`
* `if-range` ???

**Redirects**

* `location`
* `upgrade-insecure-requests`

**not supported**

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
Join our strictly casual [discord server](https://discord.gg/3qUU6wK).



## Credits

Made by Mike Kovařík, Mutiny.cz
