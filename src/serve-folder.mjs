import path from 'path'
import {debug, fs} from './util.mjs'
import __dirname from './dirname'


// TODO: detect windows 10 theme color and switch between light/dark theme in browser
// registry path: HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Themes\Personalize
// registry var:  AppsUseLightTheme. if 1 = light, if 0 = dark

var replacePhrase = '/* TO BE ADDED BY SERVER HERE */'
var htmlDataGlobal

export async function setupFolderBrowser() {
	debug('setupFolderBrowser()')

	var server = this
/*
	server.use((req, res) => {
		debug('-', req.method, req.headers.host, req.url)
	})
*/
	var promises = ['./folder-browser.html', './folder-browser.css', './folder-browser.js']
		.map(name =>  path.join(__dirname, name))
		.map(filePath => fs.readFile(filePath))

	var [htmlData, cssData, jsData] = await Promise.all(promises)
	
	htmlDataGlobal = htmlData
		.toString()
		.replace(`<style>@import 'folder-browser.css';</style>`, `<style>\n${cssData}\n</style>`)
		.replace(`<script src="folder-browser.js"></script>`, `<script>\n${jsData}\n</script>`)

}

export async function serveFolder(req, res) {
	debug('# serveFolder', req.desc.url)
	var {fsPath, url} = req.desc
	var names = await fs.readdir(fsPath)
	var promises = names.map(name => this.openDescriptor(path.posix.join(url, name)))
	var descriptors = await Promise.all(promises)
	var contentList = {url, descriptors}
	// Render the list as either JSON (if requested) or as HTML (by default), into the template.
	if (req.headers.accept === 'application/json') {
		res.json(contentList)
	} else {
		var json = JSON.stringify(contentList)
		var html = htmlDataGlobal.replace(replacePhrase, '= ' + json)
		res.html(html)
	}
}