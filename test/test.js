var isBrowser = typeof window === 'object'

if (isBrowser) {
	// NOTE: browser tests are unavailable now but maybe sometime
	// it'll be re-enabled if server would be ran separately.
	mocha.setup('bdd')
	setTimeout(() => mocha.run())
} else {
	var chai = require('chai')
	var path = require('path')
	var {URL} = require('url')
	var URLSearchParams = require('url-search-params')
	var fetch = require('node-fetch')
	var anchora = require('../index.js')
}

var assert = chai.assert


var root = path.parse(__dirname).dir.replace(/\\/g, '/')
var server = anchora.createServer({
	root,
	phpPath: `C:\\xampp\\php\\php-cgi.exe`, // TODO
})

describe('PHP CGI', () => {

	before(async () => await server.ready)

	var cgiRel = './test/cgi json.php'
	var cgiPath = path.join(root, cgiRel).replace(/\\/g, '/')
	var cgiHttpUrl  = (new URL(cgiRel, 'http://localhost/')).href
	var cgiHttpsUrl = (new URL(cgiRel, 'https://localhost/')).href
	console.log('root', root)
	console.log('cgiPath', cgiPath)
	console.log('cgiHttpUrl', cgiHttpUrl)

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

