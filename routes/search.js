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
    var startDate = req.query.start || 0;
    var endDate = req.query.end || 4389369600000;
    var query = req.body.query;
    var userId = req.session.userId;
    var page = parseInt(req.query.page) || 1;

    var options = {

        userId: userId,
        locationId: location,
        startDate: startDate,
        endDate: endDate,
        query: query,
        page: page
    };

    httpHelper.locationHistory(options, function (results) {

        var ret = JSON.parse(JSON.stringify(options));
        if (results && results.length) {

            var pageStart = (page - 1) * 50;
            var pageEnd = (page) * 50;
            if (pageEnd > results.length) {
                pageEnd = results.length;
            }
            if (pageStart > results.length) {
                pageStart = 0;
            }
            ret.success = true;
            ret.total = results.length;
            ret.data = results.slice(pageStart, pageEnd);
            res.json(ret);

        } else {
            ret.success = false;
            ret.data = [];
            res.json(ret);
        }
    });
}

module.exports = router;


