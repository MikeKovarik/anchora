import {$main} from './dom.mjs'
import t from './times.mjs'


export function renderTimes() {
	$main.style.whiteSpace = 'pre-line'

	var pageLoadTime = t.loadEventEnd - t.navigationStart
	var connectTime = t.responseEnd - t.requestStart
	var renderTime = t.domComplete - t.domLoading

	$main.textContent = `
	pageLoadTime: ${pageLoadTime}
	connectTime: ${connectTime}
	renderTime: ${renderTime}
	`
}

export function logTimes() {
	var pageLoadTime = t.loadEventEnd - t.navigationStart
	var connectTime = t.responseEnd - t.requestStart
	var renderTime = t.domComplete - t.domLoading
	console.log('pageLoadTime', pageLoadTime)
	console.log('connectTime', connectTime)
	console.log('renderTime', renderTime)
}