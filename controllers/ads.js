const Ad = require('../models/ad');
const AdReport = require('../models/adReport');
const Message = require('../models/message');
const Category = require('../models/category');
const City = require('../models/city');
const hbs = require('nodemailer-express-handlebars');
const mailConfig = require('../config/mailconfig');
const handlebars = require('express-handlebars');
const path = require('path');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const fs = require('fs');
const AWS = require('aws-sdk');
const bucketName = "anunciatesalta-images";
const pathCdn = process.env.PATH_CDN || 'https://d24ybofanksy1z.cloudfront.net';
const Handlebars = require('hbs');
var importedAds = require('../data/anuncios.json');
var request = require('request');
var randtoken = require('rand-token');
const breaklines = require('../utils/breaklines');
const moment = require('moment');
const authConfig = require('../config/auth');
const generator = require('generate-password');
var Twitter = require('twitter');
var snippets = require('smart-text-snippet');
const config = require('../config/config');

AWS.config.region = 'sa-east-1';
AWS.config.credentials = new AWS.Credentials(process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET);
//accessKeyId y secret se configura mediante ENV


process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function put_from_url(url, filename) {
    request({
        url: url,
        encoding: null
    }, function (err, res, body) {
        if (err)
            return callback(err, res);
        console.log('body', body);
        /*return s3
            .upload({
                Bucket: bucketName,
                Key: 'ads/'+filename,
                ACL: 'public-read',
                ContentType: res.headers['content-type'],
                ContentLength: res.headers['content-length'],
                Body: body // buffer
            })
            .promise();*/
    })
};

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
            Key: 'ads/' + filename,
            ACL: 'public-read',
            Body: fileStream,
            ContentType: file.type
        })
        .promise();
}

async function s3UploadStream(stream, res, filename) {
    const s3 = new AWS.S3({
        params: {
            Bucket: bucketName
        }
    });

    return s3
        .upload({
            Bucket: bucketName,
            Key: 'ads/' + filename,
            ACL: 'public-read',
            Body: stream,
            ContentType: res.headers['content-type'],
            ContentLength: res.headers['content-length'],
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
            Key: 'ads/' + filename
        })
        .promise();
}

exports.reportAd = async (req, res, next) => {
    console.log(req.body);
    var adId = req.body.adId;
    var message = req.body.message;
    var email = req.body.email;
    var reason = req.body.reason;

    try {
        let report = new AdReport({
            ad: adId,
            email: email,
            reason: reason,
            message: message
        });
        const savedReport = await report.save();
        if (savedReport) {
            const ad = await Ad.findOne({'_id': adId}).populate('user');
            var mailOptions = {
                to: 'soporte@compraventasalta.com.ar', // list of receivers
                subject: 'Nuevo reporte: "' + ad.title + '"', // Subject line
                text: 'Un usuario reportó el anuncio con título: "' + ad.title + '"', // plain text body
                template: 'ad_report',
                context: {
                    ad: ad,
                    report: savedReport
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
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error enviando el mensaje',
            error: err
        });
    }
};

exports.sendMessage = async (req, res, next) => {
    console.log(req.body);
    var adId = req.body.adId;
    var messageText = req.body.message;
    var token = req.headers.authorization;
    console.log('token', token);
    var decoded = jwt.decode(token);
    var userId = decoded.sub;
    try {
        let message = await Message.findOne({'user': userId, 'ad': adId});
        if (message) {
            message.chat.push({
                author: userId,
                messageDate: new Date(),
                text: messageText,
                readed: false,
            })
        } else {
            message = new Message({
                ad: adId,
                user: userId,
                chat: [{
                    author: userId,
                    messageDate: new Date(),
                    text: messageText,
                    readed: false,
                }]
            })
        }
        const savedMessage = await message.save();
        if (savedMessage) {
            const ad = await Ad.findOne({'_id': adId}).populate('user');
            const user = await User.findOne({'_id': userId});

            //send mail with options
            var mailOptions = {
                from: mailConfig.from, // sender address
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
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error enviando el mensaje',
            error: err
        });
    }
};


exports.replyMessage = async (req, res, next) => {
    console.log(req.body);
    var messageId = req.body.messageId;
    var messageText = req.body.message;
    var token = req.headers.authorization;
    var decoded = jwt.decode(token);
    var userFromId = decoded.sub;
    var userToId = req.body.userTo;
    try {
        let message = await Message.findOne({'_id': messageId}).populate('ad');
        if (message) {
            subject = '';
            message.chat.push({
                author: userFromId,
                messageDate: new Date(),
                text: messageText,
                readed: false,
            })
        } else {
            return res.status(500).json({
                title: 'Error. No se encontró la conversación',
                error: err
            });
        }
        const savedMessage = await message.save();
        if (savedMessage) {
            const userFrom = await User.findOne({'_id': userFromId});
            const userTo = await User.findOne({'_id': userToId});

            //send mail with options
            var mailOptions = {
                from: mailConfig.from, // sender address
                to: userTo.email, // list of receivers
                subject: 'Recibiste un mensaje por "' + ad.title + '"', // Subject line
                text: 'Hola  Recibiste un mensaje: "' + messageText + '"', // plain text body
                template: 'ad_message',
                context: {
                    userFrom: userFrom,
                    userTo: userTo,
                    ad: message.ad,
                    message: messageText
                },
            };

            var info = await mailConfig.sendMail(mailOptions);
            res.status(200).json({
                title: 'Se ha enviado el mensaje exitosamente',
                info: info
            });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error enviando el mensaje',
            error: err
        });
    }
};

exports.createAd = async (req, res, next) => {
    console.log('BODY');
    console.log(req.body);
    console.log('FILES');
    console.log(req.files);
    console.log('CREATE AD', process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET)
    var images = [];
    var principal = null;
    if (req.files && req.files.image) {

        for (var i = 0; i < req.files.image.length; i++) {
            const image = req.files.image[i];
            try {
                const filename = image.path.replace(/^.*[\\\/]/, '');
                const uploadedImage = await s3Upload(image, filename);
                console.log(uploadedImage);
                if (req.body.principal[i] === 'true') {
                    var img = {
                        originalFilename: image.originalFilename,
                        mimeType: image.type,
                        size: image.size,
                        filename: filename,
                        path: uploadedImage.Location,
                        pathCdn: pathCdn + '/' + uploadedImage.key,
                        relativePath: uploadedImage.key,
                    };
                    images.unshift(img);
                    principal = img;
                } else {
                    images.push({
                        originalFilename: image.originalFilename,
                        mimeType: image.type,
                        size: image.size,
                        filename: filename,
                        path: uploadedImage.Location,
                        pathCdn: pathCdn + '/' + uploadedImage.key,
                        relativePath: uploadedImage.key,
                    });
                }
                fs.unlinkSync(image.path);
                console.log(images);
            } catch (err) {
                console.error(err);
                return res.status(500).json({
                    title: 'Ocurrió un error guardando las imagenes del anuncio',
                    error: err
                });
            }
        }
    }
    console.log('Array de imagenes:', images);
    var now = new Date();
    try {
        var token = req.headers.authorization;
        var decoded = jwt.decode(token);
        var userId = decoded.sub;
        const user = await User.findOne({'_id': userId});
        if (user) {
            var ad = new Ad({
                title: req.body.title,
                content: req.body.content,
                price: req.body.price,
                priceType: req.body.priceType,
                currency: req.body.currency,
                // phone: req.body.phone,
                // address: req.body.address,
                categoryId: req.body.category,
                category: req.body.category,
                subcategory: req.body.subcategory,
                user: req.body.user,
                city: user.city,
                cityId: user.city,
                images: images,
                mainImage: principal,
                createdAt: now,
                updatedAt: now,
                republishedDate: now,
                status: 'PENDING'
            });

            const adCreated = await ad.save();
            // Si la cuenta no está verificada, mail de activacion
            // Si la cuenta esta verificada, mail de confirmacion

            //send mail with options
            const newAd = await Ad.populate(adCreated, {path: 'user category subcategory city'});
            const url_base = 'https://api.compraventasalta.com.ar';
            var mailOptions = {
                to: 'soporte@compraventasalta.com.ar', // list of receivers
                subject: 'Nuevo anuncio creado!: "' + newAd.title + '"', // Subject line
                text: 'El usuario ' + newAd.user.email + ' creó el anuncio con título: "' + newAd.title + '"', // plain text body
                template: 'ad_moderate',
                context: {
                    ad: newAd,
                    urlAccept: url_base + '/ads/accept/' + newAd._id,
                    urlReject: url_base + '/ads/reject/' + newAd._id,
                    urlDelete: url_base + '/ads/' + newAd._id + '/deleteAdmin/27571910/',
                    path_cdn: pathCdn + '/resized/240x200',
                    path_images_large: pathCdn + '/resized/600x450'
                }
            };

            var info = await mailConfig.sendMail(mailOptions);
            //console.log('Email sent: ' + info.response);
            res.status(201).json({
                ad: 'Se ha creado el anuncio exitosamente',
                obj: adCreated
            });
        } else {
            return res.status(500).json({
                title: 'Usuario no encontrado',
                error: err
            });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error guardando el anuncio',
            error: err
        });
    }
};

exports.getAd = function (req, res, next) {
    const id = req.params.id;
    const ad_slug = req.params.slug;
    let query = {};
    if (ad_slug) {
        query = {
            slug: ad_slug
        }
    }
    if (id) {
        const token = req.headers.authorization;
        const decoded = jwt.decode(token);
        var userId = decoded.sub;
        query = {
            '_id': id
        }
    }
    Ad.findOne(query)
        .populate('user')
        .populate('category')
        .populate('subcategory')
        .populate('city')
        .exec(function (err, ad) {
            if (err) {
                return res.status(500).json({
                    title: 'Error al obtener anuncios',
                    error: err
                });
            }
            if (ad.user._id != userId) {
                return res.status(500).json({
                    title: 'Error al obtener el anuncio',
                    message: 'El anuncio no te pertenece!'
                });
            }
            res.status(200).json(ad)
        });
};

exports.getAdBySlug = async (req, res, next) => {
    const url = req.query.url;
    console.log('URL', url);
    const id = req.params.id;
    const ad_slug = req.params.slug;
    let query = {};
    if (ad_slug) {
        query = {
            slug: ad_slug,
            status: {$in: ['ACTIVE', 'PENDING', 'FINISHED']}
        }
    }
    if (id) {
        const token = req.headers.authorization;
        const decoded = jwt.decode(token);
        var userId = decoded.sub;
        query = {
            '_id': id
        }
    }
    try {
        const ad = await Ad.findOne(query)
            .populate('user')
            .populate('category')
            .populate('subcategory')
            .populate('city')
            .exec();
        res.status(200).json(ad)
    } catch (err) {
        return res.status(500).json({
            title: 'Error al obtener anuncios',
            error: err
        });
    }
};


exports.getRelatedAds = async (req, res, next) => {
    const id = req.params.id;
    const size = req.query.size || 4;
    const from = req.query.from || 0;
    try {
        const ad = await Ad.findOne({_id: id})
            .populate('user')
            .populate('category')
            .populate('subcategory')
            .populate('city')
            .exec();
        if (ad) {
            const query = {};
            query.bool = {};
            query.bool.must = {};
            query.bool.must.more_like_this = {
                fields: ['title', 'content'],
                like: [{
                    _id: ad._id
                }],
                min_term_freq : 2,
                min_doc_freq:2
            };
            query.bool.must_not = [
                {"match": {"status": 'EXPIRED'}},
                {"match": {"status": 'HIDDEN'}},
                {"match": {"status": 'DELETED'}},
                {"match": {"status": 'REJECTED'}}
            ];
            query.bool.filter = [{term: {categoryId: ad.category._id}}];

            Ad.search(query, {
                from: from,
                size: size,
                sort: 'republishedDate:desc',
                aggs: {
                    'category_counts': {
                        'terms': {
                            'field': 'categoryId',
                        },
                    },
                    'city_counts': {
                        'terms': {
                            'field': 'cityId',
                        }
                    }
                }
            }, function(err, ads) {
                if(err) {
                    console.log(err);
                    return res.status(500).json({
                        title: 'Error al obtener anuncios',
                        error: err
                    });
                }
                res.status(200).json(ads)
            });
        }

    } catch (err) {
        console.log(err);
        return res.status(500).json({
            title: 'Error al obtener anuncios',
            error: err
        });
    }
};

exports.listMyAds = async (req, res, next) => {
    var category = req.query.category;
    var subcategory = req.query.subcategory;
    var city = req.query.city;
    var priceFrom = req.query.priceFrom;
    var priceTo = req.query.priceTo;
    const token = req.headers.authorization;
    const decoded = jwt.decode(token);
    var userId = decoded.sub;
    var query = {
        user: userId,
    };
    if (subcategory) {
        query.subcategory = subcategory;
    } else if (category) {
        query.category = category;
    }
    if (city) {
        query.city = city;
    }
    if (priceFrom && priceTo) {
        query.price = {$gte: priceFrom, $lte: priceTo};
    } else {
        if (priceFrom) {
            query.price = {$gte: priceFrom};
        }
        if (priceTo) {
            query.price = {$lte: priceTo};
        }
    }

    Ad.find(query)
        .sort({
            createdAt: -1,
            verifiedDate: -1,
            republishedDate: -1
        })
        .populate('category', 'name slug')
        .populate('subcategory', 'name slug')
        .populate('city', 'name slug')
        .exec(function (err, ads) {
            if (err) {
                return res.status(500).json({
                    title: 'Error al obtener anuncios',
                    error: err
                });
            }
            res.status(200).json(ads)
        });
};

exports.adsByUser = async (req, res, next) => {
    var category = req.query.category;
    var subcategory = req.query.subcategory;
    var city = req.query.city;
    var priceFrom = req.query.priceFrom;
    var priceTo = req.query.priceTo;
    var adId = req.params.id;
    try {
        const ad = await Ad.findOne({_id: adId}).exec();
        if (ad) {
            var query = {
                user: ad.user,
                enabled: true,
                status: {
                    $in: ["ACTIVE", "PENDING", "FINISHED"]
                },
                _id: {$ne: adId}
            };
            if (subcategory) {
                query.subcategory = subcategory;
            } else if (category) {
                query.category = category;
            }
            if (city) {
                query.city = city;
            }
            if (priceFrom && priceTo) {
                query.price = {$gte: priceFrom, $lte: priceTo};
            } else {
                if (priceFrom) {
                    query.price = {$gte: priceFrom};
                }
                if (priceTo) {
                    query.price = {$lte: priceTo};
                }
            }

            const ads = await Ad.find(query)
                .sort({
                    republishedDate: -1
                })
                .populate('category', 'name slug')
                .populate('subcategory', 'name slug')
                .populate('city', 'name slug')
                .exec();
            res.status(200).json(ads)
        } else {
            res.status(200).json({})
        }
    } catch(err) {
        return res.status(500).json({
            title: 'Error al obtener anuncios del usuario',
            error: err
        });
    }
};

exports.listAds = async (req, res, next) => {
    var category = req.query.category;
    var subcategory = req.query.subcategory;
    var city = req.query.city;
    var priceFrom = req.query.priceFrom;
    var priceTo = req.query.priceTo;

    var query = {
        enabled: true,
        status: {
            $in: ["ACTIVE", "PENDING"]
        }
    };
    if (subcategory) {
        query.subcategory = subcategory;
    } else if (category) {
        query.category = category;
    }
    if (city) {
        query.city = city;
    }
    if (priceFrom && priceTo) {
        query.price = {$gte: priceFrom, $lte: priceTo};
    } else {
        if (priceFrom) {
            query.price = {$gte: priceFrom};
        }
        if (priceTo) {
            query.price = {$lte: priceTo};
        }
    }
    console.log(query);
    Ad.find(query)
        .sort({
            createdAt: -1,
            verifiedDate: -1,
            republishedDate: -1
        })
        .populate('category', 'name slug')
        .populate('subcategory', 'name slug')
        .populate('city', 'name slug')
        .exec(function (err, ads) {
            if (err) {
                return res.status(500).json({
                    title: 'Error al obtener anuncios',
                    error: err
                });
            }
            res.status(200).json(ads)
        });
};

exports.listLatestAds = async (req, res, next) => {
    /*var category = req.query.category;
    var subcategory = req.query.subcategory;
    var city = req.query.city;
    var priceFrom = req.query.priceFrom;
    var priceTo = req.query.priceTo;*/
    console.log('ENtra a latest');
    var query = {
        enabled: true,
        status: {
            $in: ["ACTIVE", "PENDING"]
        }
    };
    /*if (subcategory) {
        query.subcategory = subcategory;
    } else if (category) {
        query.category = category;
    }
    if (city) {
        query.city = city;
    }
    if (priceFrom && priceTo) {
        query.price = {$gte: priceFrom, $lte: priceTo};
    }
    else {
        if (priceFrom) {
            query.price = {$gte: priceFrom};
        }
        if (priceTo) {
            query.price = {$lte: priceTo};
        }
    }
    console.log(query); */
    Ad.find(query)
        .sort({
            republishedDate: -1,
            createdAt: -1,
            verifiedDate: -1
        })
        .limit(12)
        .populate('category', 'name slug')
        .populate('subcategory', 'name slug')
        .populate('city', 'name slug')
        .exec(function (err, ads) {
            if (err) {
                return res.status(500).json({
                    title: 'Error al obtener anuncios',
                    error: err
                });
            }
            res.status(200).json(ads)
        });
};

exports.listAdsPager = async (req, res, next) => {
    var category = req.query.category;
    var subcategory = req.query.subcategory;
    var city = req.query.city;
    var priceFrom = req.query.priceFrom;
    var priceTo = req.query.priceTo;
    var page = req.query.page;
    var size = req.query.size ? Number(req.query.size) : 2;
    var sortBy = req.query.sortBy;
    if (!page) {
        page = 1;
    }
    if (!sortBy) {
        sortBy = 'recientes';
    }
    sort = {};
    if (sortBy == 'recientes') {
        sort = {
            republishedDate: -1,
            createdAt: -1,
            verifiedDate: -1,
        }
    } else if (sortBy == 'menorPrecio') {
        sort = {
            currency: 1,
            price: 1,
            republishedDate: -1,
            createdAt: -1,
        }
    } else if (sortBy == 'mayorPrecio') {
        sort = {
            currency: 1,
            price: -1,
            republishedDate: -1,
            createdAt: -1,
        }
    }
    var query = {
        enabled: true,
        status: {
            $in: ["ACTIVE", "PENDING", "FINISHED"]
        }
    };
    if (subcategory) {
        query.subcategory = subcategory;
    } else if (category) {
        query.category = category;
    }
    if (city) {
        query.city = city;
    }
    if (priceFrom && priceTo) {
        query.price = {$gte: priceFrom, $lte: priceTo};
    } else {
        if (priceFrom) {
            query.price = {$gte: priceFrom};
        }
        if (priceTo) {
            query.price = {$lte: priceTo};
        }
    }
    console.log(query);
    Ad.paginate(query, {
        page: page,
        limit: size,
        lean: true,
        sort: sort,
        populate: [
            'category', 'subcategory', 'city'
        ]
    }, function (err, result) {
        console.log(result);
        if (err) {
            return res.status(500).json({
                title: 'Error al obtener anuncios',
                error: err
            });
        }
        // result.docs
        // result.total
        // result.limit - 10
        // result.page - 3
        // result.pages
        res.status(200).json(result)
    });
};

exports.changeAdStatus = async (req, res, next) => {
    try {
        var token = req.headers.authorization;
        var decoded = jwt.decode(token);
        var userId = decoded.sub;
        var ad = await Ad.findOne({'_id': req.params.id, 'user': userId});
        if (!ad) {
            return res.status(500).json({
                title: 'No se encontró el Aviso!',
                error: {message: 'Aviso no encontrado'}
            });
        } else {
            var status = req.body.status;
            if (status == 'SHOW') {
                if (ad.verified) {
                    ad.status = 'ACTIVE'
                } else {
                    ad.status = 'PENDING'
                }
            } else if (status == 'FINISHED') {
                ad.status = 'FINISHED';
                ad.finished = true;
                ad.finishedDate = new Date();
            } else if (status == 'REPUBLISHED') {
                if (ad.verified) {
                    ad.status = 'ACTIVE'
                } else {
                    ad.status = 'PENDING'
                }
                ad.republishedDate = new Date();
            } else {
                ad.status = status
            }
            const updatedAd = await ad.save();

            if (status == 'REPUBLISHED' && ad.status == 'ACTIVE') {
                var suffix = ' - ' + 'https://www.compraventasalta.com.ar/anuncio/' + ad.slug + ' (contactar haciendo clic)';
                var len = 134 - 49; // 49 es enlace acortado por twitter + lo del parentesis
                var title = snippets.snip(ad.title, {len: len});
                var status = title + suffix;
                //ENVIO TWEET
                var client = new Twitter({
                    consumer_key: process.env.TWITTER_CONSUMER_KEY,
                    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
                    access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
                    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
                });
                client.post('statuses/update', {status: status}, function (error, tweet, response) {
                    if (error) throw error;
                    //console.log(tweet);  // Tweet body.
                    console.log('TWEET OK!!!');
                });
            }

            const newAd = await Ad.populate(updatedAd, {path: 'user category subcategory city'});
            res.status(200).json(newAd);
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error ocultando el anuncio',
            error: err
        });
    }
};

exports.updateAd = async (req, res, next) => {
    var images = [];
    var principal;
    if (req.files && req.files.image) {
        for (var i = 0; i < req.files.image.length; i++) {
            const image = req.files.image[i];
            try {
                const filename = image.path.replace(/^.*[\\\/]/, '');
                const uploadedImage = await s3Upload(image, filename);
                console.log(uploadedImage);
                if (req.body.principal[i] === 'true') {
                    const img = {
                        originalFilename: image.originalFilename,
                        mimeType: image.type,
                        size: image.size,
                        filename: filename,
                        path: uploadedImage.Location,
                        pathCdn: pathCdn + '/' + uploadedImage.key,
                        relativePath: uploadedImage.key,
                    };
                    images.unshift(
                        img
                    );
                    principal = img;
                } else {
                    images.push({
                        originalFilename: image.originalFilename,
                        mimeType: image.type,
                        size: image.size,
                        filename: filename,
                        path: uploadedImage.Location,
                        pathCdn: pathCdn + '/' + uploadedImage.key,
                        relativePath: uploadedImage.key
                    });
                }
                fs.unlinkSync(image.path);
                console.log(images);
            } catch (err) {
                console.error(err);
                return res.status(500).json({
                    title: 'Ocurrió un error guardando las imagenes del anuncio',
                    error: err
                });
            }
        }
    }
    var removedImages = req.body.removedImages;
    var adImages = req.body.adImages;
    var adImagesArray = [];
    //Convierto a JSON cada objeto de imagen existente del anuncio
    if (adImages) {
        for (var i = 0; i < adImages.length; i++) {
            adImagesArray.push(JSON.parse(adImages[i]));
        }
    }
    console.log('removedImages', removedImages);
    console.log('adImages', adImages);
    console.log('Array de imagenes:', images);
    try {
        var ad = await Ad.findById(req.params.id);
        if (!ad) {
            return res.status(500).json({
                title: 'No se encontró el Aviso!',
                error: {message: 'Aviso no encontrado'}
            });
        } else {
            var token = req.headers.authorization;
            var decoded = jwt.decode(token);
            var userId = decoded.sub;
            const user = await User.findOne({'_id': userId});
            if (user) {
                ad.title = req.body.title;
                ad.content = req.body.content;
                ad.price = req.body.price;
                ad.priceType = req.body.priceType;
                ad.currency = req.body.currency;
                ad.category = req.body.category;
                ad.subcategory = req.body.subcategory;
                ad.user = req.body.user;
                ad.city = user.city;
                ad.cityId = user.city;
                ad.images = adImagesArray.concat(images);
                ad.updatedAt = new Date();
                ad.status = 'PENDING';
                ad.verifiedDate = null;
                ad.verified = false;
            }

            //Eliminar las imagenes removidas
            if (removedImages) {
                for (var i = 0; i < removedImages.length; i++) {
                    var remImg = JSON.parse(removedImages[i]);
                    for (var j = 0; j < ad.images.length; j++) {
                        if (ad.images[j]._id == remImg._id) {
                            console.log('REMOVER ', ad.images[j]);
                            ad.images.splice(j, 1);
                            const deletedImage = await s3Delete(remImg.path);
                            break;
                        }
                    }
                }
            }
            if (principal) {
                ad.mainImage = principal;
            }
            if (ad.images.length === 0) {
                ad.mainImage = null;
            }
            const updatedAd = await ad.save();
            const url_base = 'https://api.compraventasalta.com.ar';
            const newAd = await Ad.populate(updatedAd, {path: 'user category subcategory city'});
            var mailOptions = {
                to: 'soporte@compraventasalta.com.ar', // list of receivers
                subject: 'Anuncio actualizado!: "' + newAd.title + '"', // Subject line
                text: 'El usuario ' + newAd.user.email + ' actualizó el anuncio con título: "' + newAd.title + '"', // plain text body
                template: 'ad_moderate',
                context: {
                    ad: newAd,
                    urlAccept: url_base + '/ads/accept/' + newAd._id + '?updated=true',
                    urlReject: url_base + '/ads/reject/' + newAd._id,
                    path_cdn: pathCdn + '/resized/240x200',
                    path_images_large: pathCdn + '/resized/600x450'
                }
            };

            var info = await mailConfig.sendMail(mailOptions);
            //console.log('Email sent: ' + info.response);

            res.status(200).json({
                ad: 'Se ha actualizado el anuncio exitosamente',
                obj: updatedAd
            });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error guardando el anuncio',
            error: err
        });
    }
};

exports.deleteAd = async (req, res, next) => {
    try {
        const ad = await Ad.findById(req.params.id);

        if (!ad) {
            return res.status(500).json({
                title: 'Anuncio no encontrado',
                error: {
                    message: 'No se ha encontrado el anuncio'
                }
            });
        }

        const images = ad.images;
        const adId = ad._id;
        const removedAd = await ad.remove();
        const removedMessages = await Message.remove({ad: adId});
        //console.log('images', images);
        for (let i = 0; i < images.length; i++) {
            const deletedImage = await s3Delete(images[i].path);
        }

        res.status(200).json({'message': 'Anuncio eliminado!!!'});

    } catch (err) {
        console.log('Error', err);
        return res.status(500).json({
            title: 'Ocurrió un error eliminando el anuncio',
            error: err
        });
    }
};

exports.uploadImages = function (req, res) {
    // var adId = req.params.id;
    var file_name = 'No subido...';
    console.log(req.files);
    if (req.files) {
        for (var i = 0; i < req.files.images.length; i++) {
            console.log(req.files.images[i]);
        }
    }
    res.send(req.files);
};

exports.syncAds = function (req, res, next) {
    Ad.esSynchronize()
        .then(function () {
            console.log('Sincronizado!');
        });
};

exports.searchAds = function (req, res, next) {
    // https://www.npmjs.com/package/mongoose-elasticsearch-xp
    const term = req.query.q;
    const category = req.query.category;
    const city = req.query.city;
    const priceFrom = req.query.priceFrom;
    const priceTo = req.query.priceTo;
    const from = req.query.from ? req.query.from : 0;
    const size = req.query.size ? Number(req.query.size) : 2;
    var sortBy = req.query.sortBy;
    if (!sortBy) {
        sortBy = 'recientes';
    }
    sort = {};
    if (sortBy == 'recientes') {
        sort = 'republishedDate:desc'
    } else if (sortBy == 'menorPrecio') {
        sort = ['currency:asc', 'price:asc', 'republishedDate:desc']
    } else if (sortBy == 'mayorPrecio') {
        sort = ['currency:asc', 'price:desc', 'republishedDate:desc']
    }
    var query = {};
    query.bool = {};
    query.bool.must = {};
    query.bool.must.multi_match = {
        fields: ['title', 'content'],
        query: term
    };
    query.bool.must_not = [
        {"match": {"status": 'EXPIRED'}},
        {"match": {"status": 'HIDDEN'}},
        {"match": {"status": 'DELETED'}},
        {"match": {"status": 'REJECTED'}}
    ];
    query.bool.filter = [];
    var query_string = query;
    filters = [];
    if (category || city || priceFrom || priceTo) {
        if (category) {
            query.bool.filter.push({term: {'categoryId': category}});
        }
        if (city) {
            query.bool.filter.push({term: {'cityId': city}});
        }
        if (priceFrom && priceTo) {
            query.bool.filter.push({range: {'price': {gte: priceFrom, lte: priceTo}}});
        } else if (priceFrom) {
            query.bool.filter.push({range: {'price': {gte: priceFrom}}});
        } else if (priceTo) {
            query.bool.filter.push({range: {'price': {lte: priceTo}}});
        }

    } else {
        query = query_string
    }
    console.log(query);
    Ad.search(query, {
        from: from,
        size: size,
        sort: sort,
        aggs: {
            'category_counts': {
                'terms': {
                    'field': 'categoryId',
                },
            },
            'city_counts': {
                'terms': {
                    'field': 'cityId',
                }
            }
        }
    }, function (err, ads) {
        if (err) {
            console.log('ERROR', err);
            return res.status(500).json(err);
        }
        console.log('RESULTADO', ads);
        res.status(200).json(ads);
    });

    /*Ad.esSearch(
            {
                "query" : {
                    "bool": {
                        "should": [
                            { "match": { "title": term } },
                            { "match": { "content": term } }
                        ]
                    }
                },
                sort: [{'createdAt': {'order': 'desc'}}],
                "aggs": {
                    "group_by_category": {
                        "terms": {
                            "field": "category"
                        }
                    }
                }

            },
            {
                hydrate: {
                    //docsOnly: true,
                    populate: [
                        {
                            path: 'city'
                        },
                        {
                            path: 'category'
                        },
                        {
                            path: 'subcategory'
                        }
                    ]
                }}
        ).then(function (results) {
            console.log(results);
            res.status(200).json(results);
        }).catch(function(err) {
            console.log(err);
            res.status(500).json(err);
        });*/
};

breakLines = function (text) {
    text = Handlebars.Utils.escapeExpression(text);
    text = text.replace(/(\r\n|\n|\r)/gm, '<br>');
    return new Handlebars.SafeString(text);
};


exports.importAds = async (req, res, next) => {

    /*
    * SELECT a.titulo, a.descripcion, a.imagen_principal, a.imagenes, a.precio, a.moneda_id, u.first_name, u.last_name, u.username, u.email_address, c.nombre as categoria_base, ca.nombre as categoria, ub.nombre as ubicacion_base, ub1.nombre as ubicacion
FROM anuncios a
LEFT JOIN sf_guard_user u ON (a.user_id = u.id)
LEFT JOIN categorias c ON (a.categoria_base_id = c.id)
LEFT JOIN categorias ca ON (a.categoria_id = ca.id)
LEFT JOIN ubicaciones ub ON (a.ubicacion_base_id = ub.id)
LEFT JOIN ubicaciones ub1 ON (a.ubicacion_id = ub1.id)
WHERE a.habilitado = 1
AND a.activado = 1
AND u.is_active = 1
AND a.fecha_republicacion >= '2017-01-01'
    *
    * */
    try {
        //adsRemoved = await Ad.remove({imported: true});
        const s3 = new AWS.S3({
            params: {
                Bucket: bucketName
            }
        });
        for (var i = 0; i < importedAds.length; i++) {
            var category;
            var subcategory;
            var a = importedAds[i];
            switch (a.categoria_base) {
                case 'Vehículos': {
                    switch (a.categoria) {
                        case 'Accesorios autos': {
                            category = await Category.findOne({name: 'Vehículos'});
                            subcategory = await Category.findOne({name: 'Accesorios para Autos'});
                            break;
                        }
                        case 'Autos Nuevos y Usados': {
                            category = await Category.findOne({name: 'Vehículos'});
                            subcategory = await Category.findOne({name: 'Autos'});
                            break;
                        }
                        case 'Barcos': {
                            category = await Category.findOne({name: 'Vehículos'});
                            subcategory = await Category.findOne({name: 'Barcos'});
                            break;
                        }
                        case 'Camionetas - Camiones - Vehículos Comerciales': {
                            category = await Category.findOne({name: 'Vehículos'});
                            subcategory = await Category.findOne({name: 'Camionetas - Camiones - Vehículos Comerciales'});
                            break;
                        }
                    }
                    break;
                }
                case 'Compra / Venta': {
                    switch (a.categoria) {
                        case 'Animales': {
                            category = await Category.findOne({name: 'Animales y Mascotas'});
                            subcategory = await Category.findOne({name: 'Otros Animales'});
                            break;
                        }
                        case 'Artículos Deportivos - Bicicletas': {
                            category = await Category.findOne({name: 'Deportes y Bicicletas'});
                            subcategory = await Category.findOne({name: 'Otros Deportes'});
                            break;
                        }
                        case 'Celulares - Teléfonos': {
                            category = await Category.findOne({name: 'Teléfonos - Tablets'});
                            subcategory = await Category.findOne({name: 'Celulares - Teléfonos'});
                            break;
                        }
                        case 'Colecciones - Antigüedades': {
                            category = await Category.findOne({name: 'Hobbies, Música, Arte y Libros'});
                            subcategory = await Category.findOne({name: 'Arte - Antigüedades'});
                            break;
                        }
                        case 'Computadoras - Informática': {
                            category = await Category.findOne({name: 'Electrónica'});
                            subcategory = await Category.findOne({name: 'Computadoras - Notebooks'});
                            break;
                        }
                        case 'Electrónica': {
                            category = await Category.findOne({name: 'Electrónica'});
                            subcategory = await Category.findOne({name: 'TV - Audio - Video'});
                            break;
                        }
                        case 'Fotografía - Imagen - Sonido': {
                            category = await Category.findOne({name: 'Electrónica'});
                            subcategory = await Category.findOne({name: 'Cámaras y accesorios'});
                            break;
                        }
                        case 'Hogar - Jardín - Muebles': {
                            category = await Category.findOne({name: 'Hogar - Muebles - Jardín'});
                            subcategory = await Category.findOne({name: 'Muebles'});
                            break;
                        }
                        case 'Instrumentos Musicales': {
                            category = await Category.findOne({name: 'Hobbies, Música, Arte y Libros'});
                            subcategory = await Category.findOne({name: 'Instrumentos Musicales'});
                            break;
                        }
                        case 'Joyas - Relojes': {
                            category = await Category.findOne({name: 'Moda y Belleza'});
                            subcategory = await Category.findOne({name: 'Relojes - Joyas - Accesorios'});
                            break;
                        }
                        case 'Juguetes - Juegos': {
                            category = await Category.findOne({name: 'Bebés y Niños'});
                            subcategory = await Category.findOne({name: 'Juegos y Juguetes'});
                            break;
                        }
                        case 'Libros - Revistas': {
                            category = await Category.findOne({name: 'Hobbies, Música, Arte y Libros'});
                            subcategory = await Category.findOne({name: 'Libros y Revistas'});
                            break;
                        }
                        case 'Negocios - Insumos': {
                            category = await Category.findOne({name: 'Herramientas, Industria y Oficina'});
                            subcategory = await Category.findOne({name: 'Insumos'});
                            break;
                        }
                        case 'Otras Ventas': {
                            category = await Category.findOne({name: 'Herramientas, Industria y Oficina'});
                            subcategory = await Category.findOne({name: 'Insumos'});
                            break;
                        }
                        case 'Ropa - Accesorios': {
                            category = await Category.findOne({name: 'Moda y Belleza'});
                            subcategory = await Category.findOne({name: 'Ropa y Calzado'});
                            break;
                        }
                        case 'Salud y Belleza': {
                            category = await Category.findOne({name: 'Moda y Belleza'});
                            subcategory = await Category.findOne({name: 'Salud y Belleza'});
                            break;
                        }
                    }
                    break;
                }
                case 'Cursos / Clases': {
                    category = await Category.findOne({name: 'Servicios'});
                    subcategory = await Category.findOne({name: 'Clases - Cursos'});
                    break;
                }
                case 'Empleos': {
                    category = await Category.findOne({name: 'Trabajo y Empleo'});
                    subcategory = await Category.findOne({name: 'Ofertas de Trabajo'});
                    break;
                }
                case 'Inmuebles': {
                    switch (a.categoria) {
                        case 'Alquiler temporario': {
                            category = await Category.findOne({name: 'Propiedades - Inmuebles'});
                            subcategory = await Category.findOne({name: 'Alojamiento vacacional - ALQUILER'});
                            break;
                        }
                        case 'Departamento - Casa en Alquiler': {
                            category = await Category.findOne({name: 'Propiedades - Inmuebles'});
                            subcategory = await Category.findOne({name: 'Departamentos - Casas - ALQUILER'});
                            break;
                        }
                        case 'Departamento - Casa en Venta': {
                            category = await Category.findOne({name: 'Propiedades - Inmuebles'});
                            subcategory = await Category.findOne({name: 'Departamentos - Casas - VENTA'});
                            break;
                        }
                        case 'Terrenos': {
                            category = await Category.findOne({name: 'Propiedades - Inmuebles'});
                            subcategory = await Category.findOne({name: 'Terrenos - VENTA'});
                            break;
                        }
                    }
                    break;
                }
                case 'Servicios': {
                    switch (a.categoria) {
                        case 'Informática': {
                            category = await Category.findOne({name: 'Servicios'});
                            subcategory = await Category.findOne({name: 'Reparaciones - Técnicos'});
                            break;
                        }
                        case 'Otros Servicios': {
                            console.log('Entra a Servicios / Otros Servicios');
                            category = await Category.findOne({name: 'Servicios'});
                            console.log('Category', category);
                            subcategory = await Category.findOne({name: 'Otros Servicios'});
                            console.log('Subcategory', subcategory);
                            break;
                        }
                        case 'Planeamiento de Eventos': {
                            category = await Category.findOne({name: 'Servicios'});
                            subcategory = await Category.findOne({name: 'Organización de eventos'});
                            break;
                        }
                        case 'Reparación': {
                            category = await Category.findOne({name: 'Servicios'});
                            subcategory = await Category.findOne({name: 'Reparaciones - Técnicos'});
                            break;
                        }
                        case 'Transporte - Mudanzas': {
                            category = await Category.findOne({name: 'Servicios'});
                            subcategory = await Category.findOne({name: 'Transporte - Mudanzas'});
                            break;
                        }
                        case 'Salud y Belleza': {
                            category = await Category.findOne({name: 'Moda y Belleza'});
                            subcategory = await Category.findOne({name: 'Salud y Belleza'});
                            break;
                        }
                    }
                    break;
                }
            }
            var city = await City.findOne({name: a.ubicacion});
            var now = new Date();
            var currency = a.moneda_id == '1' ? '$' : (a.moneda_id == '2' ? 'USD' : null);
            var principal = null;
            var arrayImages = [];
            if (a.imagen_principal) {
                var req = await doRequest('http://anunciate.hguaymas.com.ar/uploads/anuncios/images/' + a.imagen_principal);
                const uploadedImage = await s3UploadStream(req.body, req.res, a.imagen_principal);
                console.log('aws', uploadedImage);
                var img = {
                    originalFilename: a.imagen_principal,
                    mimeType: req.res.headers['content-type'],
                    size: req.res.headers['content-length'],
                    filename: a.imagen_principal,
                    path: uploadedImage.Location,
                    pathCdn: pathCdn + '/' + uploadedImage.key,
                    relativePath: uploadedImage.key,
                };
                principal = img;
                arrayImages.push(img);
            }
            if (a.imagenes) {
                for (var j = 0; j < a.imagenes.length; j++) {
                    var im = a.imagenes[j];
                    const ad = JSON.parse(im);
                    console.log('imagen', ad.nombre);
                    var req = await doRequest('http://anunciate.hguaymas.com.ar/uploads/anuncios/images/' + ad.nombre);
                    const uploadedImage = await s3UploadStream(req.body, req.res, ad.nombre);
                    console.log('aws', uploadedImage);
                    var img = {
                        originalFilename: ad.nombre,
                        mimeType: req.res.headers['content-type'],
                        size: req.res.headers['content-length'],
                        filename: ad.nombre,
                        path: uploadedImage.Location,
                        pathCdn: pathCdn + '/' + uploadedImage.key,
                        relativePath: uploadedImage.key,
                    };
                    console.log('img', img);
                    arrayImages.push(img);
                }
            }
            console.log('republished', moment(a.republished_date));
            var ad = new Ad();
            ad.title = a.titulo;
            ad.content = a.descripcion;
            ad.price = a.precio;
            var currency = a.moneda_id === '1' ? '$' : a.moneda_id === '2' ? 'USD' : '$';
            ad.currency = currency;
            ad.categoryId = category._id;
            ad.category = category._id;
            ad.subcategory = subcategory._id;
            ad.images = arrayImages;
            ad.mainImage = principal;
            ad.createdAt = moment(a.fecha_republicacion);
            ad.updatedAt = moment(a.fecha_republicacion);
            ad.republishedDate = moment(a.fecha_republicacion);
            ad.status = 'ACTIVE';
            ad.imported = true;
            var user = null;
            console.log('Usuario buscado', a.email_address);
            user = await User.findOne({email: a.email_address.toLowerCase()});
            console.log('Usuario encontrado', user);
            if (!user) {
                var password = generator.generate({
                    length: 6,
                    numbers: true
                });
                user = new User();
                user.phone = a.telefono;
                user.username = a.username;
                user.password = password;
                user.email = a.email_address;
                user.city = city._id;
                var confirmationToken = randtoken.generate(16);
                user.roles = [authConfig.roles.USER];
                user.confirmationToken = confirmationToken;
                user.confirmationExpirationDate = moment().add(1, 'days');
                if (user.methods.indexOf('local') === -1) {
                    user.methods.push('local');
                }
                user = await user.save();

                const url = 'https://www.compraventasalta.com.ar/account_activation/' + user._id + '/' + confirmationToken;
                //send mail with options
                var mailOptions = {
                    from: mailConfig.from, // sender address
                    to: user.email, // list of receivers 'hguaymas@gmail.com'
                    subject: 'NUEVO CompraVenta Salta! Conocelo!', // Subject line
                    text: 'Hola de nuevo! Hemos estado trabajando en mejorar nuestro servicio y generamos nuevamente tu usuario. Pega esta direccion en tu navegador para activar nuevamente tu cuenta y actualizar o gestionar tus avisos.', // plain text body
                    template: 'user_imported',
                    context: {
                        user: user,
                        url: url,
                        password: password
                    }
                };
                var info = await mailConfig.sendMail(mailOptions);
            }
            ad.user = user._id;
            ad.city = user.city;
            ad.cityId = user.city;
            await ad.save();
        }
        return res.status(201).json({message: 'OK'});

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error importando anuncios',
            error: err
        });
    }
};

function doRequest(url) {
    return new Promise(function (resolve, reject) {
        request({url: url, encoding: null}, function (error, res, body) {
            if (!error) {
                resolve({body: body, res: res});
            } else {
                reject(error);
            }
        });
    });
}

exports.resendImportedUsers = async (req, res, next) => {

    try {
        for (var i = 0; i < importedAds.length; i++) {
            var a = importedAds[i];
            var user = null;
            console.log('Usuario buscado', a.email_address);
            user = await User.findOne({email: a.email_address.toLowerCase()});
            console.log('Usuario encontrado', user);
            if (user) {
                var confirmationToken = randtoken.generate(16);
                user.confirmationToken = confirmationToken;
                user.confirmationExpirationDate = moment().add(1, 'days');
                if (user.methods.indexOf('local') === -1) {
                    user.methods.push('local');
                }
                var password = generator.generate({
                    length: 6,
                    numbers: true
                });
                user.password = password;
                user = await user.save();

                const url = 'https://www.compraventasalta.com.ar/account_activation/' + user._id + '/' + confirmationToken;
                //send mail with options
                var mailOptions = {
                    from: mailConfig.from, // sender address
                    to: user.email, // list of receivers 'hguaymas@gmail.com'
                    subject: 'Nos renovamos! (Enlaces corregidos)', // Subject line
                    text: 'Hola de nuevo! Hemos estado trabajando en mejorar nuestro servicio y generamos nuevamente tu usuario. Pega esta direccion en tu navegador para activar nuevamente tu cuenta y actualizar o gestionar tus avisos.', // plain text body
                    template: 'user_imported',
                    context: {
                        user: user,
                        url: url,
                        password: password
                    },
                };
                var info = await mailConfig.sendMail(mailOptions);

            }
        }
        return res.status(201).json({message: 'OK'});

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error importando anuncios',
            error: err
        });
    }
};

exports.acceptAd = async (req, res, next) => {
    try {
        const updated = req.query.updated;
        var ad = await Ad.findById(req.params.id);
        if (!ad) {
            return res.status(500).json({
                title: 'No se encontró el Aviso!',
                error: {message: 'Aviso no encontrado'}
            });
        } else {
            ad.status = 'ACTIVE';
            ad.verifiedDate = new Date();
            ad.verified = true;
            const updatedAd = await ad.save();

            if (!updated) {
                var suffix = ' - ' + 'https://www.compraventasalta.com.ar/anuncio/' + ad.slug + ' (contactar haciendo clic)';
                var len = 134 - 49;
                var title = snippets.snip(ad.title, {len: len});
                var status = title + suffix;
                //ENVIO TWEET
                var client = new Twitter({
                    consumer_key: process.env.TWITTER_CONSUMER_KEY,
                    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
                    access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
                    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
                });
                client.post('statuses/update', {status: status}, function (error, tweet, response) {
                    if (error) throw error;
                    //console.log(tweet);  // Tweet body.
                    console.log('TWEET OK!!!');
                });
            }

            res.status(200).json({
                ad: 'Anuncio AUTORIZADO!!'
            });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error aprobando el anuncio',
            error: err
        });
    }
};


exports.rejectAd = async (req, res, next) => {
    try {
        var ad = await Ad.findById(req.params.id).populate('user');
        if (!ad) {
            return res.status(500).json({
                title: 'No se encontró el Aviso!',
                error: {message: 'Aviso no encontrado'}
            });
        } else {
            ad.status = 'REJECTED';
            ad.verifiedDate = null;
            ad.verified = false;
            const updatedAd = await ad.save();
            const url_base = 'https://www.compraventasalta.com.ar';
            const newAd = await Ad.populate(updatedAd, {path: 'user category subcategory city'});
            var mailOptions = {
                to: newAd.user.email, // list of receivers
                subject: 'Anuncio rechazado', // Subject line
                text: 'Tu anuncio "' + newAd.title + '" ha sido rechazado porque no cumple con nuestros términos y condiciones de uso, por favor revísalo y vuelve a intentarlo!', // plain text body
                template: 'ad_rejected',
                context: {
                    ad: newAd,
                    url: url_base + '/backend/mis-avisos/editar/' + newAd._id,
                    urlTerms: url_base + '/terminos-condiciones'
                }
            };

            var info = await mailConfig.sendMail(mailOptions);
            //console.log('Email sent: ' + info.response);

            res.status(200).json({
                ad: 'Se ha RECHAZADO el anuncio'
            });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error guardando el anuncio',
            error: err
        });
    }
};

exports.checkRepublishAds = async () => {

    var query = {
        enabled: true,
        republishedDate: {
            $lte: moment().subtract(config.republishTimeQty, config.republishTimeUnit) //FECHA RESTANDO X TIEMPO
        },
        $and: [
            {
                $or: [
                    {reminderDate: {$lte: moment().subtract(config.remindTimeQty, config.remindTimeUnit)}},
                    {reminderDate: {$exists: false}}
                ]
            },
            {
                $or: [
                    {reminderTimes: {$lte: config.remindQty}},
                    {reminderTimes: {$exists: false}}
                ]
            }],
        status: {
            $in: ["ACTIVE", "PENDING", "EXPIRED"]
        }
    };
    console.log(query);
    try {
        const ads = await Ad.find(query)
        /*.select('republishedDate createdAt')*/
            .populate('user')
            .populate('category', 'name slug')
            .populate('subcategory', 'name slug')
            .populate('city', 'name slug')
            .exec();

        var mailOptions = {
            from: mailConfig.from, // sender address
            subject: 'Tu aviso ha expirado. Volvé a estar primero!', // Subject line
            text: 'Hola!, queremos informarte que tenés anuncios que expiran hoy, ingresá a nuestra web para republicarlo y posicionarlo nuevamente!', // plain text body
            template: 'republish_ad_message',
        };
        for (let i = 0; i < ads.length; i++) {
            let ad = ads[i];
            const url = 'https://www.compraventasalta.com.ar/backend/mis-avisos';
            //send mail with options
            mailOptions.to = ads[i].user.email;
            mailOptions.context = {
                userTo: ad.user,
                ad: ad,
                urlRepublish: url
            };
            console.log('Antes de mandar mail a ' + ads[i].user.email);
            var mailSent = await mailConfig.sendMail(mailOptions);
            console.log('MAIL ENVIADO', mailSent);
            ad.status = 'EXPIRED';
            ad.reminderDate = new Date();
            ad.reminderTimes = ad.reminderTimes ? ad.reminderTimes + 1 : 1;
            const updatedAd = await ad.save();
        }
        console.log('SE ENVIARON ' + ads.length + ' CORREOS DE REPUBLICACION');
    } catch (err) {
        console.log('ERROR REPUBLICACION ANUNCIOS', err);
    }
};
