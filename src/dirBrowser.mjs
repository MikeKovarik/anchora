import path from 'path'
import {fs} from './util.mjs'


var fsBrowserCode
fs.readFile('./dir-browser.html').then(buffer => fsBrowserCode = buffer.toString())

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
