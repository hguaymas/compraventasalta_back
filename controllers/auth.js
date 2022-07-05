var User = require('../models/user');

var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');
var authConfig = require('../config/auth.js');
var moment = require('moment');
var randtoken = require('rand-token');
const hbs = require('nodemailer-express-handlebars');
const mailConfig = require('../config/mailconfig');
const handlebars = require('express-handlebars');
const path = require('path');
const breaklines = require('../utils/breaklines');


signToken = user => {
    return jwt.sign({
        iss: 'CompraVentaSalta',
        sub: user._id,
        iat: new Date().getTime(),
        exp: new Number(moment().add(1, 'days').format('X'))
    }, authConfig.secret);
}


function setUserInfo(request) {
    return {
        _id: request._id,
        email: request.email,
        roles: request.roles
    };
}

/*exports.login = function(req, res, next) {
    const token = signToken(req.user);
    const decoded = jwt.decode(token);
    const obj = req.user.toObject();
    delete obj.password;
    res.status(200).json({
        token: token,
        user: obj,
        exp: decoded.exp
    });
};*/

exports.loginFacebook = function (req, res, next) {
    console.log(req.user);
    const token = signToken(req.user);
    const decoded = jwt.decode(token);
    User.populate(req.user, {path: 'city'}, function (err, user) {
        if (err) {
            console.log(err);
        }
        else {
            res.status(200).json({
                message: 'Inicio de Sesión correcto',
                token: token,
                user: user,
                method: 'facebook',
                exp: decoded.exp
            });
        }
    });

};

exports.login = async (req, res, next) => {
    const user = await User.findOne({email: req.body.email});
    if (!user) {
        return res.status(401).json({
            title: 'Error de Inicio de Sesión',
            message: 'El usuario/email ingresado es incorrecto'
        });
    }
    if (!user.accountActivated) {
        try {
            await this.sendActivationEmail(user, false);
            return res.status(401).json({
                title: 'Error de Inicio de Sesión',
                user: user._id,
                message: 'Tu cuenta aún no se encuentra activada. Te enviamos un email con el link de activación.'
            });
        } catch (err) {
            console.log(err);
            return res.status(500).json({
                title: 'Envío de email fallido',
                user: user._id,
                message: 'No se pudo enviar el email de activación.'
            });
        }

        // Invocar funcion para enviar el link
    }
    if (!user.isEnabled) {
        return res.status(401).json({
            title: 'Error de Inicio de Sesión',
            message: 'Su cuenta se encuentra bloqueada por el administrador. Póngase en contacto para resolverlo.'
        });
    }
    const isMatch = await user.comparePassword(req.body.password);

    if (!isMatch) {
        return res.status(401).json({
            title: 'Error de Inicio de Sesión',
            message: 'La contraseña es incorrecta'
        });
    }
    await user.save();
    var obj = user.toObject();
    const token = signToken(obj);
    const decoded = jwt.decode(token);
    delete obj.password;
    User.populate(obj, {path: 'city'}, function (err, user) {
        if (err) {
            return res.status(500).json({
                title: 'Error al obtener la ciudad del usuario',
                error: err
            });
        }
        res.status(200).json({
            message: 'Inicio de Sesión correcto',
            token: token,
            user: user,
            userId: obj._id,
            method: 'local',
            exp: decoded.exp
        });
    });
};

exports.sendActivationlink = async (req, res, next) => {
    const user = await User.findOne({'_id': req.body.user});
    if (!user) {
        return res.status(401).json({
            title: 'Error de Activación',
            message: 'No se encontró el usuario para el envío del email'
        });
    }
    try {
        const result = await this.sendActivationEmail(user, false);
        res.status(200).json(result);
    } catch (err) {
        return res.status(500).json({
            title: 'Error de Envío',
            message: 'No se puedo enviar el correo con el link de activación'
        });
    }
};

exports.activateAccount = async (req, res, next) => {
    const user = await User.findOne({'_id': req.body.user});
    if (!user) {
        return res.status(401).json({
            title: 'Error de Activación',
            code: '004',
            user: null,
            message: 'No se encontró el usuario para la activación'
        });
    }
    if (user.accountActivated) {
        return res.status(401).json({
            title: 'Error de Activación',
            code: '004',
            user: null,
            message: 'Ya activaste tu cuenta anteriormente!.'
        });
    }
    if (req.body.token == user.confirmationToken) {
        if (user.confirmationExpirationDate < new Date()) {
            try {
                await this.sendActivationEmail(user, true);
                return res.status(500).json({
                    title: 'Token expirado',
                    code: '001',
                    user: user._id,
                    message: 'El período de activación se encuentra expirado. Te enviamos otro email con un nuevo link'
                });
            } catch (err) {
                return res.status(500).json({
                    title: 'Error de envío',
                    code: '002',
                    user: user._id,
                    message: 'Hubo un error al intentar enviar nuevamente el link de activación'
                });
            }
        }
        user.isEnabled = true;
        user.accountActivated = true;
        await user.save();
        res.status(200).json(user);
    } else {
        return res.status(500).json({
            title: 'Token inválido',
            code: '003',
            user: user._id,
            message: 'El token de activación es inválido'
        });
    }
};

exports.roleAuthorization = function (roles) {

    return function (req, res, next) {

        var user = req.user;

        User.findById(user._id, function (err, foundUser) {

            if (err) {
                res.status(422).json({error: 'No user found.'});
                return next(err);
            }

            if (roles.indexOf(foundUser.role) > -1) {
                return next();
            }

            res.status(401).json({error: 'You are not authorized to view this content'});
            return next('Unauthorized');

        });
    };
};
exports.sendActivationEmail = async (user, sendNew) => {
    var confirmationToken = user.confirmationToken;
    user.confirmationExpirationDate = moment().add(2, 'hours');
    if (sendNew || !confirmationToken) {
        try {
            confirmationToken = randtoken.generate(16);
            user.confirmationToken = confirmationToken;
            user = await user.save();
        } catch (err) {
            throw err;
        }
    }

    const url = (process.env.HOST || 'http://localhost:4200') + '/account_activation/' + user._id + '/' + confirmationToken;
    //send mail with options
    var mailOptions = {
        from: mailConfig.from, // sender address
        to: user.email, // list of receivers
        subject: 'Confirmación de Cuenta', // Subject line
        text: 'Hola! Gracias por registrarte en CompraVenta Salta, necesitamos que verifiques tu cuenta copiando la siguiente dirección: "' + url + '" y pegándola en tu navegador. Muchas gracias', // plain text body
        template: 'user_confirmation',
        context: {
            user: user,
            url: url
        },
        attachments: [mailConfig.attachments]
    };
    var info = await mailConfig.sendMail(mailOptions);
    return info;
};

exports.sendNewPasswordLink = async (req, res, next) => {
    try {
        const user = await User.findOneAndUpdate({email: req.body.email}, {
            $set: {
                passwordRequestedToken: randtoken.generate(16),
                passwordRequestedExp: moment().add(2, 'hours')
            }
        }, {new: true}).exec();

        if (!user) {
            return res.status(500).json({
                title: 'Error',
                message: 'No se encontró ningún usuario con la dirección de email ingresada'
            });
        }
        const url = (process.env.HOST || 'https://www.compraventasalta.com.ar') + '/recuperar-clave/' + user._id + '/' + user.passwordRequestedToken;
        //send mail with options
        var mailOptions = {
            from: mailConfig.from, // sender address
            to: user.email, // list of receivers
            subject: 'Restablecimiento de contraseña', // Subject line
            text: 'Hola! Solicitaste la renovación de tu clave en CompraVenta Salta, necesitamos que ingreses a la siguiente dirección: "' + url + '". Muchas gracias', // plain text body
            template: 'user_request_password',
            context: {
                user: user,
                url: url
            },
            attachments: [mailConfig.attachments]
        };
        const info = await mailConfig.sendMail(mailOptions);
        res.status(200).json(info);
    } catch (err) {
        return res.status(500).json({
            title: 'Error en recuperación de contraseña',
            message: err.message
        });
    }
};

exports.checkUserToken = async (req, res, next) => {
    const user = await User.findOne({'_id': req.body.user});
    if (!user) {
        return res.status(500).json({
            title: 'Error',
            message: 'No se encontró ningún usuario'
        });
    }
    try {
        if (req.body.token == user.passwordRequestedToken) {
            console.log('user.passwordRequestedExp', user.passwordRequestedExp);
            console.log('moment', moment());
            if (user.passwordRequestedExp > moment()) {
                var obj = user.toObject();
                delete obj.password;
                res.status(200).json(obj);
            } else {
                return res.status(500).json({
                    title: 'Error',
                    message: 'El enlace generado para el restablecimiento de contraseña ya expiró. Por favor, solicitalo nuevamente'
                });
            }
        } else {
            return res.status(500).json({
                title: 'Error',
                message: 'El enlace para el restablecimiento de contraseña es incorrecto o ya expiró'
            });
        }
    } catch (err) {
        return res.status(500).json({
            title: 'Error en recuperación de contraseña',
            message: err.message
        });
    }

};

exports.updateRequestedPassword = async (req, res, next) => {
    var newPassword = req.body.newPassword;
    var token = req.body.token;
    var user_id = req.body.user;
    try {
        var user = await User.findById(user_id);
        if (user) {
            user.password = newPassword;
            const savedUser = await user.save();
            var obj = savedUser.toObject();
            delete obj.password;
            res.status(200).json(obj);
        }
    } catch (err) {
        return res.status(500).json({
            title: 'Ocurrió un error recuperando el Usuario',
            error: err
        });
    }
};
