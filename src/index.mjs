import {AnchoraServer} from './AnchoraServer.mjs'

export * from './AnchoraServer.mjs'
export * from './util.mjs'
export {defaultOptions} from './options.mjs'

export function createServer(...args) {
	return new AnchoraServer(...args)
}

