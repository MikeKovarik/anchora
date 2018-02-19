import {AnchoraServer} from './AnchoraServer.mjs'

export * from './AnchoraServer.mjs'
export {MIME, HTTPCODE} from './util.mjs'


export async function createServer(...args) {
	return new AnchoraServer(...args)
}

