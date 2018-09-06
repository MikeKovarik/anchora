function flatten(array) {
	return array.reduce((acc, val) => acc.concat(val), [])
}

export class Router {

	static fromObject(routes) {
		var router = new this
		for (var route of Object.getOwnPropertyNames(routes))
			router.get(route, routes[route])
		return router
	}

	constructor() {
		this.middleware = []
		this.handle = this.handle.bind(this)
	}

	_getScopeCondition(scope) {
		if (scope.startsWith('/')) {
			// Middleware applies to normal route (starts with /).
			// TODO: make this dynamic and do the route check on the fly with every request
			// and do not build the absolute path, but check each section separately (to allow
			// dynamic path segments)
			var fullRoute = this._getRoutePath(scope)
			return req => req.url.startsWith(fullRoute)
		} else if (scope.startsWith('.')) {
			// File extension (starts with dot)
			// example '.md' for 'whatever/route/file.md'
			var ext = scope.slice(1)
			return req => req.desc.ext === ext
		} else if (scope.endsWith('.')) {
			// Subdomain (ends with a dot)
			// example 'proxy.' for 'proxy.localhost'
			return req => req.headers.host.startsWith(scope)
		} else {
			// Custom domain (no dots, no slashes), for when hosts file is modified.
			return req => req.headers.host === scope
		}
	}

	_promisifyFunction(handler) {
		if (handler.length <= 2) return handler
		return (req, res) => new Promise(done => handler.call(this.server, req, res, done))
	}

	// accepts any form of string and function arguments.
	// use('.md', markdownPlugin)
	// use('/scope1', '/scope2', '/scope3', myRouter)
	// use('proxy.', proxyHandler)
	// use(bodyParser(), cookies(), ...)
	use(...args) {
		args = flatten(args)
		var scope = args.find(arg => typeof arg === 'string')
		// Prepare handler to work in sync and async (even with callback)
		args.filter(arg => typeof arg !== 'string')
			.forEach(handler => this._use(scope, handler))
		// Chainable
		return this
	}

	_use(scope, handler, ...conditions) {
		if (handler instanceof Router)
			this._useRouter(scope, handler, ...conditions)
		else if (typeof handler === 'object')
			this._useRouter(scope, Router.fromObject(handler), ...conditions)
		else if (typeof handler === 'function')
			this._useFunction(scope, handler, ...conditions)
	}

	_useFunction(scope, handler, ...conditions) {
		handler = this._promisifyFunction(handler)
		// Turn scope into executable condition functions that return bool.
		this._registerMiddleware(scope, handler, conditions)
	}

	_useRouter(scope, router, ...conditions) {
		router.parent = this
		router.server = this.server
		if (scope && scope.startsWith('/'))
			router.routeSegment = scope
		this._registerMiddleware(scope, router.handle, conditions)
	}

	_registerMiddleware(scope, handler, conditions) {
		if (typeof scope === 'string')
			conditions.unshift(this._getScopeCondition(scope))
		if (conditions.length) {
			var condition = req => {
				for (var cond of conditions)
					if (cond(req) === false) return false
				return true
			}
			this.middleware.push({condition, handler})
		} else {
			this.middleware.push({handler})
		}
	}

	route(scope) {
		var router = new Router(scope)
		this._useRouter(scope, router)
		return router
	}

	async handle(req, res) {
		for (let {condition, handler} of this.middleware) {
			if (condition && condition(req) === false) continue
			await handler.call(this.server, req, res)
			if (res.finished) return true
		}
		return false
	}

	get(route, ...handlers) {
		if (typeof route !== 'string')
			throw new Error(`.get() Invalid argument ${typeof route} ${route}. first argument has to be string`)
		for (var handler of handlers)
			this._use(route, handler, req => req.method === 'GET')
		return this
	}

	post(route, ...handlers) {
		if (typeof route !== 'string')
			throw new Error(`.post() Invalid argument ${typeof route} ${route}. first argument has to be string`)
		for (var handler of handlers)
			this._use(route, handler, req => req.method === 'POST')
		return this
	}

	// example: router.all('*', requireAuthentication, loadUser)
	all(route, ...handlers) {
		return this
	}

	// TODO: make this dynamic and do the route check on the fly with every request
	// and do not build the absolute path, but check each section separately (to allow
	// dynamic path segments)
	_getRoutePath(route) {
		var segments = [this.routeSegment, route]
		var router = this
		while (router.parent) {
			segments.unshift(router.parent.routeSegment)
			router = router.parent
		}
		return segments
			.filter(segment => segment)
			.join('')
	}

}