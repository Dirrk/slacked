/**
 * Created by Derek Rada on 12/22/2014.
 */

var express = require('express');
var router = express.Router();
var httpHelper = require('../lib/httpHelper');
var userAuth = require('../middleware/userAuthentication');


router.use(userAuth);
router.post('/:locationId', searchHandler); // /search/location


function searchHandler(req, res, next) {

    var location = req.params.locationId;
    var startDate = req.query.start || new Date().getTime();
    var endDate = req.query.end || new Date().getTime();
    var query = req.body.query;
    var userId = req.session.userId;

    httpHelper.verifyAccess(req.session.channels, req.session.groups, location);

    slackUtil.verifyUserHasAccess(userId, location, function (hasAccess) {
        if (hasAccess) {


            sqlUtil.search(startDate, endDate, location, query, function (results) {
                res.json(results);
            }
            );

        } else {
            next(new Error("No access"));
        }
    }
    );
}

module.exports = router;


