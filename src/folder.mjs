import path from 'path'
import __dirname from './dirname'
import {debug, fs} from './util.mjs'
import {ReqTargetDescriptor} from './filedescriptor.mjs'


// TODO: detect windows 10 theme color and switch between light/dark theme in browser
// registry path: HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Themes\Personalize
// registry var:  AppsUseLightTheme. if 1 = light, if 0 = dark

var replacePhrase = '/* TO BE ADDED BY SERVER HERE */'
var htmlDataGlobal

setupFolderBrowser()

export async function setupFolderBrowser() {
	var promises = ['./folder-browser.html', './folder-browser.css', './folder-browser.js']
		.map(name =>  path.join(__dirname, name))
		.map(filePath => fs.readFile(filePath))

	var [htmlData, cssData, jsData] = await Promise.all(promises)
	
	htmlDataGlobal = htmlData
		.toString()
		.replace(`<style>@import 'folder-browser.css';</style>`, `<style>\n${cssData}\n</style>`)
		.replace(`<script src="folder-browser.js"></script>`, `<script>\n${jsData}\n</script>`)
}

// Redirect (just add slash to end) if request points to folder but the url doesn't end with slash.
// It otherwise causes problems here and there in browsers and leads to quirks (especially with in
// service workers when caching the app).
export function ensureFolderEndsWithSlash(req, res) {
	if (req.desc.folder && !req.safeUrl.endsWith('/')) {
		debug('redirect, appending / slash to folder url')
		res.redirect(301, req.safeUrl + '/')
	}
}

// If requested index.html doesn't exist, redirect to the folder and render folder browser
// instead of returning 404.
export function redirectFromIndexToFolder(req, res) {
	if (this.folderBrowser) {
		var {desc} = req
		if (!desc.exists && desc.file && desc.name === this.indexFile) {
			debug(`redirecting to folder, index doesnt't exist`)
			var folderUrl = url.slice(0, url.lastIndexOf('/') + 1) || '/'
			return res.redirect(folderUrl)
		}
	}
}

export async function serveFolder(req, res) {
	debug('# serveFolder', req.desc.url)

	if (!req.desc.folder) return
	var url = req.safeUrl

	// Try to look for index.html within the folder and redirect to it if it exists.
	let indexUrl = path.join(url, this.indexFile)
	let indexDesc = await ReqTargetDescriptor.fromUrl(this, indexUrl)
	if (indexDesc.exists) {
		req.desc = indexDesc
		return
	}

	// Render the folder
	var folderNames = await fs.readdir(req.desc.fsPath)
	var promises = folderNames
		.map(folderName => path.posix.join(url, folderName))
		.map(folderUrl => ReqTargetDescriptor.fromUrl(this, folderUrl))
	var descriptors = await Promise.all(promises)
	var contentList = {url, descriptors}
	// Prevent caching.
	// WARNING: Necessary for json. Otherwise browser might use the json request and use that instead
	//          of html render (neither older cached, nor new request) when pressing back button.
	res.preventCaching()
	// Render the list as either JSON (if requested) or as HTML (by default), into the template.
	if (req.headers.accept === 'application/json') {
		res.json(contentList)
	} else {
		var json = JSON.stringify(contentList)
		var html = htmlDataGlobal.replace(replacePhrase, '= ' + json)
		res.html(html)
	}
}