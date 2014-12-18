/**
 * Created by Derek Rada on 12/10/2014.
 */

var express = require('express');
var router = express.Router();
var sqlUtil = require('../lib/sqlUtil');
var slackUtil = require('../lib/slackUtil');
var slackService = require('../lib/slackService');

router.get('/:id', channelHandler); // /channel/id
router.get('/', channelsHandler); // /channel/

function channelsHandler(req, res) {

    if (req.user && req.user.loggedIn === true) {
        // var userId = slackUtil.getCurrentRequestingUser(req);
        // TODO get Specific Channel info
        res.json(slackService.getChannels());
    } else {
        res.json(slackService.getChannels());
    }
};

function channelHandler(req, res) {


    var config = {
        locationId: req.params.id || null,
        start: req.query.start || new Date().getTime(),
        isChannel: true,
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
