var express = require('express');
var router = express.Router();
var authController = require('../controllers/auth');
var passport = require('passport');
var passportConf = require('../config/passport');


router.get('/', function(req, res, next) {
    res.render('index');
});

//router.post('/login', passport.authenticate('local', {session: false}), authController.login);
router.post('/account_activation/send_link', authController.sendActivationlink);
router.post('/account_activation', authController.activateAccount);
router.post('/forgot_password', authController.sendNewPasswordLink);
router.put('/update_requested_password', authController.updateRequestedPassword);
router.post('/check_user_token', authController.checkUserToken);
router.post('/login', authController.login);
router.post('/login_facebook', passport.authenticate('facebookToken', { session: false }), authController.loginFacebook);

module.exports = router;
