import path from 'path'
import {debug, fs} from './util.mjs'
import __dirname from './dirname.js'


export async function serveFolder(req, res, desc, serveJson) {
	debug('-----------------------------------------')
	debug('serveFolder', desc.url)
	// Render contents of the folder if 'folderBrowser' is enabled or return 404.
	if (this.folderBrowser)
		this.renderFolder(req, res, desc, serveJson)
	else
		res.serveError(404, err)
}

var fsBrowserCode
fs.readFile(path.join(__dirname, './folder-browser.html'))
	.then(buffer => fsBrowserCode = buffer.toString())

export async function renderFolder(req, res, desc, serveJson) {
	var folderData = await this.readDirJson(desc)
	if (serveJson) {
		res.setHeader('content-type', 'application/json')
		res.writeHead(200)
		res.end(JSON.stringify(folderData))
	} else {
		var html = fsBrowserCode
		html = html.replace('/* TO BE ADDED BY SERVER HERE */', '= ' + JSON.stringify(folderData))
		res.setHeader('content-type', 'text/html')
		res.writeHead(200)
		res.end(html)
	}
}

export async function readDirJson(desc) {
	var {fsPath, url} = desc
	var names = await fs.readdir(fsPath)
	var promises = names.map(name => this.openDescriptor(path.posix.join(url, name)))
	return {
		url,
		descriptors: await Promise.all(promises)
	}
}
