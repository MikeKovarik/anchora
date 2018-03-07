import {fetchDom} from './dom.js'
import {renderTimes, logTimes} from './renderer.js'

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