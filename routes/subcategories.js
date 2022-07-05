var express = require('express');
var router = express.Router();

var subcategoriesController = require('../controllers/subcategories')
//var md_auth = require('../middlewares/security');

//router.get('/ruta_protegida', md_auth.checkAuthentication(), userController.metodo); //Uso del middleware

router.get('/', subcategoriesController.listSubcategories);
router.get('/:slug', subcategoriesController.listSubcategories);
router.post('/create', subcategoriesController.createSubcategory);
router.patch('/:id', subcategoriesController.updateSubcategory);
router.delete('/:id', subcategoriesController.deleteSubcategory);
module.exports = router;