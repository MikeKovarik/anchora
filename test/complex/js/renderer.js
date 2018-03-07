import {$main} from './dom.js'
import t from './times.js'


export function renderTimes() {
	$main.style.whiteSpace = 'pre-line'

	var pageLoadTime = t.loadEventEnd - t.navigationStart
	var connectTime = t.responseEnd - t.requestStart
	var renderTime = t.domComplete - t.domLoading

	var newDiv = document.createElement('div')
	newDiv.textContent = `
	pageLoadTime: ${pageLoadTime}
	connectTime: ${connectTime}
	renderTime: ${renderTime}
	`

	$main.appendChild(newDiv)
}

export function logTimes() {
	var pageLoadTime = t.loadEventEnd - t.navigationStart
	var connectTime = t.responseEnd - t.requestStart
	var renderTime = t.domComplete - t.domLoading
	console.log('pageLoadTime', pageLoadTime)
	console.log('connectTime', connectTime)
	console.log('renderTime', renderTime)
}