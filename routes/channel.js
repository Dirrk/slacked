/**
 * Created by Derek Rada on 12/10/2014.
 */

var express = require('express');
var router = express.Router();
var sqlUtil = require('../lib/sqlUtil');
var slackUtil = require('../lib/slackUtil');
var slackService = require('../lib/slackService/v1/slackService');
var userAuth = require('../middleware/userAuthentication');


router.use(userAuth);
router.get('/:id', channelHandler); // /channel/id
router.get('/', channelsHandler); // /channel/

function channelsHandler(req, res) {

    slackService.getChannelsByUserId(req.session.userId,
                             function (channels) {
                                 res.json(channels.map(function (chan) {
                                     return {locationId: chan.locationId, name: chan.name};
                                 }
                                 )
                                 );
                             }
    );
};

function channelHandler(req, res) {


    var config = {
        locationId: req.params.id || null,
        start: req.query.start || new Date().getTime(),
        isChannel: true,
        userId: req.session.user
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


module.exports = router;
