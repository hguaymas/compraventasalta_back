var vorpal = require('vorpal')();
require('dotenv').config();
var authConfig = require('../config/auth.js');
var User = require('../models/user');
var mongoose = require('mongoose');
var databaseConfig = require('../config/database.js');

vorpal
    .command('create_admin <email> <password> <firstName> <lastName>', 'Crea un usuario administrador')
    .action(function(args, callback) {
        mongoose.Promise = global.Promise;
        mongoose.connect(process.env.DB_SERVER, {
            useMongoClient: true
        }).catch(function(err) {
            console.log('Error de conexion', err);
        });

        var roles = [authConfig.roles.ADMINISTRATOR];
        var user = new User({
            firstName: args.firstName,
            lastName: args.lastName,
            email: args.email,
            roles: roles,
            methods: ["local"],
            password: args.password
        });
        console.log('Insertando usuario... ');
        console.log(user);
        user.save(function(err, result) {
            if (err) {
                console.error(err);
            }
            console.log('Usuario creado...');
            callback();
        });
    });

vorpal
    .delimiter('anunciate$')
    .show();