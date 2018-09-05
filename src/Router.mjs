import events from 'events'


export class Router extends events.EventEmitter {

	static fromObject(routes) {
		for (var route in Object.getOwnPropertyNames(routes))
			this.get(route, routes[route])
	}

	_sanitizeHandler(handler) {
		handler = handler.bind(this.server)
		return this._promisifyHandler(handler)
	}

	_promisifyHandler(handler) {
		if (handler.length <= 2)
			return handler
		return (req, res) => new Promise(done => handler(req, res, done))
	}

	// accepts any form of string and function arguments.
	// use('.md', markdownPlugin)
	// use('/scope1', '/scope2', '/scope3', myRouter)
	// use('proxy.', proxyHandler)
	// use(bodyParser(), cookies(), ...)
	use(...args) {
		// Handle arguments. Scope is optional
		var scopes = args.filter(arg => typeof arg === 'string')
					|| args.find(arg => Array.isArray(arg))

		// Turn scopes into executable condition functions that return bool.
		var conditions = scopes.map(scope => {
			if (!scope.startsWith('/') && scope.endsWith('.')) {
				// Middleware can apply to specific subdomain (ends with dot)
				return req => req.headers.host.startsWith(scope)
			} else if (scope.startsWith('.')) {
				var ext = scope.slice(1)
				return req => req.desc.ext === ext
			} else if (scope.startsWith('/')) {
				// Middleware applies to normal route (starts with /).
				return req => req.url.startsWith(scope)
			} else {
				return req => req.headers.host === scope
			}
		})

		// Prepare handler to work in sync and async (even with callback)
		var handlers = args
			.filter(arg => typeof arg === 'function')
			.map(handler => {
				if (typeof handler === 'object') {
					var router = Router.Router(handler)
					// TODO
				} else if (handler instanceof Router) {
					// TODO
				} else if (typeof handler === 'function') {
					handler = _sanitizeHandler(handler)
				}
			})

		// Register each handler for each condition (scope/subdomain/extension)
		for (var handler of handlers)
			if (conditions.length === 0)
				this.middleware.push({handler})
			else for (var condition of conditions)
				this.middleware.push({condition, handler})

		// Chainable
		return this
	}

	// example: router.all('*', requireAuthentication, loadUser)
	all(route, ...handlers) {
		return this
	}

	get(route, ...handlers) {
		handlers
			.map(handler => handler.bind(this.server))
			.map(handler => (req, res) => req.method === 'GET' && handler(req, res))
			.forEach(handler => this.use(route, handler))
			return this
	}

	post(route, ...handlers) {
		handlers
			.map(handler => handler.bind(this.server))
			.map(handler => (req, res) => req.method === 'POST' && handler(req, res))
			.forEach(handler => this.use(route, handler))
			return this
	}

}