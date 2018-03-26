import selfsigned from 'selfsigned'
import cp from 'child_process'
import path from 'path'
import util from 'util'
import {fs, debug} from './util.mjs'
selfsigned.generate = util.promisify(selfsigned.generate)


// NOTE: Node's HTTPS and HTTP2 classes accept object with {key, cert} properties
//       but the file's extensions are .key and .crt therefore property names 'cert' and 'certPath'
//       are used in the options object.

export async function loadOrGenerateCertificate() {
	if (this.certPath && this.keyPath) {
		await this.loadCertificate()
	} else {
		this.certPath = this.defaultCertPath
		this.keyPath  = this.defaultKeyPath
		try {
			await this.loadCertificate()
		} catch(err) {
			await this.generateCertificate()
			await this.storeCertificate()
			await this.installCertificate()
		}
	}
}

export async function loadCertificate() {
	try {
		debug('loading certificate')
		this.cert = await fs.readFile(this.certPath)
		this.key  = await fs.readFile(this.keyPath)
		debug('certificate loaded')
	} catch(err) {
		throw new Error(`loading certificate failed, ${err.message}`)
	}
}

export async function generateCertificate() {
	try {
		debug('generating certificate')
		// NOTE: selfsigned won't create certificate unless the name is 'commonName'
		var selfsignedAttrs   = this.selfsignedAttrs   || [{name: 'commonName', value: 'localhost'}]
		var selfsignedOptions = this.selfsignedOptions || {days: 365}
		var result = await selfsigned.generate(selfsignedAttrs, selfsignedOptions)
		this.cert = result.cert
		this.key  = result.private
		debug('certificate generated')
	} catch(err) {
		throw new Error(`generating certificate failed, ${err.message}`)
	}
}

export async function storeCertificate() {
	try {
		await ensureDirectory(this.certDir)
		await fs.writeFile(this.certPath, this.cert)
		await fs.writeFile(this.keyPath,  this.key),
		debug('certificate stored')
	} catch(err) {
		throw new Error(`storing certificate failed, ${err.message}`)
	}
}

export async function installCertificate() {
	try {
		debug('installing certificate')
		switch (process.platform) {
			case 'win32':
				await exec(`certutil -addstore -user -f root "${this.certPath}"`)
			case 'darwin':
				// TODO
				return
			default:
				// copy crt file to
				await ensureDirectory(`/usr/share/ca-certificates/extra/`)
				await fs.writeFile(`/usr/share/ca-certificates/extra/${this.certName}.cert`, this.cert)
				//return exec('sudo update-ca-certificates')
		}
		debug('certificate installed')
	} catch(err) {
		throw new Error(`certificate installation failed, ${err.message}`)
	}
}

async function ensureDirectory(directory) {
	try {
		await fs.stat(directory)
	} catch(err) {
		await fs.mkdir(directory)
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
