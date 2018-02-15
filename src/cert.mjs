import selfsigned from 'selfsigned'
import cp from 'child_process'
import path from 'path'
import util from 'util'
import {fs} from './util.mjs'
var {promisify} = util
selfsigned.generate = promisify(selfsigned.generate)


// NOTE: Node's HTTPS and HTTP2 classes accept object with {key, cert} properties
//       but the file's extensions are .key and .crt therefore property names 'cert' and 'crtPath'
//       are used in the options object.

export async function loadOrGenerateCertificate(options) {
	options.debug && console.log('Loading or generating certificate for use in HTTPS or HTTP2')
	try {
		await loadCertificate(options)
		options.debug && console.log('Certificate loaded')
	} catch(err) {
		await generateCertificate(options)
		options.debug && console.log('Certificate geneated')
		try {
			await storeCertificate(options)
			options.debug && console.log('Certificate stored')
			await installCertificate(options)
			options.debug && console.log('Certificate installed')
		} catch(err) {
			throw new Error(`certificate could not be loaded nor created, '${options.key}' '${options.cert}'`)
		}
	}
	return options
}

export async function loadCertificate(options) {
	options.key  = await fs.readFile(options.keyPath)
	options.cert = await fs.readFile(options.crtPath)
	return options
}

export async function generateCertificate(options) {
	// NOTE: selfsigned won't create certificate unless the name is 'commonName'
	var selfsignedAttrs   = options.selfsignedAttrs   || [{name: 'commonName', value: 'localhost'}]
	var selfsignedOptions = options.selfsignedOptions || {days: 365}
	var result = await selfsigned.generate(selfsignedAttrs, selfsignedOptions)
	options.key  = result.private
	options.cert = result.cert
	return options
}

export async function storeCertificate(options) {
	var keyPathDir = path.dirname(options.keyPath)
	var crtPathDir = path.dirname(options.crtPath)
	await ensureDirectory(keyPathDir)
	if (keyPathDir !== crtPathDir)
		await ensureDirectory(crtPathDir)
	await fs.writeFile(options.keyPath, options.key),
	await fs.writeFile(options.crtPath, options.cert)
	return options
}

export async function installCertificate(options) {
	switch (process.platform) {
		case 'win32':
			return exec(`certutil -addstore -user -f root "${options.crtPath}"`)
		case 'darwin':
			// TODO
			return
		default:
			// copy crt file to
			await ensureDirectory(`/usr/share/ca-certificates/extra/`)
			await fs.writeFile(`/usr/share/ca-certificates/extra/${options.certName}.cert`, options.cert)
			//return exec('sudo update-ca-certificates')
	}
}

function exec(command) {
	return new Promise((resolve, reject) => {
		cp.exec(command, (error, stdout, stderr) => {
			if (error || stderr)
				reject(error || stderr)
			else
				resolve(stdout)
		})
	})
}

async function ensureDirectory(directory) {
	try {
		await fs.stat(directory)
	} catch(err) {
		await fs.mkdir(directory)
	}
}