import {AnchoraServer} from './AnchoraServer.mjs'

export * from './AnchoraServer.mjs'
export {HTTPCODE} from './util.mjs'


export function createServer(...args) {
	return new AnchoraServer(...args)
}

