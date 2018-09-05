import path from 'path'
import {debug, fs} from './util.mjs'
import __dirname from './dirname.js'



var replacePhrase = '/* TO BE ADDED BY SERVER HERE */'
var htmlDataGlobal // TODO

export async function setupFolderBrowser() {

	var server = this

	server.use((req, res) => {
		console.log(req.method, req.headers.host, req.url)
	})

	var promises = ['./folder-browser.html', './folder-browser.css', './folder-browser.js']
		.map(name =>  path.join(__dirname, name))
		.map(filePath => fs.readFile(filePath))

	var [htmlData, cssData, jsData] = await Promise.all(promises)
	htmlDataGlobal = htmlData.toString() // TODO

	server.use('anchora-browser.', {
		'/folder-browser.css': (req, res) => {
			res.setHeader('content-type', 'text/css')
			res.send(cssData)
		},
		'/folder-browser.js': (req, res) => {
			res.setHeader('content-type', 'application/javascript')
			res.send(jsData)
		}
	})

	server.use('anchora-json.', async (req, res) => {
		//console.log('GET', 'anchora-json.', req.headers.host, req.url)
		res.setHeader('access-control-allow-origin', '*')
		res.json(await server.readDirJson(req.desc))
	})

}

export async function serveFolder(req, res) {
	debug('-----------------------------------------')
	debug('serveFolder', req.desc.url)
	var contentList = await this.readDirJson(req.desc)
	var apiBase = `http://anchora-browser.${req.headers.host}` // TODO dynamic http/s
	var html = htmlDataGlobal
		.replace('folder-browser.js',  `${apiBase}/folder-browser.js`)
		.replace('folder-browser.css', `${apiBase}/folder-browser.css`)
		.replace(replacePhrase, '= ' + JSON.stringify(contentList))
	res.setHeader('content-type', 'text/html')
	res.end(html)
}

export async function readDirJson(desc) {
	var {fsPath, url} = desc
	var names = await fs.readdir(fsPath)
	var promises = names.map(name => this.openDescriptor(path.posix.join(url, name)))
	var descriptors = await Promise.all(promises)
	return {url, descriptors}
}

