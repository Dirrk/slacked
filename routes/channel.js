/**
 * Created by Derek Rada on 12/10/2014.
 */

var express = require('express');
var router = express.Router();
var httpHelper = require('../lib/httpHelper');
var userAuth = require('../middleware/userAuthentication');


router.use(userAuth);
router.get('/:id', httpHelper.searchRouteHandler); // /channel/id
router.get('/', channelsHandler); // /channel/

function channelsHandler(req, res) {

    res.json({ success: true, locations: req.session.channels || []});

};


module.exports = router;
