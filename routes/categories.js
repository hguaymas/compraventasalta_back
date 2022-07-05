var express = require('express');
var router = express.Router();
var categoriesController = require('../controllers/categories');
var multipart = require('connect-multiparty');
var md_upload = multipart({uploadDir: './uploads/tmp'});
const fs = require('fs');
var mdAuth = require('../middlewares/security');
//var md_auth = require('../middlewares/security');

//router.get('/ruta_protegida', md_auth.checkAuthentication(), userController.metodo); //Uso del middleware

router.get('/', categoriesController.listCategories);
router.get('/by_slug/:slug', categoriesController.getCategoryBySlug);
router.get('/:id', categoriesController.getCategory);
router.post('/', [mdAuth.checkAuthentication, md_upload], categoriesController.createCategory);
router.put('/:id', [mdAuth.checkAuthentication, md_upload], categoriesController.updateCategory);
router.delete('/:id', mdAuth.checkAuthentication, categoriesController.deleteCategory);
module.exports = router;