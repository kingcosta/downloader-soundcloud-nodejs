var express = require('express'), app = express();
var config = require('../config/config.json');
var mongoDB = require('mongodb').MongoClient;
var path = require('path');
var helper = require('../helper');
var userSession = require('./session');
var routes = require('../routes');
var ErrorHandler = require('../routes/error');
var bodyParser = require('body-parser');

function CermaiJs() {
	this.app = app;
	this.run = function() {
		var host = process.env.OPENSHIFT_NODEJS_IP || config.app.host;
		var port = process.env.OPENSHIFT_NODEJS_PORT || config.app.port;
		app.listen(port, host, function() {
			console.log("Application Running On " + host + ":" + port);
		});
	}

	this.connect = function(cb) {
		if (config.connection == undefined) {
			cb("connection null", null);
		}
		else if (config.connection.replica != null) {
			var sideList = config.connection.host + ':' + config.connection.port;
			config.connection.members.forEach(function(x) {
				sideList += "," + x.host + ':' + x.port;
			})
			if (config.connection.user == '' && config.connection.pwd == '') {
				mongoDB.connect('mongodb://' + sideList + '/' + config.connection.db, function(err, db) {
					cb(err, db);
				})
			}
			else {
				mongoDB.connect('mongodb://' + config.connection.user + ':' + config.connection.pwd + '@' + sideList + '/' + config.connection.db, function(err, db) {
					cb(err, db);
				})			
			}
		}
		else {
			if (config.connection.user == '' && config.connection.pwd == '') {
				mongoDB.connect('mongodb://' + config.connection.host + ':' + config.connection.port + '/' + config.connection.db, function(err, db) {
					cb(err, db);
				})
			}
			else {
				mongoDB.connect('mongodb://' + config.connection.user + ':' + config.connection.pwd + '@' + config.connection.host + ':' + config.connection.port + '/' + config.connection.db, function(err, db) {
					cb(err, db);
				})			
			}
		}
	}
	this.initCermai = function(cermai, db) {
		//// FOR POST REQUEST /////
		if (db == null) {
			console.log("CERMAI RUNNNIG WITHOUT CONNECTION");
		}
		app.use(bodyParser.json());
		app.use(bodyParser.urlencoded({ extended: false }));
		// ## SETTING VIEW ENGINE & CSS PRECOMPILER
		cermai.set('views', path.join(__dirname, '/../views'));
		cermai.set('view engine', 'jade');
		cermai.use(require('stylus').middleware(path.join(__dirname, '../public')));
		cermai.use(express.static(path.join(__dirname, '/../public')));
		
		// ## PANGGIL ROUTES
		////////// ERROR HANDLING ////////////////
		routes(cermai, db);
		cermai.use(new ErrorHandler().error404);
		cermai.use(new ErrorHandler().error500);
	}
	this.initHelper = function(cermai) {
		////////// AUTOLOAD HELPER ////////////////
		cermai.use(helper);
	}
	this.initSession = function(cermai) {
		var	session = require('express-session'),
			redisStore = require('connect-redis')(session),
			cookieParser = require('cookie-parser');

		cermai.use(cookieParser('cermaisession'));
		if (config.redis != null) {
			var redis = require('redis').createClient();
			cermai.use(session(
				{
					secret : 'cermaisession',
					store : new redisStore({
						host : config.redis.host.toString(),
						port : config.redis.port,
						client : redis,
						db : config.redis.db,
						pass : config.redis.pwd.toString()
					}),
					resave : true
				}
			));			
		}
		else {
			cermai.use(session(
				{
					secret : 'cermaisession',
					store : '',
					resave : true
				}
			));			
		}
		cermai.use(userSession);
	}
	this.isAuth = function(req,res,next) {
		if (req.session.cermaiSession) {
			next();
		}
		else {
			res.redirect(config.page.login);
		}
	}
}

module.exports = CermaiJs;