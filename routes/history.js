/**
 * Created by Derek Rada on 12/31/2014.
 */


var express = require('express');
var router = express.Router();
var httpHelper = require('../lib/httpHelper');
var userAuth = require('../middleware/userAuthentication');
var util = require('util');
var DEFAULT_PAGE_SIZE = 50;

router.use(userAuth);
router.get('/:id', historyRoute); // /history/location


function historyRoute(req, res, next) {

    console.log("History Route Handler");

    var options = {
        userId: req.session.userId,
        locationId: req.params.id,
        startDate: 0,
        endDate: 4389369600000,
        query: null,
        pageSize: DEFAULT_PAGE_SIZE,
        users: []
    };
    if (!options.userId || !options.userId.length || options.userId.length < 8 || !options.locationId || !options.locationId.length || options.locationId.length < 8) {
        next(new Error("Unable to load history"));
        return;
    }
    if (req.query.start) {
        try {
            options.startDate = parseInt(req.query.start);
        } catch (e) {}
    }
    if (req.query.end) {
        try {
            options.endDate = parseInt(req.query.end);
        } catch (e) {}
    }
    if (req.query.pageSize) {
        try {
            options.pageSize = parseInt(req.query.pageSize);
        } catch (e) {}
    }
    if (req.query.query) {
        options.query = req.query.query;
    }
    if (req.query.user) {

        if (util.isArray(req.query.user)) {
            options.users = req.query.user;
        } else {
            options.users.push(req.query.user);
        }
        console.log(options.users);
    }
    console.log("SearchRouteHandler %j", options);


    httpHelper.locationHistory(options, function (results) {

        console.log("SearchRouteHandler results: %j", results);

        var ret = JSON.parse(JSON.stringify(options));
        if (results && results.length) {

            if (results.length > options.pageSize) {
                ret.nextDate = results[options.pageSize].msgStamp;
                options.endDate = ret.nextDate;
                httpHelper.locationHistory(options, function () {}); // Retrieve and cache next values

                ret.data = results.slice(0, options.pageSize);
                ret.total = options.pageSize;
                ret.isMore = true;
            } else {
                ret.data = results;
                ret.isMore = false;
                ret.total = results.length;
            }
            ret.success = true;

            res.json(ret);

        } else {
            ret.success = false;
            ret.data = [];
            res.json(ret);
        }
    });

};


module.exports = router;