import {createServer} from '../index.mjs'


// BEWARE! Following code is an experimental implementation of CGI interface for
// running PHP and other scripting languages. Currently tightly coupled and not
// very well tested. Help and contributions are welcomed.

var options = {
	root: `C:\\Users\\${process.env.USERNAME}\\OneDrive\\Dev`,
	// path to your php installation
	phpPath: `C:\\xampp\\php\\php-cgi.exe`,
}

createServer(options)
	.catch(console.error)
