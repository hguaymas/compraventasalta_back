var jwt = require('jsonwebtoken');
var dbConfig = require('../config/auth.js');
var User = require('../models/user');

exports.checkAuthentication = function(req, res, next) {
    var token = req.headers.authorization;
    if(!token) {
        return res.status(401).json({
            title: 'Error de autenticación',
            message: 'Necesita iniciar sesión para ingresar a esta sección'
        })
    }
    jwt.verify(token, dbConfig.secret, function(err, decoded) {
        if(err) {
            if(err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    title: 'Error de autenticación',
                    error: {
                        message: 'Su sesión ha caducado. Por favor ingrese nuevamente'
                    },
                    error_original: err
                })
            }
            return res.status(401).json({
                title: 'Error de autenticación',
                message: 'Necesita iniciar sesión para ingresar a esta sección',
                err_message: err.message
            })
        }
        next();
    });
}

exports.hasRole = function(rolesPermitidos) {
    return function(req, res, next) {
        var token = req.headers.authorization;
        var decoded = jwt.decode(token);
        var user_id = decoded.user._id;
        User.findOne({_id: user_id}, function (err, user) {
            if (err) {
                return res.status(500).json({
                    title: 'Ocurrió un error buscando el Usuario',
                    error: err
                });
            }
            if (!user) {
                return res.status(401).json({
                    title: 'Usuario no encontrado',
                    error: {message: 'No se ha encontrado el usuario'}
                });
            }

            var roles = user.roles;
            console.log(roles);
            var access = rolesPermitidos.some(function (rol) {
                for (var i = 0; i < roles.length; i++) {
                    if (roles[i].rol === rol) {
                        console.log('ROL ADMITIDO: ' + rol);
                        return true;
                    }
                }
                console.log('ROLES NO PERMITIDOS');
                return false;
            });
            if (!access) {
                return res.status(403).json({
                    title: 'Acceso no permitido',
                    message: 'La página a la que intenta acceder está restringida para su perfil de usuario.'
                })
            } else {
                next();
            }
        });
    }
};