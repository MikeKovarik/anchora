import selfsigned from 'selfsigned'
import cp from 'child_process'
import path from 'path'
import util from 'util'
import {fs, exec} from './util.mjs'
import {ensureDirectory} from './files.mjs'
var {promisify} = util
selfsigned.generate = promisify(selfsigned.generate)


// NOTE: Node's HTTPS and HTTP2 classes accept object with {key, cert} properties
//       but the file's extensions are .key and .crt therefore property names 'cert' and 'crtPath'
//       are used in the options object.

export async function loadOrGenerateCertificate() {
	this.debug && console.log('Loading or generating certificate for use in HTTPS or HTTP2')
	try {
		await this.loadCertificate()
		this.debug && console.log('Certificate loaded')
	} catch(err) {
		await this.generateCertificate()
		this.debug && console.log('Certificate geneated')
		try {
			await this.storeCertificate()
			this.debug && console.log('Certificate stored')
			await this.installCertificate()
			this.debug && console.log('Certificate installed')
		} catch(err) {
			throw new Error(`certificate could not be loaded nor created, '${this.key}' '${this.cert}'`)
		}
	}
	return this
}

export async function loadCertificate() {
	this.key  = await fs.readFile(this.keyPath)
	this.cert = await fs.readFile(this.crtPath)
}

export async function generateCertificate() {
	// NOTE: selfsigned won't create certificate unless the name is 'commonName'
	var selfsignedAttrs   = this.selfsignedAttrs   || [{name: 'commonName', value: 'localhost'}]
	var selfsignedOptions = this.selfsignedOptions || {days: 365}
	var result = await selfsigned.generate(selfsignedAttrs, selfsignedOptions)
	this.key  = result.private
	this.cert = result.cert
}

export async function storeCertificate() {
	var keyPathDir = path.dirname(this.keyPath)
	var crtPathDir = path.dirname(this.crtPath)
	await ensureDirectory(keyPathDir)
	if (keyPathDir !== crtPathDir)
		await ensureDirectory(crtPathDir)
	await fs.writeFile(this.keyPath, this.key),
	await fs.writeFile(this.crtPath, this.cert)
}

export async function installCertificate() {
	switch (process.platform) {
		case 'win32':
			return exec(`certutil -addstore -user -f root "${this.crtPath}"`)
		case 'darwin':
			// TODO
			return
		default:
			// copy crt file to
			await ensureDirectory(`/usr/share/ca-certificates/extra/`)
			await fs.writeFile(`/usr/share/ca-certificates/extra/${this.certName}.cert`, this.cert)
			//return exec('sudo update-ca-certificates')
	}
}