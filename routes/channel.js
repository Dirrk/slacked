/**
 * Created by Derek Rada on 12/10/2014.
 */

var express = require('express');
var router = express.Router();
var httpHelper = require('../lib/httpHelper');
var userAuth = require('../middleware/userAuthentication');
var async = require('async');


router.use(userAuth);
router.get('/all', getAllChannels);
router.get('/:id', httpHelper.searchRouteHandler); // /channel/id
router.get('/', channelsHandler); // /channel/
router.post('/', subscribeToChannels);

function channelsHandler(req, res) {

    if (req.query.force == true) {
        httpHelper.getUserById(req.session.userId, function (err, user) {
            if (!err) {
                req.session.channels = user.channels || res.session.channels || [];
            }
            res.json({ success: true, locations: req.session.channels || []});
        })
    } else {
        res.json({ success: true, locations: req.session.channels || []});
    }
};


function getAllChannels(req, res) {

    httpHelper.getAllChannels(function (err, results) {
       if (!err) {
           res.json({ success: true, channels: results});
       } else {
           res.json({success: false, channels: []});
       }
    });
}


function subscribeToChannels(req, res) {

    var channels = req.body.channels;
    console.log(channels);
    if (channels && channels.length && channels.length > 0) {
        async.eachSeries(
            channels,
            httpHelper.joinChannel,
            function (err) {
               if (!err) {
                   res.send({success: true});
               } else {
                   console.error(err);
                   res.send({success: false});
               }
        });
    } else {
        res.send({success: false});
    }
};

module.exports = router;
