
// UI SETUP

if (navigator.maxTouchPoints > 0)
	document.body.setAttribute('touch', '')
if (navigator.userAgent.includes('Windows'))
	document.body.setAttribute('fluent', '')
else
	document.body.setAttribute('material', '')

// APP SETUP

var $breadcrumbs = document.querySelector('#breadcrumbs')
var $searchInput = document.querySelector('#search input')
var $search = document.querySelector('#search')
var $list = document.querySelector('#list')
var currentOrderBy
var currentOrderDirection = true

class MapStore extends Map {
	store(state) {
		this.set(state.url, state)
	}
}
var stateCache = new MapStore

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

// CLICK HANDLERS

function handleLinkClick(e) {
	var node = e.target
	while (node) {
		if (node.localName === 'a')
			break
		node = node.parentElement
	}
	if (!node)
		return
	if (!node.hasAttribute('preventable'))
		return
	e.preventDefault()
	navigate(node.href)
}

function handleSortClick(e) {
	if (e.target.classList.contains('orderby'))
		renderList(undefined, e.target.className.split(' ')[1])
}

// SEARCH HANDLERS

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

// NAVIGATION AND RENDERING

function loadInitState() {
	if (typeof initState === 'undefined') return
	let state = initState
	let {url} = state
	stateCache.store(state)
	history.replaceState(url, undefined, url)
	renderState(state, true)
}

// Loads currently stored (if any) state and silently download and render fresh data.
async function loadCachedState(url) {
	var resetScroll = true
	// Try to render cached state
	var cachedState = stateCache.get(url)
	if (cachedState) {
		renderState(cachedState, resetScroll)
		// State has been rendered with cached data, ensure the scroll won't be reset
		// once the fresh data will download and render in a moment.
		resetScroll = false
	}
	// Start downloading fresh data in meantime.
	let freshState = await fetchJson(url)
	stateCache.store(freshState)
	// Render fresh data if the state url is still opened.
	if (history.state === url)
		renderState(freshState, resetScroll)
}

async function onPopState(e) {
	// Load currently stored (if any) state and also silently download and render fresh data.
	loadCachedState(history.state)
}

// Fetch data for given url and render retrieved data.
async function navigate(url) {
	url = sanitizeUrl(url)
	// Add new data state onto history navigation stack.
	history.pushState(url, undefined, url)
	// Load currently stored (if any) state and also silently download and render fresh data.
	loadCachedState(url)
}

// Render given state into DOM.
function renderState(state, resetScroll = false) {
	document.title = state.url
	// Reset search input.
	$searchInput.value = ''
	// Render DOM
	renderBreadcrumbs(state)
	renderList(state)
	// Resetting scroll positions is a fucking disaster. Each browser has different quirks.
	if (resetScroll) {
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
	var sections = url.slice(1).split('/')
	var breadcrumbs = sections
		.map((name, i) => `<a preventable href="/${sections.slice(0, i + 1).join('/')}">${name}</a>`)
		.join('<span>/</span>')
	$breadcrumbs.innerHTML = `<a preventable href="/">localhost</a><span>/</span>` + breadcrumbs
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

function renderList(state, orderBy, filterBy) {
	if (!state)
		state = stateCache.get(history.state)
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

// UTILITIES

// Fetch directory url in JSON form.

async function fetchJson(url) {
	//var fullUrl = url + '?anchora=json'
	var fullUrl = [location.protocol, '//anchora-json.', location.host, url].join('')
	var res = await fetch(fullUrl)
	//if (res.headers.get('content-type') !== 'application/json')
		window.location.href = url
	var state = await res.json()
	stateCache.store(state)
	return state
}

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
function sanitizeUrl(url) {
	return (new URL(url, location.origin)).pathname
}

// Format bytes into easier readable formats (B, kB, MB, etc...).
function formatBytes(bytes, decimals = 2) {
	if (bytes === 0)
		return '0 B'
	var sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
	var i = Math.floor(Math.log(bytes) / Math.log(1024))
	return parseFloat((bytes / Math.pow(1024, i)).toFixed(decimals)) + ' ' + sizes[i]
}