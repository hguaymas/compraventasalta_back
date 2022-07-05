const Ad = require('../models/ad');
const Message = require('../models/message');
const hbs = require('nodemailer-express-handlebars');
const mailConfig = require('../config/mailconfig');
const handlebars = require('express-handlebars');
const path = require('path');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Notification = require('../models/notification');
const fs = require('fs');
const AWS = require('aws-sdk');
const bucketName = "anunciatesalta-images";
const pathCdn = process.env.PATH_CDN || 'https://d24ybofanksy1z.cloudfront.net';
const bl = require('../utils/breaklines.js');
const Handlebars = require('hbs');
var ObjectId = require('mongoose').Types.ObjectId;

AWS.config.region = 'sa-east-1';
AWS.config.credentials = new AWS.Credentials(process.env.AWS_ACCESS_KEY_ID,process.env.AWS_SECRET);
//accessKeyId y secret se configura mediante ENV

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function s3Upload(file, filename) {
    const s3 = new AWS.S3({
        params: {
            Bucket: bucketName
        }
    });
    const tmp_path = file.path;
    const fileStream = fs.createReadStream(tmp_path);

    return s3
        .upload({
            Bucket: bucketName,
            Key: 'ads/'+filename,
            ACL: 'public-read',
            Body: fileStream,
            ContentType: file.type
        })
        .promise();
}

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
            Key: 'ads/'+filename
        })
        .promise();
}

exports.contactMessage = async (req, res, next) => {
    console.log(req.body);
    var firstname = req.body.firstname;
    var lastname = req.body.lastname;
    var email = req.body.email;
    var subject = req.body.subject;
    var messageText = req.body.comments;
    try {
        //send mail with options
        var mailOptions = {
            to: 'soporte@compraventasalta.com.ar', // list of receivers
            subject: 'Nuevo mensaje: "' + subject + '"', // Subject line
            text: messageText, // plain text body
            template: 'ad_contact',
            context: {
                firstname: firstname,
                lastname: lastname,
                email: email,
                subject: subject,
                message: messageText
            }
        };

        var info = await mailConfig.sendMail(mailOptions);
        res.status(200).json({
            title: 'Se ha enviado el mensaje exitosamente',
            info: info
        });

    } catch(err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error enviando el mensaje',
            error: err
        });
    }
};

/*
* Corresponde a los mensajes enviados desde un aviso del frontend
* */
exports.sendMessage = async (req, res, next) => {
    console.log(req.body);
    var adId = req.body.adId;
    var messageText = req.body.message;
    var token = req.headers.authorization;
    console.log('token', token);
    var decoded = jwt.decode(token);
    var userId = decoded.sub;
    try {
        let message = await Message.findOne({'userFrom': userId, 'ad': adId});
        let ad = await Ad.findOne({'_id': adId}).populate('user');
        if(ad) {
            if(message) {
                message.readedFrom = true; //El remitente del mensaje ya lo tiene leído
                message.readedTo = false;
                message.chat.push({
                    author: userId,
                    messageDate: new Date(),
                    text: messageText
                })
            } else {
                message = new Message({
                    ad: adId,
                    userFrom: userId,
                    userTo: ad.user._id,
                    readedFrom: true,
                    readedTo: false,
                    chat: [{
                        author: userId,
                        messageDate: new Date(),
                        text: messageText
                    }]
                })
            }
            const savedMessage = await message.save();
            if(savedMessage) {
                const message = await Message.populate(savedMessage, {path: 'ad userFrom userTo chat.author'});
                await res.io.emit('new-message', message);
                const notification = new Notification({
                    user: ad.user._id,
                    text: 'Tienes mensajes nuevos por tus publicaciones',
                    notificationDate: new Date(),
                    link: '/backend/mis-mensajes/recibidos',
                    readed: false,
                    code: '01'
                });
                const savedNotification = await notification.save();
                await res.io.emit('new-notification', savedNotification);

                const user = await User.findOne({'_id': userId});
                //send mail with options
                var mailOptions = {
                    to: ad.user.email, // list of receivers
                    subject: 'Recibiste un mensaje por "' + ad.title + '"', // Subject line
                    text: 'Hola!, recibiste un mensaje por tu aviso: "' + messageText + '"', // plain text body
                    template: 'ad_message',
                    context: {
                        userFrom: user,
                        userTo: ad.user,
                        ad: ad,
                        message: messageText
                    }
                };

                var info = await mailConfig.sendMail(mailOptions);
                res.status(200).json({
                    title: 'Se ha enviado el mensaje exitosamente',
                    info: info
                });
            } else {
                return res.status(500).json({
                    title: 'Ocurrió un error enviando el mensaje',
                    error: err
                });
            }
        } else {
            return res.status(500).json({
                title: 'Ocurrió un error enviando el mensaje',
                error: {message: 'No se encontró el anuncio'}
            });
        }

    } catch(err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error enviando el mensaje',
            error: err
        });
    }
};

/*
* Respuesta a un mensaje recibido desde un aviso
* */
exports.replyMessage = async (req, res, next) => {
    console.log(req.body);
    var adId = req.body.adId;
    var messageText = req.body.message;
    var token = req.headers.authorization;
    var decoded = jwt.decode(token);
    var userFromId = decoded.sub;
    console.log('userFromId', userFromId);
    var userToId = req.body.userTo;
    try {
        let message = await Message.findOne({'ad': adId, 'userFrom': userToId});
        if(message) {
            message.readedFrom = false;
            message.readedTo = true;
            message.chat.push({
                author: userFromId,
                messageDate: new Date(),
                text: messageText,
                readed: false,
            })
        } else {
            return res.status(500).json({
                title: 'Error. No se encontró la conversación',
                message: 'No se encontró la conversación'
            });
        }
        const savedMessage = await message.save();
        if(savedMessage) {
            const message = await Message.populate(savedMessage, {path: 'ad userFrom userTo chat.author'});
            await res.io.emit('new-reply', message);

            const notification = new Notification({
                user: message.userFrom._id,
                text: 'Respondieron a una de tus consultas',
                notificationDate: new Date(),
                link: '/backend/mis-mensajes/enviados',
                readed: false,
                code: '02'
            });
            const savedNotification = await notification.save();
            await res.io.emit('new-notification', savedNotification);

            const userFrom = message.userFrom;
            const userTo = message.userTo;
            const ad = message.ad;
            //send mail with options
            var mailOptions = {
                to: userFrom.email, // list of receivers
                subject: 'Recibiste un mensaje por "' + ad.title + '"', // Subject line
                text: 'Hola  Recibiste un mensaje: "' + messageText + '"', // plain text body
                template: 'ad_message',
                context: {
                    userFrom: userTo, // userTo = es el remitente porque está respondiendo el mensaje
                    userTo: userFrom,
                    ad: ad,
                    message: messageText
                }
            };
            var info = await mailConfig.sendMail(mailOptions);
            res.status(200).json(message);
        }
    } catch(err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error enviando el mensaje',
            error: err
        });
    }
};

/*
* Respuesta a un mensaje enviado
* */
exports.replyMessageSent = async (req, res, next) => {
    console.log(req.body);
    var adId = req.body.adId;
    var messageText = req.body.message;
    var token = req.headers.authorization;
    var decoded = jwt.decode(token);
    var userFromId = decoded.sub;
    console.log('userFromId', userFromId);
    var userToId = req.body.userTo;
    try {
        let message = await Message.findOne({'ad': adId, 'userFrom': userFromId, 'userTo': userToId});
        if(message) {
            message.readedTo = false;
            message.readedFrom = true;
            message.chat.push({
                author: userFromId,
                messageDate: new Date(),
                text: messageText,
                readed: false,
            })
        } else {
            return res.status(500).json({
                title: 'Error. No se encontró la conversación',
                message: 'No se encontró la conversación'
            });
        }
        const savedMessage = await message.save();
        if(savedMessage) {
            const message = await Message.populate(savedMessage, {path: 'ad userFrom userTo chat.author'});
            await res.io.emit('new-message', message);

            const notification = new Notification({
                user: message.userTo._id,
                text: 'Tienes mensajes nuevos por tus publicaciones',
                notificationDate: new Date(),
                link: '/backend/mis-mensajes/recibidos',
                readed: false,
                code: '01'
            });
            const savedNotification = await notification.save();
            await res.io.emit('new-notification', savedNotification);

            const userFrom = message.userFrom;
            const userTo = message.userTo;
            const ad = message.ad;
            //send mail with options
            var mailOptions = {
                to: userTo.email, // list of receivers
                subject: 'Recibiste un mensaje por "' + ad.title + '"', // Subject line
                text: 'Hola  Recibiste un mensaje: "' + messageText + '"', // plain text body
                template: 'ad_message',
                context: {
                    userFrom: userFrom,
                    userTo: userTo,
                    ad: ad,
                    message: messageText
                }
            };
            var info = await mailConfig.sendMail(mailOptions);
            res.status(200).json(message);
        }
    } catch(err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error enviando el mensaje',
            error: err
        });
    }
};

exports.listMessages = async (req, res, next) => {
    var token = req.headers.authorization;
    var decoded = jwt.decode(token);
    var userId = decoded.sub;

    try {
        console.log('BUSCAR USUARIO', userId);
        const ad = await Ad.findOne({user: userId, status: {$in: ['ACTIVE', 'PENDING']}});
        if(ad) {
            const messages = await Message.find({
                userTo: userId
            }).sort({ad: 1, userFrom: 1})
                .populate('ad', '_id title slug createdAt images mainImage user status')
                .populate('userFrom')
                .populate('chat.author')
                .exec();
            let resultMessages = [];
            let currentAd = '';
            let currentObject = {};
            console.log('messages', messages);
            if (messages.length > 0) {
                currentObject.users = [];
                for (var i = 0; i < messages.length; i++) {
                    let message = messages[i].toObject();
                    if (message.ad && String(message.ad._id) !== String(currentAd)) {
                        if (currentAd) {
                            resultMessages.push(currentObject);
                            currentObject = {
                                readed: true
                            };
                        }
                        currentAd = message.ad._id;
                        currentObject.ad = message.ad;
                        currentObject.users = [];
                    }
                    message.userFrom.messages = [];
                    message.userFrom.readedTo = message.readedTo;
                    message.userFrom.messages = message.chat;
                    if (!message.readedTo) {
                        currentObject.readed = false;
                    }
                    delete message.userFrom.password;
                    currentObject.users.push(message.userFrom);
                }
                resultMessages.push(currentObject);
            }
            res.status(200).json(resultMessages);
        }
    } catch(err) {
        console.log(err);
        return res.status(500).json({
            title: 'Error al obtener mensajes',
            error: err
        });
    }
};

exports.listSentMessages = async (req, res, next) => {
    var token = req.headers.authorization;
    var decoded = jwt.decode(token);
    var userId = decoded.sub;

    try {
        const messages = await Message.find({userFrom: userId}).sort({ad: 1, userTo: 1})
            .populate('ad', '_id title slug createdAt images mainImage user status')
            .populate('userTo')
            .populate('chat.author')
            .exec();
        let resultMessages = [];
        let currentAd = '';
        let currentObject = {};
        if (messages.length > 0) {
            currentObject.users = [];
            for (var i = 0; i < messages.length; i++) {
                let message = messages[i].toObject();
                if (message.ad && String(message.ad._id) !== String(currentAd)) {
                    if (currentAd) {
                        resultMessages.push(currentObject);
                        currentObject = {
                            readed: true
                        };
                    }
                    if(message.ad.status == 'ACTIVE' || message.ad.status == 'PENDING') {
                        currentAd = message.ad._id;
                        currentObject.ad = message.ad;
                        currentObject.users = [];
                    }
                }
                message.userTo.messages = [];
                message.userTo.readedFrom = message.readedFrom;
                message.userTo.messages = message.chat;
                if (!message.readedFrom) {
                    currentObject.readed = false;
                }
                delete message.userTo.password;
                currentObject.users.push(message.userTo);
            }
            resultMessages.push(currentObject);
        }
        res.status(200).json(resultMessages);
    } catch(err) {
        console.log(err);
        return res.status(500).json({
            title: 'Error al obtener mensajes',
            error: err
        });
    }
};

exports.markAsReaded = async (req, res, next) => {
    console.log(req.body);
    var userFromId = req.body.userFromId;
    var adId = req.body.adId;
    var token = req.headers.authorization;
    var decoded = jwt.decode(token);
    var userId = decoded.sub;
    try {
        let message = await Message.findOne({'userFrom': userFromId, 'userTo': userId, 'ad': adId});

            if(message) {
                message.readedTo = true;
                const savedMessage = await message.save();
                res.status(200).json(savedMessage);
            } else {
                return res.status(500).json({
                    title: 'Mensaje no encontrado',
                    error: {message: 'No se encontró el mensaje para actualizar'}
                });
            }
    } catch(err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error enviando el mensaje',
            error: err
        });
    }
};

exports.markAsReadedSent = async (req, res, next) => {
    console.log(req.body);
    var userToId = req.body.userToId;
    var adId = req.body.adId;
    var token = req.headers.authorization;
    var decoded = jwt.decode(token);
    var userId = decoded.sub;
    try {
        let message = await Message.findOne({'userFrom': userId, 'userTo': userToId, 'ad': adId});

        if(message) {
            message.readedFrom = true;
            const savedMessage = await message.save();
            res.status(200).json(savedMessage);
        } else {
            return res.status(500).json({
                title: 'Mensaje no encontrado',
                error: {message: 'No se encontró el mensaje para actualizar'}
            });
        }
    } catch(err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error enviando el mensaje',
            error: err
        });
    }
};

exports.deleteMessage = function (req, res, next) {
    Message.findById(req.params.id, function (err, message) {
        if (err) {
            return res.status(500).json({
                title: 'Ocurrió un error recuperando el mensaje',
                error: err
            });
        }
        if (!category) {
            return res.status(500).json({
                title: 'Mensaje no encontrado',
                error: {
                    message: 'No se ha encontrado el mensaje'
                }
            });
        }
        message.remove(function (err, result) {
            if (err) {
                return res.status(500).json({
                    title: 'Ocurrió un error eliminando el mensaje',
                    error: err
                });
            }
            res.status(200).json(result);

        });
    });
};


   
