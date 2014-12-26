/**
 * Created by Derek Rada on 12/22/2014.
 */

var express = require('express');
var router = express.Router();
var httpHelper = require('../lib/httpHelper');
var userAuth = require('../middleware/userAuthentication');


router.use(userAuth);
router.post('/:id', httpHelper.searchRouteHandler); // /search/location


module.exports = router;


