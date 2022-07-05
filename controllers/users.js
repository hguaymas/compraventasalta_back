var User = require('../models/user');
var Category = require('../models/category');
var fs = require('fs');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');
var randtoken = require('rand-token');
const hbs = require('nodemailer-express-handlebars');
const mailConfig = require('../config/mailconfig');
const handlebars = require('express-handlebars');
const path = require('path');
const breaklines = require('../utils/breaklines');
const moment = require('moment');
const authConfig = require('../config/auth');

const AWS = require('aws-sdk');
const bucketName = "anunciatesalta-images";
const pathCdn = process.env.PATH_CDN || 'https://d24ybofanksy1z.cloudfront.net';
AWS.config.region = 'sa-east-1';
AWS.config.credentials = new AWS.Credentials(process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET);
//accessKeyId y secret se configura mediante ENV

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

exports.createUser = function (req, res, next) {
    console.log('BODY');
    console.log(req.body);
    console.log('FILES');
    console.log(req.files);
    var images = [];
    if (req.files && req.files.image) {
        for (var i = 0; i < req.files.image.length; i++) {
            var image = req.files.image[i];
            images.push({
                originalFilename: image.originalFilename,
                mimeType: image.type,
                size: image.size,
                filename: image.name,
                path: image.path,
                principal: req.body.principal[i] === 'true'
            })
        }
    }
    var user = new User({
        title: req.body.title,
        content: req.body.content,
        price: req.body.price,
        // phone: req.body.phone,
        // address: req.body.address,
        category: req.body.category,
        city: req.body.city,
        images: images
    });
    console.log(user.images);
    user.save(function (err, result) {
        if (err) {
            console.error(err);
            return res.status(500).json({
                title: 'Ocurrió un error guardando el anuncio',
                error: err
            });
        }
        res.status(201).json({
            user: 'Se ha creado el anuncio exitosamente',
            obj: result
        });
    });
};

exports.getUser = function (req, res, next) {
    var id = req.params.id;
    User.findOne({
        '_id': id
    })
        .populate('city')
        .exec(function (err, user) {
            if (err) {
                return res.status(500).json({
                    title: 'Error al obtener el usuario',
                    error: err
                });
            }
            res.status(200).json(user)
        });
};

exports.listUsers = function (req, res, next) {
    var categorySlug = req.query.categorySlug;
    var query = {};
    var categoryIds = [];

    if (categorySlug) {
        Category.findOne({slug: categorySlug}, function (err, cat) {
            if (err) {
                return res.status(500).json({
                    title: 'Error al obtener la categoría "' + categorySlug + '"',
                    error: err
                });
            }
            if (cat) {
                cat.getArrayTree(function (err, categories) {
                    if (err) {
                        return res.status(500).json({
                            title: 'Error al obtener categorías',
                            error: err
                        });
                    }
                    categories.forEach(function (index, category) {
                        categoryIds.push(category._id);
                    });
                    query.category = {
                        $in: categoryIds
                    }
                })
            }
        });
    }
    User.find(query)
        .populate('category', 'name')
        .populate('city', 'name')
        .exec(function (err, users) {
            if (err) {
                return res.status(500).json({
                    title: 'Error al obtener anuncios',
                    error: err
                });
            }
            res.status(200).json({
                title: 'Success!',
                obj: users
            })
        });
};


exports.updateUser = async (req, res, next) => {
    console.log(req.files);
    try {
        var user = await User.findById(req.params.id);

        if (!user) {
            return res.status(500).json({
                title: 'No se encontró el Usuario!',
                error: {message: 'Usuario no encontrado'}
            });
        } else {

            user.username = req.body.username;
            user.email = req.body.email;
            user.phone = req.body.phone;
            user.city = req.body.city;

            try {
                const userUpdated = await user.save();
                var obj = userUpdated.toObject();
                delete obj.password;
                User.populate(obj, {path: 'city'}, function (err, user) {
                    if (err) {
                        return res.status(500).json({
                            title: 'Ocurrió un error actualizando el usuario',
                            error: err
                        });
                    }
                    else {
                        res.status(200).json(user);
                    }
                });

            } catch (err) {
                console.error(err);
                return res.status(500).json({
                    title: 'Ocurrió un error actualizando el usuario',
                    error: err
                });
            }
        }
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            title: 'Ocurrió un error recuperando el usuario',
            error: err
        });
    }
};

exports.updateUserPhoto = async (req, res, next) => {
    console.log(req.files);
    var token = req.headers.authorization;
    var decoded = jwt.decode(token);
    var user_id = decoded.sub;
    try {
        var user = await User.findById(user_id);

        if (!user) {
            return res.status(500).json({
                title: 'No se encontró el Usuario!',
                error: {message: 'Usuario no encontrado'}
            });
        } else {
            if (req.files && req.files.photo) {
                console.log('Hay foto');
                try {
                    if (user.photo && user.photo !== 'undefined') {
                        const deletedImage = await s3Delete(user.photo.path);
                        console.log('imagen borrada: ' + deletedImage);
                    }
                    const image = req.files.photo;
                    const uploadedImage = await s3Upload(image);
                    console.log('uploadedImage', uploadedImage);
                    var photo = {
                        originalFilename: image.originalFilename,
                        mimeType: image.type,
                        size: image.size,
                        filename: image.name,
                        path: uploadedImage.Location,
                        pathCdn: pathCdn + '/' + uploadedImage.key,
                        relativePath: uploadedImage.key
                    };
                    user.photo = photo;
                    fs.unlinkSync(image.path);
                    console.log('image', image);
                } catch (err) {
                    console.error(err);
                    return res.status(500).json({
                        title: 'Ocurrió un error actualizando la foto',
                        error: err
                    });
                }
            } else {
                // Decidio borrar la foto actual
                if (user.photo && user.photo !== 'undefined' && req.body.photoChanged === 'true') {
                    const deletedImage = await s3Delete(user.photo.path);
                    user.photo = null;
                    console.log('imagen borrada: ' + deletedImage);
                }
            }
            try {
                const userUpdated = await user.save();
                User.populate(userUpdated, {path: 'city'}, function (err, user) {
                    if (err) {
                        return res.status(500).json({
                            title: 'Ocurrió un error actualizando el usuario',
                            error: err
                        });
                    }
                    else {
                        res.status(200).json(user);
                    }
                });

            } catch (err) {
                console.error(err);
                return res.status(500).json({
                    title: 'Ocurrió un error actualizando el usuario',
                    error: err
                });
            }
        }
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            title: 'Ocurrió un error recuperando el usuario',
            error: err
        });
    }
};

exports.deleteUser = function (req, res, next) {

};

exports.uploadImages = function (req, res) {
    // var userId = req.params.id;
    var file_name = 'No subido...';
    console.log(req.files);
    if (req.files) {
        for (var i = 0; i < req.files.images.length; i++) {
            console.log(req.files.images[i]);
        }
    }
    res.send(req.files);
};

exports.registerUser = async (req, res, next) => {
    console.log('BODY');
    console.log(req.body);
    var confirmationToken = randtoken.generate(16);
    var user = new User({
        email: req.body.email,
        password: req.body.password,
        roles: [authConfig.roles.USER],
        confirmationToken: confirmationToken,
        confirmationExpirationDate: moment().add(1, 'days')
    });
    if(user.methods.indexOf('local') === -1) {
        user.methods.push('local');
    }
    try {
        const savedUser = await user.save();

        const url = process.env.HOST || 'http://localhost:4200' + '/account_activation/' + savedUser._id + '/' + confirmationToken;
        //send mail with options
        var mailOptions = {
            from: mailConfig.from, // sender address
            to: savedUser.email, // list of receivers
            subject: 'Confirmación de Cuenta', // Subject line
            text: 'Hola! Gracias por registrarte en CompraVenta Salta, necesitamos que verifiques tu cuenta copiando la siguiente dirección: "' + url + '" y pegándola en tu navegador. Muchas gracias', // plain text body
            template: 'user_confirmation',
            context: {
                user: savedUser,
                url: url
            },
            attachments: [mailConfig.attachments]
        };

        var info = await mailConfig.sendMail(mailOptions);
        res.status(201).json(savedUser);
    } catch(err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error registrando el usuario',
            error: err
        });
    }
};

exports.changePassword = async (req, res, next) => {
    var oldPassword = req.body.oldPassword;
    var newPassword = req.body.newPassword;
    var token = req.headers.authorization;
    var decoded = jwt.decode(token);
    var user_id = decoded.sub;
    try {
        var user = await User.findById(user_id);
        if (user) {
            if (!bcrypt.compareSync(oldPassword, user.password)) {
                return res.status(500).json({
                    title: 'Error',
                    message: 'La contraseña actual es incorrecta'
                });
            }
            user.password = newPassword;
            const savedUser = await user.save();
            var obj = savedUser.toObject();
            delete obj.password;
            User.populate(obj, {path: 'city'}, function (err, user) {
                if (err) {
                    return res.status(500).json({
                        title: 'Ocurrió un error modificando la contraseña del usuario',
                        error: err
                    });
                }
                res.status(200).json(user);
            });
        }
    } catch (err) {
        return res.status(500).json({
            title: 'Ocurrió un error recuperando el Usuario',
            error: err
        });
    }
};

exports.updateRequestedPassword = async (req, res, next) => {
    var newPassword = req.body.newPassword;
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
            title: 'Ocurrió un error actualizando la contraseña del usuario',
            error: err
        });
    }
};

async function s3Delete(file) {
    const s3 = new AWS.S3({
        params: {
            Bucket: bucketName
        }
    });
    const filename = file.replace(/^.*[\\\/]/, '');
    console.log('Imagen a borrar: ' + filename)
    return s3
        .deleteObject({
            Bucket: bucketName,
            Key: 'profiles/' + filename
        })
        .promise();
}

async function s3Upload(file) {
    const s3 = new AWS.S3({
        params: {
            Bucket: bucketName
        }
    });
    const filename = file.path.replace(/^.*[\\\/]/, '');
    const tmp_path = file.path;
    const fileStream = fs.createReadStream(tmp_path);

    return s3
        .upload({
            Bucket: bucketName,
            Key: 'profiles/' + filename,
            ACL: 'public-read',
            Body: fileStream,
            ContentType: file.type
        })
        .promise();
}
