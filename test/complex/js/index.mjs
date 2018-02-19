import {fetchDom} from './dom.mjs'
import {renderTimes, logTimes} from './renderer.mjs'

fetchDom()

function doStuff() {
	if (window.performance.timing.domContentLoadedEventEnd === 0) {
		setTimeout(doStuff, 100)
	} else {
		renderTimes()
		logTimes()
	}
}

doStuff()