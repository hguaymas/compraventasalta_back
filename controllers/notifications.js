const Ad = require('../models/ad');
const Message = require('../models/message');
const jwt = require('jsonwebtoken');
const Notification = require('../models/notification');
var ObjectId = require('mongoose').Types.ObjectId;
var moment = require('moment');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

exports.addNotification = async (req, res, next) => {
    console.log(req.body);
    var userId = req.body.userId;
    var text = req.body.text;
    var code = req.body.code;
    try {

        notification = new Notification({
            user: userId,
            text: text,
            notificationDate: new Date(),
            readed: false,
            code: code
        });

        const savedNotification = await notification.save();

        await res.io.emit('new-notification', savedNotification);

        res.status(200).json(savedNotification);

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error creando la notificación',
            error: err
        });
    }
};


exports.getNotifications = async (req, res, next) => {
    var token = req.headers.authorization;
    var decoded = jwt.decode(token);
    var userId = decoded.sub;

    try {
        //const notifications = await Notification.find({user: userId}).sort({notificationDate: -1}).limit(5).exec();
        notifications = await Notification.aggregate(
            [
                {"$match": {
                        $and: [ { user: ObjectId(userId) }, { notificationDate: { $gte: moment().subtract(1, 'days').toDate() } } ]
                }},
                {"$sort": { "notificationDate": -1 }},
                {"$group": {
                        "_id": "$code",
                        "notificationDate": { "$max": "$notificationDate" },
                        "text": { "$first": "$text" },
                        "code": { "$first": "$code" },
                        "link": { "$first": "$link" },
                        "readed": { "$first": "$readed" },
                }}

            ]);
        res.status(200).json(notifications);
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            title: 'Error al obtener mensajes',
            error: err
        });
    }
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
            $in: ["ACTIVE", "ACTIVATED", "AUTHORIZED"]
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
    }
    else {
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

exports.markAsReaded = async (req, res, next) => {
    console.log(req.body);
    var token = req.headers.authorization;
    var decoded = jwt.decode(token);
    var userId = decoded.sub;
    try {
        let notifications = await Notification.find({'user': userId, 'readed': false});

        if (notifications) {
            for (let i = 0; i < notifications.length; i++) {
                notifications[i].readed = true;
                notifications[i].readedAt = new Date();
                await notifications[i].save();
            }
            res.status(200).json();
        } else {
            return res.status(500).json({
                title: 'Notificación no encontrada',
                error: {message: 'No se encontraron notificaciones para actualizar'}
            });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            title: 'Ocurrió un error actualizando la notificación',
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


   
