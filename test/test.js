var isBrowser = typeof window === 'object'

if (isBrowser) {
	// NOTE: browser tests are unavailable now but maybe sometime
	// it'll be re-enabled if server would be ran separately.
	mocha.setup('bdd')
	setTimeout(() => mocha.run())
} else {
	var fsSync = require('fs')
	var {promisify} = require('util')
	var chai = require('chai')
	chai.use(require('chai-string'))
	var path = require('path')
	var {URL} = require('url')
	var URLSearchParams = require('url-search-params')
	var fetch = require('node-fetch')
	var {createServer} = require('../index.js')
	var fs = {
		readFile: promisify(fsSync.readFile),
		writeFile: promisify(fsSync.writeFile),
		stat: promisify(fsSync.stat),
		createReadStream: fsSync.createReadStream,
	}
}

var {assert, expect} = chai

// Gets rid of 'FetchError: request to https://localhost/ failed, reason: self signed certificate'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

// Serve the whole /anchora folder.
var root = path.parse(__dirname).dir.replace(/\\/g, '/')

var server = createServer({
	root,
	phpPath: `C:\\xampp\\php\\php-cgi.exe`, // TODO
})

describe('Features', () => {


	before(async () => server.ready)

	it(`'options.forceUpgrade' = Forced upgrade from HTTP to HTTPS`, async () => {
		var srv = createServer({
			debug: false,
			root,
			forceUpgrade: true,
			port: [8080, 8081]
		})
		await srv.ready
		var res = await fetch('http://localhost:8080')
		assert.include([
			res.url,
			res.headers.get('location')
		], 'https://localhost:8081/')
		await srv.close()
	})

	it(`header 'upgrade-insecure-requests' upgrades`, async () => {
		var headers = {'upgrade-insecure-requests': '1'}
		var res = await fetch('http://localhost', {headers})
		assert.include([
			res.url,
			res.headers.get('location')
		], 'https://localhost/')
	})

	it(`'options.cors' enables CORS headers`, async () => {
		var srv = await createServer({debug: false, type: 'http1', root, port: 8080, cors: true}).ready
		var res = await fetch('http://localhost:8080')
		assert.isTrue(res.headers.has('access-control-allow-origin'))
		assert.isTrue(res.headers.has('access-control-allow-methods'))
		assert.isTrue(res.headers.has('access-control-allow-headers'))
		assert.isTrue(res.headers.has('access-control-allow-credentials'))
		await srv.close()
		srv = await createServer({debug: false, type: 'http1', root, port: 8080, cors: false}).ready
		var res = await fetch('http://localhost:8080')
		assert.isFalse(res.headers.has('access-control-allow-origin'))
		assert.isFalse(res.headers.has('access-control-allow-methods'))
		assert.isFalse(res.headers.has('access-control-allow-headers'))
		assert.isFalse(res.headers.has('access-control-allow-credentials'))
		await srv.close()
	})

	it(`CORS options can be String or Array`, async () => {
		var srv = await createServer({
			debug: false, type: 'http1', root, port: 8080, cors: true,
			corsOrigin: '*',
			corsMethods: ['GET', 'POST'],
			corsHeaders: 'content-type'
		}).ready
		var res = await fetch('http://localhost:8080')
		assert.include(res.headers.get('access-control-allow-origin'), '*')
		assert.include(res.headers.get('access-control-allow-methods'), 'GET')
		assert.include(res.headers.get('access-control-allow-methods'), 'POST')
		assert.include(res.headers.get('access-control-allow-headers').toLowerCase(), 'content-type')
		await srv.close()
	})
/*
	it(`'options.csp' enables CSP header`, async () => {
		var srv = await createServer({debug: false, type: 'http1', root, port: 8080, csp: `img-src 'self';`}).ready
		var res = await fetch('http://localhost:8080')
		assert.include(res.headers.get('access-control-allow-origin'), 'self')
		await srv.close()
	})
*/

	describe('caching', () => {

		it(`response contains 'etag' header`, async () => {
			var res = await fetch('http://localhost/test/test.js')
			assert.isTrue(res.headers.has('etag'))
		})

		it(`response contains 'last-modified' header`, async () => {
			var res = await fetch('http://localhost/test/test.js')
			assert.isTrue(res.headers.has('last-modified'))
		})

		it(`responds with 304 if req 'if-none-match' contains previously requested 'etag'`, async () => {
			var res = await fetch('http://localhost/test/test.js')
			assert.equal(res.status, 200)
			assert.isNotEmpty(await res.text())
			var etag = res.headers.get('etag')
			var headers = {'if-none-match': etag}
			var res2 = await fetch('http://localhost/test/test.js', {headers})
			assert.equal(res2.status, 304)
			assert.isEmpty(await res2.text())
		})

		it(`responds with 304 if req 'if-modified-since' contains previously requested 'last-modified'`, async () => {
			var res = await fetch('http://localhost/test/test.js')
			assert.equal(res.status, 200)
			assert.isNotEmpty(await res.text())
			var modified = res.headers.get('last-modified')
			var headers = {'if-modified-since': modified}
			var res2 = await fetch('http://localhost/test/test.js', {headers})
			assert.equal(res2.status, 304)
			assert.isEmpty(await res2.text())
		})

		it(`always returns fresh file`, async () => {
			var data1 = 'body {color: red}'
			var data2 = 'body {color: blue}'
			await fs.writeFile('./cache-fixture.css', data1)
			var resultA = await fetch('https://localhost/test/cache-fixture.css').then(res => res.text())
			assert.equal(data1, resultA)
			var resultB = await fetch('http://localhost/test/cache-fixture.css').then(res => res.text())
			assert.equal(data1, resultB)
			await fs.writeFile('./cache-fixture.css', data2)
			var resultC = await fetch('http://localhost/test/cache-fixture.css').then(res => res.text())
			assert.equal(data2, resultC)
			var resultD = await fetch('https://localhost/test/cache-fixture.css').then(res => res.text())
			assert.equal(data2, resultD)
		})

	})

	describe('range', () => {

		it(`'options.range' sets or hides 'accept-ranges' header`, async () => {
			var defaultOptions = {debug: false, type: 'http1', root, port: 8080}
			var srv = await createServer(Object.assign({range: true}, defaultOptions)).ready
			var res = await fetch('http://localhost:8080')
			assert.equal(res.headers.get('accept-ranges'), 'bytes')
			await srv.close()
			srv = await createServer(Object.assign({range: false}, defaultOptions)).ready
			var res = await fetch('http://localhost:8080')
			assert.equal(res.headers.get('accept-ranges'), 'none')
			await srv.close()
		})

		it(`returns only requested chunk of file (cached)`, async () => {
			// NOTE: HTML are cacheable by default and thus read as buffer.
			var headers = {'range': 'bytes=444-450'}
			var res = await fetch('http://localhost/test/range-fixture.html', {headers})
			assert.equal(res.status, 206)
			var text = await res.text()
			assert.equal(text, 'anchora')
		})
		it(`returns only requested chunk of file (freshly read with fs.createReadStream)`, async () => {
			// NOTE: MP4 less files are not cached by default and thus read directly from disk.
			var headers = {'range': 'bytes=444-450'}
			var res = await fetch('http://localhost/test/range-fixture.mp4', {headers})
			assert.equal(res.status, 206)
			var text = await res.text()
			assert.equal(text, 'anchora')
		})

		it(`returns file from given offset (cached)`, async () => {
			var headers = {'range': 'bytes=444-'}
			var text = await fetch('http://localhost/test/range-fixture.html', {headers})
				.then(res => res.text())
			expect(text).to.startWith('anchora')
			expect(text).to.endWith('rules.')
		})
		it(`returns file from given offset (freshly read with fs.createReadStream)`, async () => {
			var headers = {'range': 'bytes=444-'}
			var text = await fetch('http://localhost/test/range-fixture.mp4', {headers})
				.then(res => res.text())
			expect(text).to.startWith('anchora')
			expect(text).to.endWith('rules.')
		})

		it(`returns 206 if the range's start is valid but end is invalid`, async () => {
			var headers = {'range': 'bytes=444-1100'}
			var res = await fetch('http://localhost/test/range-fixture.html', {headers})
			assert.equal(res.status, 206)
			var text = await res.text()
			expect(text).to.startWith('anchora')
			expect(text).to.endWith('rules.')
		})

		it(`returns 416 if the range is invalid`, async () => {
			var res
			res = await fetch('http://localhost/test/range-fixture.html', {headers: {'range': 'bytes=998-998'}})
			assert.equal(res.status, 206)
			res = await fetch('http://localhost/test/range-fixture.html', {headers: {'range': 'bytes=999-999'}})
			assert.equal(res.status, 416)
			res = await fetch('http://localhost/test/range-fixture.html', {headers: {'range': 'bytes=1000-1100'}})
			assert.equal(res.status, 416)
		})

	})

})


describe('PHP CGI', () => {

	before(async () => server.ready)

	var cgiRel = './test/cgi json.php'
	var cgiPath = path.join(root, cgiRel).replace(/\\/g, '/')
	var cgiHttpUrl  = (new URL(cgiRel, 'http://localhost/')).href
	var cgiHttpsUrl = (new URL(cgiRel, 'https://localhost/')).href

	var searchParams = new URLSearchParams()
	var params = {
		hello: 'World!',
		foo: 'bar, baz, quox'
	}
	for (var [key, value] of Object.entries(params))
		searchParams.append(key, value)
	var query = searchParams.toString()
	
	var cgiQueryUrl = `${cgiHttpUrl}?${query}`

	var postFormOptions = {
		method: 'POST',
		body: query, 
		headers: {
			'content-type': 'application/x-www-form-urlencoded'
		}
	}

	describe('globals', () => {

		describe('$_GET', () => {

			it('GET with no arguments has empty $_GET', async () => {
				var {$_GET} = await fetch(cgiHttpUrl).then(res => res.json())
				assert.isArray($_GET)
				assert.isEmpty($_GET)
			})

			it('GET with query arguments has them in $_GET', async () => {
				var {$_GET} = await fetch(cgiQueryUrl).then(res => res.json())
				assert.isObject($_GET)
				assert.isNotEmpty($_GET)
				assert.equal($_GET.hello, params.hello)
				assert.equal($_GET.foo, params.foo)
			})

			it('POST with query arguments has empty $_GET', async () => {
				var {$_GET} = await fetch(cgiHttpUrl, postFormOptions).then(res => res.json())
				assert.isArray($_GET)
				assert.isEmpty($_GET)
			})

		})

		describe('$_POST', () => {

			it('GET with no arguments has empty $_POST', async () => {
				var {$_POST} = await fetch(cgiHttpUrl).then(res => res.json())
				assert.isArray($_POST)
				assert.isEmpty($_POST)
			})

			it('GET with query arguments has empty $_POST', async () => {
				var {$_POST} = await fetch(cgiQueryUrl).then(res => res.json())
				assert.isArray($_POST)
				assert.isEmpty($_POST)
			})

			it('POST with query arguments has has them in $_POST', async () => {
				var {$_POST} = await fetch(cgiHttpUrl, postFormOptions).then(res => res.json())
				assert.isObject($_POST)
				assert.isNotEmpty($_POST)
				assert.equal($_POST.hello, params.hello)
				assert.equal($_POST.foo, params.foo)
			})

		})

		describe('$_REQUEST', () => {

			it('GET with no arguments has empty $_REQUEST', async () => {
				var {$_REQUEST} = await fetch(cgiHttpUrl).then(res => res.json())
				assert.isArray($_REQUEST)
				assert.isEmpty($_REQUEST)
			})

			it('GET with query arguments has them in $_REQUEST', async () => {
				var {$_REQUEST} = await fetch(cgiQueryUrl).then(res => res.json())
				assert.isObject($_REQUEST)
				assert.isNotEmpty($_REQUEST)
				assert.equal($_REQUEST.hello, params.hello)
				assert.equal($_REQUEST.foo, params.foo)
			})

			it('POST with query arguments has them in $_REQUEST', async () => {
				var {$_REQUEST} = await fetch(cgiHttpUrl, postFormOptions).then(res => res.json())
				assert.isObject($_REQUEST)
				assert.isNotEmpty($_REQUEST)
				assert.equal($_REQUEST.hello, params.hello)
				assert.equal($_REQUEST.foo, params.foo)
			})

		})

		describe('$_SERVER', () => {

			it(`GET request results in $_SERVER['REQUEST_METHOD'] === 'GET'`, async () => {
				var {$_SERVER} = await fetch(cgiHttpUrl).then(res => res.json())
				assert.equal($_SERVER['REQUEST_METHOD'], 'GET')
			})

			it(`POST request results in $_SERVER['REQUEST_METHOD'] === 'POST'`, async () => {
				var {$_SERVER} = await fetch(cgiHttpUrl, {method: 'POST'}).then(res => res.json())
				assert.equal($_SERVER['REQUEST_METHOD'], 'POST')
			})

			it(`PUT request results in $_SERVER['REQUEST_METHOD'] === 'PUT'`, async () => {
				var {$_SERVER} = await fetch(cgiHttpUrl, {method: 'PUT'}).then(res => res.json())
				assert.equal($_SERVER['REQUEST_METHOD'], 'PUT')
			})

			it(`$_SERVER['QUERY_STRING'] has the url query sting`, async () => {
				var {$_SERVER} = await fetch(cgiQueryUrl).then(res => res.json())
				assert.equal($_SERVER['QUERY_STRING'], query)
			})


			it(`$_SERVER['REQUEST_URI'] also contains query`, async () => {
				var {$_SERVER} = await fetch(cgiQueryUrl).then(res => res.json())
				assert.equal($_SERVER['REQUEST_URI'], '/test/cgi%20json.php?' + query)
			})

			it(`$_SERVER['SCRIPT_NAME'], $_SERVER['PHP_SELF'] do not contain query`, async () => {
				var {$_SERVER} = await fetch(cgiQueryUrl).then(res => res.json())
				assert.equal($_SERVER['SCRIPT_NAME'], '/test/cgi json.php')
				assert.equal($_SERVER['PHP_SELF'], '/test/cgi json.php')
			})

			it(`$_SERVER['DOCUMENT_ROOT'], $_SERVER['CONTEXT_DOCUMENT_ROOT']`, async () => {
				var {$_SERVER} = await fetch(cgiQueryUrl).then(res => res.json())
				assert.equal($_SERVER['DOCUMENT_ROOT'], root)
				assert.equal($_SERVER['CONTEXT_DOCUMENT_ROOT'], root)
			})

			it(`$_SERVER['SCRIPT_FILENAME'] contains the full disk path to the executed file`, async () => {
				var {$_SERVER} = await fetch(cgiQueryUrl).then(res => res.json())
				assert.equal($_SERVER['SCRIPT_FILENAME'], cgiPath)
			})

		})

	})

})

