var vorpal = require('vorpal')();
var authConfig = require('../config/auth.js');

var mongoose = require('mongoose');
//var adSchema = require('../Ad').schema;
//var Ad = mongoose.model('Ad', adSchema);
var Ad = require('../models/ad');
var databaseConfig = require('../config/database.js');

vorpal
    .command('sync_ads', 'Crea un usuario administrador')
    .action(function(args, callback) {
        mongoose.Promise = global.Promise;
        mongoose.connect(process.env.DB_SERVER || 'mongodb://anunciate:4tl4s1320@206.189.72.168:27019/anunciateSalta', {
            config: {autoIndex: false },
            useMongoClient: true
        }).catch(function(err) {
            console.log('Error de conexion', err);
        });

        var stream = Ad.synchronize();
        var count = 0;
        stream.on('data', function(err, doc){
            count++;
        });
        stream.on('close', function(){
            console.log('indexed ' + count + ' documents!');
            callback();
        });
        stream.on('error', function(err){
            console.log(err);
        });
    });

vorpal
    .delimiter('anunciate$')
    .show();