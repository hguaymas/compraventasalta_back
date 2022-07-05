var express = require('express');
var router = express.Router();

var notificationsController = require('../controllers/notifications');

var mdAuth = require('../middlewares/security');
//var multipart = require('connect-multiparty');
//var md_upload = multipart({uploadDir: './uploads/ads'});

//router.get('/ruta_protegida', md_auth.checkAuthentication(), userController.metodo); //Uso del middleware

/*router.use('/send_message', function(req, res, next) {
    mdAuth.checkAuthentication(req, res, next);
}); */

//router.get('/messages', mdAuth.checkAuthentication(), messagesController.listMessages);
router.get('/', mdAuth.checkAuthentication, notificationsController.getNotifications);
router.post('/', mdAuth.checkAuthentication, notificationsController.addNotification);
router.post('/mark-as-readed', mdAuth.checkAuthentication, notificationsController.markAsReaded);

module.exports = router;