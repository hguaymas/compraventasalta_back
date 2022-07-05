var express = require('express');
var router = express.Router();
var multipart = require('connect-multiparty');
var md_upload = multipart({uploadDir: './uploads/tmp'});
var usersController = require('../controllers/users');
//var md_auth = require('../middlewares/security');

//router.get('/ruta_protegida', md_auth.checkAuthentication(), userController.metodo); //Uso del middleware

router.get('/:id', usersController.getUser);
router.get('/', usersController.listUsers);
router.post('/register', usersController.registerUser);
router.post('/', usersController.createUser);
router.patch('/:id', usersController.updateUser);
router.put('/photo/:id', md_upload, usersController.updateUserPhoto);
router.put('/change_password', usersController.changePassword);
router.put('/:id', usersController.updateUser);
router.delete('/:id', usersController.deleteUser);
module.exports = router;