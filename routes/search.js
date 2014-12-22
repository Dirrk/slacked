/**
 * Created by Derek Rada on 12/22/2014.
 */

var express = require('express');
var router = express.Router();
var sqlUtil = require('../lib/sqlUtil');
var slackUtil = require('../lib/slackUtil');
var userAuth = require('../middleware/userAuthentication');


router.use(userAuth);
router.post('/:locationId', searchHandler); // /search/location


function searchHandler(req, res, next) {

    var location = req.params.locationId;
    var startDate = req.query.start || new Date().getTime();
    var endDate = req.query.end || new Date().getTime();
    var query = req.body.query;
    var userId = req.session.userId;

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


