<?php if (!empty($_POST)): ?>
	<h1>Logged in over POST request.</h1>
	<p>Welcome, <?php echo htmlspecialchars($_POST["name"]); ?></p>
	<p>Your email is <?php echo htmlspecialchars($_POST["email"]); ?></p>
	<p><a href="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]); ?>">Login with another account</a></p>
	<h2>$_POST</h2>
	<pre><?php var_dump($_POST) ?></pre>
<?php elseif (!empty($_GET)): ?>
	<h1>Logged in over GET request.</h1>
	<p>Welcome, <?php echo htmlspecialchars($_GET["name"]); ?></p>
	<p>Your email is <?php echo htmlspecialchars($_GET["email"]); ?></p>
	<p><a href="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]); ?>">Login with another account</a></p>
	<h2>$_GET</h2>
	<pre><?php var_dump($_GET) ?></pre>
<?php else: ?>
	<form action="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]); ?>" method="POST">
		<label for="name">Name</label>
		<input type="text" name="name" id="name">
		<br>
		<label for="email">Email</label>
		<input type="text" name="email" id="email">
		<br>
		<label>Method</label>
		<br>
		<label for="req-get">GET</label>
		<input type="radio" name="req-method" id="req-get" value="GET">
		<label for="req-post">POST</label>
		<input type="radio" name="req-method" id="req-post" value="POST" checked>
		<br>
		<button type="submit">Send</button>
	</form>
	<script>
		var form = document.querySelector('form')
		form.addEventListener('submit', e => {
			form.method = form['req-method'].value
			// preven 'method' field from being sent
			document.querySelector('#req-get').disabled = true
			document.querySelector('#req-post').disabled = true
		})
	</script>
<?php endif; ?>