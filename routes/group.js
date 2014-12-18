/**
 * Created by Derek Rada on 12/18/2014.
 */

var express = require('express');
var router = express.Router();
var sqlUtil = require('../lib/sqlUtil');
var slackUtil = require('../lib/slackUtil');
var slackService = require('../lib/slackService');

// match the id first
router.get('/:id', groupHandler); // /group/id
router.get('/', groupsHandler); // /groups

function groupsHandler(req, res) {

    var userId = slackUtil.getCurrentRequestingUser(req);

    // Get Cached Data
    var groups = slackService.getGroups(userId) || [];

    // If no data try refreshing
    if (groups || groups.length == 0) {

        // Using callback queries most current data
        slackService.getGroups(userId, function (data) {
            res.json(data || []);
        });

    } else {
        res.json(groups);
    }

};

function groupHandler(req, res) {


    var config = {
        locationId: req.params.id || null,
        start: req.query.start || new Date().getTime(),
        isChannel: false,
        userId: slackUtil.getCurrentRequestingUser(req)
    };

    sqlUtil.getLocationHistory(config, function (err, data) {

        if (data) {
            res.json(data);
        } else {
            if (err) {
                console.error(err);
            }
            res.json([])
        }
    });

};


function makePrettyDate(inDate) {

    var aDate = new Date(inDate);
    return (aDate.getMonth() + 1) + "/" + aDate.getDate() + "/" + aDate.getUTCFullYear() + " " + aDate.getHours() + ":" + aDate.getMinutes();
}

module.exports = router;

