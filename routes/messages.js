var express = require('express');
var router = express.Router();

var messagesController = require('../controllers/messages');

var mdAuth = require('../middlewares/security');
//var multipart = require('connect-multiparty');
//var md_upload = multipart({uploadDir: './uploads/ads'});

//router.get('/ruta_protegida', md_auth.checkAuthentication(), userController.metodo); //Uso del middleware

/*router.use('/send_message', function(req, res, next) {
    mdAuth.checkAuthentication(req, res, next);
}); */

//router.get('/messages', mdAuth.checkAuthentication(), messagesController.listMessages);
router.get('/', mdAuth.checkAuthentication, messagesController.listMessages);
router.get('/sent', mdAuth.checkAuthentication, messagesController.listSentMessages);
router.post('/reply', mdAuth.checkAuthentication, messagesController.replyMessage);
router.post('/reply-sent', mdAuth.checkAuthentication, messagesController.replyMessageSent);
router.post('/mark-as-readed', mdAuth.checkAuthentication, messagesController.markAsReaded);
router.post('/mark-as-readed-sent', mdAuth.checkAuthentication, messagesController.markAsReadedSent);
router.post('/contact', messagesController.contactMessage);
router.post('/', mdAuth.checkAuthentication, messagesController.sendMessage);

module.exports = router;