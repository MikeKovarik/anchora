import path from 'path'
import {debug, fs} from './util.mjs'
import __dirname from './dirname.js'


export async function serveFolder(req, res, desc) {
	debug('-----------------------------------------')
	debug('serveFolder', desc.url)
	var indexPath = path.join(desc.fsPath, this.indexFile)
	try {
		// Trying to redirect to index.html.
		await fs.stat(indexPath)
		var indexUrl = path.join(desc.url, this.indexFile)
		res.setHeader('location', indexUrl)
		res.writeHead(301)
		res.end()
	} catch(err) {
		// Render contents of the folder if 'dirBrowser' is enabled or return 404.
		if (this.dirBrowser)
			this.renderFolder(req, res, desc, this)
		else
			this.serveError(res, 404, err)
	}
}

var fsBrowserCode
fs.readFile(path.join(__dirname, './dir-browser.html'))
	.then(buffer => fsBrowserCode = buffer.toString())

export async function renderFolder(req, res, desc) {
	var folderData = await this.readDirJson(desc)
	if (req.url.endsWith('?anchora=json')) {
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
