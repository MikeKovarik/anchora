<?php

echo "<style>
body, * {
	font-family: monospace;
	white-space: pre-wrap;
	word-break: break-word;
}
td:first-child {
	word-break: initial;
}
table {
	border-collapse: collapse;
}
td {
	padding: 8px 10px;
	border: 1px solid #CCC;
}
</style>";

echo "<p>+ěščřžýáíé=´</p>";

echo "<table>";
printRow('__FILE__', __FILE__);
printRow('__DIR__', __DIR__);
printRow('$_GET', $_GET);
printRow('$_POST', $_POST);
printRow('$_REQUEST', $_REQUEST);
printServer('REQUEST_METHOD');
printServer('QUERY_STRING');
printServer('REQUEST_URI');
printServer('SCRIPT_NAME');
printServer('PHP_SELF');
printServer('SCRIPT_FILENAME');
printServer('DOCUMENT_ROOT');
printServer('CONTEXT_DOCUMENT_ROOT');
printServer('CONTEXT_PREFIX');
printServer('REQUEST_SCHEME');

printServer('SERVER_PORT');
printServer('SERVER_ADDR');
printServer('REMOTE_ADDR');
printServer('SERVER_NAME');
printServer('SERVER_PROTOCOL');
printServer('SERVER_SIGNATURE');
printServer('SERVER_SOFTWARE');

echo "</table>";



printHeader('$_SERVER HTTP_ headers');

$headers = array();
$headers['HTTP_ACCEPT'] = null;
$headers['HTTP_ACCEPT_ENCODING'] = null;
$headers['HTTP_ACCEPT_LANGUAGE'] = null;
$headers['HTTP_CACHE_CONTROL'] = null;
$headers['HTTP_CONNECTION'] = null;
$headers['HTTP_COOKIE'] = null;
$headers['HTTP_HOST'] = null;
$headers['HTTP_PRAGMA'] = null;
$headers['HTTP_UPGRADE_INSECURE_REQUESTS'] = null;
$headers['HTTP_USER_AGENT'] = null;
foreach($_SERVER as $key => $value) {
	if (substr($key, 0, 5) <> 'HTTP_') {
		continue;
	}
	$headers[$key] = $value;
}
echo "<table>";
foreach ($headers as $header => $value) {
	printRow($header, $value);
}
echo "</table>";


printHeader('$_SERVER');
printBody($_SERVER);


function printServer($key) {
	if (array_key_exists($key, $_SERVER))
		$value = $_SERVER[$key];
	else
		$value = null;
	printRow('$_SERVER' . "['$key']", $value);
}

function printRow($name, $value) {
	echo "<tr>";
	echo "	<td>" . $name . "</td>";
	echo "	<td>" . customEscape($value) . "</td>";
	echo "</tr>";
}

function printHeader($name) {
	echo "<h3>" . $name . "</h3>";
}

function printBody($value) {
	echo "<pre>" . customEscape($value) . "</pre>";
}

function customEscape($value) {
	return htmlentities(json_encode($value, JSON_PRETTY_PRINT));
}

?>