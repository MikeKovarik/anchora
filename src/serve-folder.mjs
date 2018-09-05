import path from 'path'
import {debug, fs} from './util.mjs'
import __dirname from './dirname'



var replacePhrase = '/* TO BE ADDED BY SERVER HERE */'
var htmlDataGlobal

export async function setupFolderBrowser() {

	var server = this

	server.use((req, res) => {
		console.log(req.method, req.headers.host, req.url)
	})

	var promises = ['./folder-browser.html', './folder-browser.css', './folder-browser.js']
		.map(name =>  path.join(__dirname, name))
		.map(filePath => fs.readFile(filePath))

	var [htmlData, cssData, jsData] = await Promise.all(promises)
	
	htmlDataGlobal = htmlData
		.toString()
		.replace(`<style>@import 'folder-browser.css';</style>`, `<style>\n${cssData}\n</style>`)
		.replace(`<script src="folder-browser.js"></script>`, `<script>\n${jsData}\n</script>`)

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
	var html = htmlDataGlobal
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

