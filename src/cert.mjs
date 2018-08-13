import {Cert} from 'selfsigned-ca'
import util from 'util'
import dns from 'dns'
import os from 'os'
import {debug} from './util.mjs'
dns.lookup = util.promisify(dns.lookup)


export async function loadOrGenerateCertificate() {
	if (this.cert & this.key) {
		// User provided custom certificate and loaded it into 'cert' and 'key' property for us. Nothing to do here.
		return
	}
	if (this.crtPath || this.keyPath) {
		var devCert = await this.loadUserCert()
		// User requests use of custom certificate. This bypasses anchora's CA and per-ip certificate.
	} else {
		// Load (or generate) Root CA and localhost certificate signed by the CA.
		var devCert = await this.loadOrGenerateCaAndCert()
	}
	this.cert = devCert.cert
	this.key  = devCert.private
}

export async function loadUserCert() {
	var devCert = new Cert()
	devCert.crtPath = this.crtPath
	devCert.keyPath = this.keyPath
	try {
		debug(`loading existing dev certificate`)
		await devCert.load()
		debug(`loaded dev cert`)
	} catch(err) {
		debug(`loading dev cert failed`)
	}
	return devCert
}

export async function loadOrGenerateCaAndCert() {

	var lanIp = (await dns.lookup(os.hostname())).address
	
	var caCert  = new Cert('anchora.root-ca',  this.certDir)
	var devCert = new Cert(`anchora.${lanIp}`, this.certDir)

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

	var isCaRootCertInstalled = true
	try {
		// Try to load and use existing CA certificate for signing.
		debug(`loading Root CA certificate`)
		await caCert.load()
		debug(`loaded Root CA`)
		isCaRootCertInstalled = await caCert.isInstalled()
	} catch(err) {
		debug(`loading CA cert failed, creating new one`)
		// Couldn't load existing Root CA certificate. Generate new one.
		await caCert.createRootCa(caCertOptions)
		debug(`created Root CA`)
		await caCert.save()
		debug(`stored Root CA`)
		isCaRootCertInstalled = false
	}

	// Make sure the Root CA is installed to device's keychain so that all dev certificates
	// signed by the CA are automatically trusted and green.
	if (!isCaRootCertInstalled) {
		try {
			debug(`installing Root CA`)
			await caCert.install()
			debug(`installed Root CA`)
		} catch(err) {
			debug(`couldn't install Root CA. HTTPS certificates won't be trusted.`)
		}
	}

	try {
		debug(`loading existing dev certificate`)
		await devCert.load()
		debug(`loaded dev cert`)
	} catch(err) {
		debug(`creating dev certificate for ${lanIp}`)
		await devCert.create(devCertOptions, caCert)
		debug(`created dev cert`)
		await devCert.save()
		debug(`stored dev cert`)
	}

	return devCert
}
