import {Cert} from 'selfsigned-ca'
import util from 'util'
import path from 'path'
import dns from 'dns'
import os from 'os'
import {ReqTargetDescriptor} from './filedescriptor.mjs'
import {debug} from './util.mjs'
dns.lookup = util.promisify(dns.lookup)


export async function loadOrGenerateCertificate() {
	if (this.cert & this.key) {
		// User provided custom certificate and loaded it into 'cert' and 'key' property for us. Nothing to do here.
		return
	}
	if (this.crtPath || this.keyPath) {
		this.devCert = await this.loadUserCert()
		// User requests use of custom certificate. This bypasses anchora's CA and per-ip certificate.
	} else {
		// Load (or generate) Root CA and localhost certificate signed by the CA.
		this.devCert = await this.loadOrGenerateCaAndCert()
	}
	this.cert = this.devCert.cert
	this.key  = this.devCert.private
}


export async function loadUserCert() {
	this.devCert = new Cert(this.crtPath, this.keyPath)
	try {
		debug(`loading existing dev certificate`)
		await this.devCert.load()
		debug(`loaded dev cert`)
	} catch(err) {
		debug(`loading dev cert failed`)
	}
	return this.devCert
}


export async function loadOrGenerateCaAndCert() {

	var lanIp = (await dns.lookup(os.hostname())).address

	this.caCert  = new Cert(path.join(this.certDir, 'anchora.root-ca'))
	this.devCert = new Cert(path.join(this.certDir, `anchora.${lanIp}`))

	// NOTE: both certs use sha256 by default. Chrome rejects certs with sha1.
	
	var caCertOptions = {
		days: 9999,
		subject: {
			commonName: 'Anchora HTTP Server',
			organizationName: 'Mutiny',
			countryName: 'Czech Republic',
		}
	}

	var devCertOptions = {
		days: 9999,
		subject: {
			commonName: lanIp,
		},
		// Chrome rejects certs that don't include the 'subject alternative name' with what's in commonName.
		extensions: [{
			name: 'subjectAltName',
			altNames: [
				{type: 2, value: 'localhost'}, // DNS
				{type: 7, ip: '127.0.0.1'}, // IP
				{type: 7, ip: lanIp}, // IP
			]
		}]
	}

	var isCaRootCertInstalled = false
	try {
		// Try to load and use existing CA certificate for signing.
		debug(`loading Root CA certificate`)
		await this.caCert.load()
		debug(`loaded Root CA`)
		isCaRootCertInstalled = await this.caCert.isInstalled()
	} catch(err) {
		debug(`loading CA cert failed, creating new one`)
		// Couldn't load existing Root CA certificate. Generate new one.
		await this.caCert.createRootCa(caCertOptions)
		debug(`created Root CA`)
		await this.caCert.save()
		debug(`stored Root CA`)
		isCaRootCertInstalled = false
	}

	// Make sure the Root CA is installed to device's keychain so that all dev certificates
	// signed by the CA are automatically trusted and green.
	if (!isCaRootCertInstalled) {
		try {
			debug(`installing Root CA`)
			await this.caCert.install()
			debug(`installed Root CA`)
		} catch(err) {
			debug(`couldn't install Root CA. HTTPS certificates won't be trusted.`)
		}
	}

	try {
		debug(`loading existing dev certificate`)
		await this.devCert.load()
		debug(`loaded dev cert`)
	} catch(err) {
		debug(`creating dev certificate for ${lanIp}`)
		await this.devCert.create(devCertOptions, this.caCert)
		debug(`created dev cert`)
		await this.devCert.save()
		debug(`stored dev cert`)
	}

	return this.devCert
}


export async function serveCertIfNeeded(req, res) {
	if (req.query.anchora === 'cert')
		this.serveCert(req, res)
}


export async function serveCert(req, res) {
	// Get cert in use. Either Root CA or fall back to user's custom cert.
	var cert = this.caCert || this.devCert
	if (cert !== undefined) {
		var certDesc = await ReqTargetDescriptor.fromPath(this, cert.crtPath)
		certDesc.mime = 'application/octet-stream'
		req.desc = certDesc
		this.serveFile(req, res)
	} else {
		res.end('Certificate is only available in HTTPS (and HTTP/2.0).')
	}
}
