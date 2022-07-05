require('dotenv').config({path:__dirname+'/./.env'});
var express = require('express');
const cron = require("node-cron");
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var databaseConfig = require('./config/database');
var passport = require("passport");
var config = require('./config/config');

var appRoutes = require('./routes/app');
var adsRoutes = require('./routes/ads');
var categoriesRoutes = require('./routes/categories');
var subcategoriesRoutes = require('./routes/subcategories');
var citiesRoutes = require('./routes/cities');
var usersRoutes = require('./routes/users');
var messagesRoutes = require('./routes/messages');
var notificationsRoutes = require('./routes/notifications');
const Handlebars = require('hbs');
var adsController = require('./controllers/ads');

Handlebars.registerHelper('nl2br', function (text, isXhtml) {
    var breakTag = (isXhtml || typeof isXhtml === 'undefined') ? '<br />' : '<br>';
    return (text + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2');
});

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

mongoose.Promise = global.Promise;
mongoose.connect(process.env.DB_SERVER || 'mongodb://anunciate:4tl4s1320@206.189.72.168:27019/anunciateSalta', {
    config: {autoIndex: false },
    useMongoClient: true
}).catch(function(err) {
    console.log('Error de conexion', err);
});

app.use(function(req, res, next){
    res.io = io;
    next();
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/static', express.static('uploads'));

app.use(passport.initialize());

app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, PUT, DELETE, OPTIONS');
    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
        res.sendStatus(200);
    }
    else {
        next();
    }
});

app.use('/', appRoutes);
app.use('/ads', adsRoutes);
app.use('/categories', categoriesRoutes);
app.use('/subcategories', subcategoriesRoutes);
app.use('/cities', citiesRoutes);
app.use('/users', usersRoutes);
app.use('/messages', messagesRoutes);
app.use('/notifications', notificationsRoutes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  res.render('index');
});

const task = cron.schedule(config.republishCron, function(){
    adsController.checkRepublishAds();
}, {
    timezone: "America/Argentina"
});
task.start();

module.exports = {app: app, server: server};
