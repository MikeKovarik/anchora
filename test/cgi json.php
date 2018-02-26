<?php
header('Content-Type: application/json');

$arr = array();

$arr['__FILE__'] =  __FILE__;
$arr['__DIR__'] =  __DIR__;
$arr['$_GET'] =  $_GET;
$arr['$_POST'] =  $_POST;
$arr['$_REQUEST'] =  $_REQUEST;

$headers = array();
foreach($_SERVER as $key => $value) {
	if (substr($key, 0, 5) <> 'HTTP_') {
		continue;
	}
	$header = strtolower(substr($key, 5));
	$header = str_replace('_', '-', $header);
	$headers[$header] = $value;
}
$arr['headers'] =  $headers;

$arr['$_SERVER'] =  $_SERVER;

echo json_encode($arr);

?>