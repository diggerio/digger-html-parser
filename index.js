/*
  Module dependencies.
*/
var fs = require('fs');
var ejs = require('ejs');
var ecstatic = require('ecstatic');
var path = require('path');
var EventEmitter = require('events').EventEmitter;
var url = require('url');
var extend = require('deep-extend');
var async = require('async');

module.exports = function($digger, options){

	options = options || {};

	var document_root = options.document_root;
	var warehouse = options.warehouse;

	if(!fs.existsSync(document_root)){
		throw new Error('document_root does not exist: ' + document_root);
	}

	var fileserver = ecstatic({
		root:path.normalize(document_root)
	})

	var api = new EventEmitter();

	api.load_selectors = function(selectors, done){

		var results = {};

		async.forEach(Object.keys(selectors || {}), function(name, next){
			var selector = selectors[name];

			var usewarehouse = warehouse;
			if(selector.charAt(0)=='/'){
				var parts = selector.split(/\s/);
				usewarehouse = parts.shift();
				selector = parts.join(' ');
			}

			var warehouseobj = $digger.connect(usewarehouse);

			warehouseobj(selector)
			.error(function(error){
				next(error.toString());
			})
			.ship(function(r){
				results[name] = r;
				next();
			})
		}, function(error){
			if(error){
				return done(error);
			}
			done(null, results);
		})
	}

	api.parse_html = function(html){

		var frontmatter = null;

		var html = html.replace(/^---[\w\W]+?---\n?/, function(match){
			frontmatter = match;
			return '';
		})

		var selectors = {};

		if(frontmatter){
			frontmatter = frontmatter.replace(/---/g, '');
			var lines = frontmatter.split(/\n/);
			lines.forEach(function(line){
				var parts = line.split(/:/);
				var name = parts.shift();
				var value = parts.join(':').replace(/^\s+/, '');
				if(name && name.match(/\w/)){
					selectors[name] = value;	
				}
				
			})
		}

		return {
			body:html,
			selectors:selectors
		};
	}

	api.handler = function(options){
		options = options || {};
		var self = this;
		return function(req, res, next){
			var path = url.parse(req.url).pathname;

			if(path.match(/\/$/)){
				path += 'index.html';
			}

			if(path.match(/\.html?$/)){
				fs.readFile(document_root + path, 'utf8', function(error, html){
					if(error){
						res.statusCode = 500;
						res.end(error.toString());
						return;
					}

					var parsed = self.parse_html(html);

					console.log('-------------------------------------------');
					console.dir(parsed.selectors);

					self.load_selectors(parsed.selectors, function(error, results){
						if(error){
							res.statusCode = 500;
							res.end(error.toString());
							return;
						}

						results.filename = document_root + path;

						api.emit('render', path, results, function(error){
							if(error){
								res.statusCode = 500;
								res.send(error.toString());
								return;
							}
							try{
								var html = ejs.render(parsed.body, results);
								res.send(html);
							} catch(e){
								res.statusCode = 500;
								res.send(e.toString());
							}
						})
					})
					
				})
			}
			else{

				fileserver(req, res, next);
			}
		}
	}

	return api;
}