
///////////////////////////////////////////////////////////////////////////////
// UI SETUP
///////////////////////////////////////////////////////////////////////////////

if (navigator.maxTouchPoints > 0)
	document.body.setAttribute('touch', '')
if (navigator.userAgent.includes('Windows'))
	document.body.setAttribute('fluent', '')
else
	document.body.setAttribute('material', '')

///////////////////////////////////////////////////////////////////////////////
// APP SETUP
///////////////////////////////////////////////////////////////////////////////

var $breadcrumbs = document.querySelector('#breadcrumbs')
var $searchInput = document.querySelector('#search input')
var $search = document.querySelector('#search')
var $list = document.querySelector('#list')
var currentOrderBy
var currentOrderDirection = true


class MapStore extends Map {

	store(state) {
		var {url} = state
		this.set(url, state)
		sessionStorage.setItem(this._getHash(url), JSON.stringify(state))
	}

	get(url) {
		var cached = super.get(url)
		if (cached) return cached
		var stored = sessionStorage.getItem(this._getHash(url))
		if (stored) return JSON.parse(stored)
	}

	_getHash(url) {
		return `anchora-${getFullUrl(url)}`
	}

}

var cache = new MapStore

// On navigation back
window.addEventListener('popstate', onPopState)

// Handle clicking and initiate navigation if link is clicked.
document.addEventListener('click', async e => {
	handleLinkClick(e)
	handleSortClick(e)
})

window.addEventListener('keydown', onKeyDown)
$searchInput.addEventListener('input', onSearchChange)

// Add initial data state onto history navigation stack
loadInitState()

///////////////////////////////////////////////////////////////////////////////
// CLICK HANDLERS
///////////////////////////////////////////////////////////////////////////////

function handleLinkClick(e) {
	var node = e.target
	while (node) {
		if (node.localName === 'a') break
		node = node.parentElement
	}
	if (!node) return
	if (!node.hasAttribute('preventable')) return
	e.preventDefault()
	navigate(node.href)
}

function handleSortClick(e) {
	if (e.target.classList.contains('orderby'))
		renderList(undefined, e.target.className.split(' ')[1])
}

///////////////////////////////////////////////////////////////////////////////
// SEARCH HANDLERS
///////////////////////////////////////////////////////////////////////////////

var KEYCODE = {
	BACKSPACE: 8,
	TAB: 9,
	ENTER: 13,
	ESC: 27,
}

function onKeyDown(e) {
	// Go to first item if enter key is pressed.
	var {keyCode} = e
	var searchVal = $searchInput.value
	if (keyCode === KEYCODE.ENTER && searchVal) {
		e.preventDefault()
		var node = $list.firstElementChild
		if (node && node.textContent.trim() === '../')
		node = node.nextElementSibling
		if (node)
		node.click()
	} else if (keyCode === KEYCODE.ESC) {
		e.preventDefault()
		$searchInput.value = ''
		onSearchChange()
	} else if (keyCode === KEYCODE.BACKSPACE && !isSearchInputFocused()) {
		e.preventDefault()
		navigate(createParentUrl(location.pathname))
	} else if (document.activeElement !== $searchInput) {
		// Only select search input if its not focused already.
		$searchInput.focus()
	}
	// TODO add search
}

function onSearchChange(e) {
	var searchVal = $searchInput.value
	if (searchVal.length)
		$search.classList.add('visible')
	else
		$search.classList.remove('visible')
	renderList()
}

function isSearchInputFocused() {
	return $searchInput === document.activeElement
		&& $search.classList.contains('visible')
}

///////////////////////////////////////////////////////////////////////////////
// NAVIGATION AND RENDERING
///////////////////////////////////////////////////////////////////////////////

// Takes data rendered into the folder-browser.html template and renders them. 
function loadInitState() {
	if (typeof initState === 'undefined') return
	let state = initState
	let {url} = state
	// Replace current state. It's harmless and ensures nothing breaks (null state when goign all the way back).
	history.replaceState(url, undefined, url)
	// Cache and render the data.
	cache.store(state)
	renderState(state, false)
}

async function onPopState(e) {
	// Render chached state if possible and silently download and render fresh data.
	// Pass 'isNewState' argument false to prevent pushing state to history stack
	// and to ensure we go back to the original scroll position.
	navigate(history.state, false)
}

// Load & render chached state (if possible) and silently download and render fresh data.
// 'isNewState' argument is by default true and is only false when navigating back ('popstate' on
// back navigation triggers this method with 'isNewState'). 
async function navigate(url, isNewState = true) {
	// Transform url to its absolute form - starts with /
	url = getAbsoluteUrl(url)
	// Try to render cached state
	if (cache.has(url)) {
		// Render the state with cached data for now. The data might or might not have changed since caching.
		renderState(cache.get(url), isNewState)
		// We've just rendered the data from cache and possible pushed the state to history stack (unless it was
		// back navigation). But we're also fetching fresh data in the background and are about to render it in
		// a moment. Ensure it won't get pushed to history and the scroll position won't change once it renders.
		isNewState = false
	}
	// Start downloading fresh data in meantime.
	var headers = {accept: 'application/json'}
	var res = await fetch(url, {headers})
	// navigate to the url if we didn't receive JSON as response.
	if (res.headers.get('content-type') !== 'application/json') {
		// We did not receive JSON (of the folder content) but some other data type (html of index.html).
		// Do a hard redirect to the url and close this folder browser.
		window.location.href = url
	} else {
		// Received JSON of the folders content. Render it.
		let freshState = await res.json()
		// Add new data state onto history navigation stack.
		cache.store(freshState)
		// Render fresh data if the state url is still opened or if it wasn't rendered yet from cache.
		if (history.state === url || isNewState)
			renderState(freshState, isNewState)
	}
}

// Render given state into DOM.
// 'isNewState' argument defined if the state shoul be pushed to history stack and rendered without
// previous scroll e.g. scolled to top. It is true by default and treats state as if it's freshly navigated to.
// 'isNewState' should be false when navigating back, when we're returning to previously existing state and its
// scroll position. The state must not be pushed to history stack, we'd end up in a loop.
function renderState(state, isNewState = true) {
	var {url} = state
	if (isNewState) {
		// Only push the state to history if it's newly navigated to.
		// WARNING: State must not be pushed to stack if we're navigating back.
		history.pushState(url, undefined, url)
	}
	document.title = url
	// Reset search input.
	$searchInput.value = ''
	// Render DOM
	renderBreadcrumbs(state)
	renderList(state)
	// Reset scroll position if we're rendering new state.
	// Resetting scroll positions is a fucking disaster. Each browser has different quirks.
	if (isNewState) {
		$breadcrumbs.scrollLeft = 1000000
		document.body.scrollTop = 0
		document.documentElement.scrollTop = 0
		setTimeout(() => $breadcrumbs.scrollLeft = 1000000)
		setTimeout(() => document.body.scrollTop = 0)
		setTimeout(() => document.documentElement.scrollTop = 0)
	}
}

function renderBreadcrumbs(state) {
	var {url, descriptors} = state
	var sections = url
		// split route into sections 
		.split('/')
		// remove empty segments
		.filter(a => a)
	// Convert segments into fully realized links
	var links = sections.map((name, i) => ({
		name,
		// Important to ends with / to prevent unnecessary redirect to folder
		link: `/${sections.slice(0, i + 1).join('/')}/`,
	}))
	// Add localhost at the beginning
	links.unshift({
		name: location.host,
		link: '/'
	})
	// Stringify into links
	$breadcrumbs.innerHTML = links
		.map(({name, link}) => `<a preventable href="${link}">${name}</a>`)
		.join('<span>/</span>')
}

function renderList(state, orderBy, filterBy) {
	if (!state)
		state = cache.get(history.state)
	var {url, descriptors} = state
	var files = descriptors.filter(desc => desc.file)
	var folders = descriptors.filter(desc => desc.folder)
	var sorted = [...folders, ...files]
	if (orderBy) {
		if (orderBy === currentOrderBy)
			currentOrderDirection = !currentOrderDirection
		else
			currentOrderDirection = true
		if (orderBy === 'name') {
			if (currentOrderDirection)
				sorted.sort((a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1)
			else
				sorted.sort((a, b) => b.name.toLowerCase() < a.name.toLowerCase() ? -1 : 1)
		} else {
			if (currentOrderDirection)
				sorted.sort((a, b) => a[orderBy] - b[orderBy])
			else
				sorted.sort((a, b) => b[orderBy] - a[orderBy])
		}
		currentOrderBy = orderBy
	}
	if (!filterBy)
		filterBy = $searchInput.value
	if (filterBy) {
		filterBy = filterBy.toLowerCase().trim()
		sorted = sorted.filter(item => item.name.toLowerCase().includes(filterBy))
	}
	if (url !== '/') {
		if (url.endsWith('/'))
			url = url.slice(0, -1)
		var parentUrl = createParentUrl(url)
		sorted.unshift({
			name: '..',
			url: parentUrl,
			folder: true,
		})
	}
	$list.innerHTML = sorted.map(renderRow).join('\n')
}

function renderRow(desc) {
	var {name, size, mtimeMs, url, file, folder} = desc
	size = size !== undefined && file ? formatBytes(size) : ''
	if (mtimeMs && file) {
		var modified = (new Date(mtimeMs)).toLocaleDateString()
	} else {
		var modified = ''
	}
	if (folder) {
		if (!name.endsWith('/'))	name += '/'
		if (!url.endsWith('/'))		url += '/'
	}
	return `
	<a fx-item
	icon="${desc.file ? 'file' : 'folder'}"
	${folder && 'preventable'}
	href="${url}">
		<span class="name">${name}</span>
		<span class="shapeshift" secondary>
			<span class="size">${size}</span>
			<span class="modified">${modified}</span>
		</span>
	</a>`
}

///////////////////////////////////////////////////////////////////////////////
// UTILITIES
///////////////////////////////////////////////////////////////////////////////

function createParentUrl(url) {
	//new URL('../', url).href
	if (url.endsWith('/'))
		url = url.slice(0, -1)
	var lastSlashIndex = url.lastIndexOf('/')
	var parentUrl = url.slice(0, lastSlashIndex)
	if (parentUrl.endsWith('/'))
		return parentUrl
	else
		return parentUrl + '/'
}

// Ensures we only use abslute path without protocol and localhost (strip http://localhost and only keep /sub/path/to...).
function getAbsoluteUrl(url) {
	return (new URL(url, location.origin)).pathname
}
function getFullUrl(url) {
	return (new URL(url, location.origin)).href
}

// Format bytes into easier readable formats (B, kB, MB, etc...).
function formatBytes(bytes, decimals = 2) {
	if (bytes === 0)
		return '0 B'
	var sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
	var i = Math.floor(Math.log(bytes) / Math.log(1024))
	return parseFloat((bytes / Math.pow(1024, i)).toFixed(decimals)) + ' ' + sizes[i]
}