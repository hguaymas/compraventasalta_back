var express = require('express');
var router = express.Router();

var citiesController = require('../controllers/cities')
var mdAuth = require('../middlewares/security');

//router.get('/ruta_protegida', md_auth.checkAuthentication(), userController.metodo); //Uso del middleware

router.get('/', citiesController.listCities);
router.get('/by_slug/:slug', citiesController.getCityBySlug);
router.get('/listCitiesCountAds', citiesController.listCitiesCountAds);
router.post('/', mdAuth.checkAuthentication, citiesController.createCity);
router.post('/insertCities', mdAuth.checkAuthentication, citiesController.insertCities);
router.patch('/:id', mdAuth.checkAuthentication, citiesController.updateCity);
router.delete('/:id', mdAuth.checkAuthentication, citiesController.deleteCity);
module.exports = router;