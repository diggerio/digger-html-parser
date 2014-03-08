/*
  Module dependencies.
*/
var fs = require('fs');
var ejs = require('ejs');
var ecstatic = require('ecstatic');
var path = require('path');
var fm = require('front-matter');
var EventEmitter = require('events').EventEmitter;
var url = require('url');
var extend = require('deep-extend');
var async = require('async');

module.exports = function(options){

	options = options || {};

	var document_root = options.document_root;
	var warehouse = options.warehouse;

	if(!warehouse){
		throw new Error('warehouse required');
	}

	if(!fs.existsSync(document_root)){
		throw new Error('document_root does not exist: ' + document_root);
	}

	var fileserver = ecstatic({
		root:path.normalize(document_root)
	})
	
	var api = new EventEmitter();

	api.handler = function(options){
		options = options || {};
		return function(req, res, next){
			var path = url.parse(req.url).pathname;

			if(path.match(/\.html?$/)){
				fs.readFile(document_root + path, 'utf8', function(error, html){
					if(error){
						res.statusCode = 500;
						res.end(error.toString());
						return;
					}

					var page = fm(html);
					var attributes = page.attributes || {};

					async.forEach(Object.keys(attributes.selectors || {}), function(name, next){
						var selector = attributes.selectors[name];
						warehouse(selector)
						.error(function(error){
							next(error.toString());
						})
						.ship(function(results){
							attributes[name] = results;
						})
					}, function(error){
						if(error){
							res.statusCode = 500;
							res.end(error.toString());
							return;
						}

						attributes.filename = document_root + path;

						api.emit('render', path, attributes, function(error, pagedata){
							if(error){
								res.statusCode = 500;
								res.send(error.toString());
								return;
							}
							try{
								var html = ejs.render(page.body, attributes);
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

	api.paths = function(options){
		options = options || {};
		var index = options.index || 'index.html';
		return function(req, res, next){
			var pathname = url.parse(req.url).pathname;
			if(pathname.match(/\.\w+$/)){
				return next();
			}
			fs.stat(document_root + pathname, function(error, stat){
				if(error || !stat){
					var extra = req.url.match(/\/$/) ? index : (addhtml ? '.html' : '')
					fs.stat(document_root + pathname + extra, function(error, stat){
						if(error || !stat){
							return next();
						}
						req.url += extra;
						next();
					})
				}
				else{
					if(stat.isDirectory()){
						req.url += index;
					}
					return next();
				}
			})
		}
	}

	return api;
}