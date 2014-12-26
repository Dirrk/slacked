/**
 * Created by Derek Rada on 12/18/2014.
 */

var express = require('express');
var router = express.Router();
var httpHelper = require('../lib/httpHelper');
var userAuth = require('../middleware/userAuthentication');


// match the id first
router.use(userAuth);
router.get('/:id', httpHelper.searchRouteHandler); // /group/id
router.get('/', groupsHandler); // /groups

function groupsHandler(req, res) {

    res.json({ success: true, locations: req.session.groups || []});

};

module.exports = router;

