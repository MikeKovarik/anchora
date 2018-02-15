import path from 'path'
import {fs} from './util.mjs'
import {openDescriptor} from './files.mjs'


var fsBrowserCode
fs.readFile('./fs-browser.html').then(buffer => fsBrowserCode = buffer.toString())

export async function renderFolder(req, res, desc, options) {
	var folderData = await getJsonData(desc, options)
	if (req.url.endsWith('?anchora=json')) {
		res.setHeader('content-type', 'application/json')
		res.writeHead(200)
		res.end(JSON.stringify(folderData))
	} else {
		var html = fsBrowserCode = (await fs.readFile('./fs-browser.html')).toString()
		//var html = fsBrowserCode
		html = html.replace('/* TO BE ADDED BY SERVER HERE */', '= ' + JSON.stringify(folderData))
		res.setHeader('content-type', 'text/html')
		res.writeHead(200)
		res.end(html)
	}
}

async function getJsonData(desc, options) {
	var {fsPath, url} = desc
	var names = await fs.readdir(fsPath)
	var promises = names.map(name => openDescriptor(path.posix.join(url, name), options.root))
	var descriptors = (await Promise.all(promises)).map(formatDesc)
	return {url, descriptors}
}

function formatDesc(desc) {
	var {name, mtime, size, folder, file, url} = desc
	var modified = mtime.valueOf()
	return {name, modified, size, folder, file, url}
}