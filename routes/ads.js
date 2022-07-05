var express = require('express');
var router = express.Router();

var adsController = require('../controllers/ads');

var mdAuth = require('../middlewares/security');
var multipart = require('connect-multiparty');
var md_upload = multipart();

//router.get('/ruta_protegida', md_auth.checkAuthentication(), userController.metodo); //Uso del middleware

router.use('/send_message', function(req, res, next) {
    mdAuth.checkAuthentication(req, res, next);
});

//router.get('/importAds', adsController.importAds);
//router.get('/resendImportedUsers', adsController.resendImportedUsers);
router.get('/:id/deleteAdmin/27571910', adsController.deleteAd);
router.get('/accept/:id', adsController.acceptAd);
router.get('/reject/:id', adsController.rejectAd);
router.get('/relatedAds/:id', adsController.getRelatedAds);
router.get('/by-user/:id', adsController.adsByUser)
router.get('/pager/:page', adsController.listAdsPager);
router.get('/by-slug/:slug', adsController.getAdBySlug);
router.get('/search', adsController.searchAds);
router.get('/my-ads', mdAuth.checkAuthentication, adsController.listMyAds);
router.get('/forRepublish', adsController.checkRepublishAds);
router.get('/latest', adsController.listLatestAds);
router.get('/:id', adsController.getAd);
router.get('/', adsController.listAds);
router.post('/report-ad', adsController.reportAd);
router.post('/send-message', mdAuth.checkAuthentication, adsController.sendMessage);
router.post('/', [mdAuth.checkAuthentication, md_upload], adsController.createAd);
router.put('/:id/change-status', [mdAuth.checkAuthentication, md_upload], adsController.changeAdStatus);
router.put('/:id', [mdAuth.checkAuthentication, md_upload], adsController.updateAd);
router.post('/upload-images', [mdAuth.checkAuthentication, md_upload], adsController.uploadImages);
router.delete('/:id', mdAuth.checkAuthentication, adsController.deleteAd);
module.exports = router;
