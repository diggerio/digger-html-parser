digger-html-parser
==================

Process front-matter in .html files that loads data for ejs templates to use

## installation

```
$ npm install digger-html-parser
```

## usage

Create a new parser - pass a document root and a warehouse to load data from.

```js
var DiggerHTML = require('digger-html-parser');

var html = DiggerHTML({
	document_root:document_root,
	warehouse:$digger.connect('/website')
})
```

Capture render events to inject extra page vars:

```js
html.on('render', function(path, vars, done){
	vars.shopdata = config.shopdata;
	done();
})
```

Use it in your express application:

```js
app.use(html.handler());
```

## page format

.html pages in your document root can be processed as EJS templates.

To load digger containers to use in the template - you write selectors in the pages front-matter:

```html
---
products: #shop > product[price<100]:tree
news: #news > story:limit(5)
---
<html>
<head>
	<title>My Digger Shop</title>
</head>
<body>
	<h1>Products</h1>

	<!-- loop products -->
	<% products.each(function(product){ %>

		<div>
			<%= product.attr('name') %> @ <%= product.attr('price') %>
			<hr />

			<!-- loop images -->
			<% product.find('img').each(function(image){ %>
				<img src="/fileproxy/<%- image.attr('src') %>" />
			<% }) %>

		</div>

	<% }) %>
</body>
</html>
```

## license

MIT