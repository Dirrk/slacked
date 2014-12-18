/**
 * Created by Derek Rada on 12/18/2014.
 */

var express = require('express');
var router = express.Router();
var sqlUtil = require('../lib/sqlUtil');
var slackService = require('../lib/slackService');

// match the id first
router.get('s', groupHandler); // /groups
router.get('/:id', groupsHandler); // /group/id


function groupsHandler(req, res) {

    var myUserId = null;
    if (req.user && req.user.loggedIn === true) {
      myUserId = req.user.id;
    }
    sqlUtil.getGroupHistory(myUserId, )

};

function groupHandler(req, res) {

    var channelId = req.params.id;
    var start = req.query.start || new Date().getTime();

    sqlUtil.getChannelHistory(start,channelId,function (err, data) {

        console.log(slackService.getGroups("U02HA00AX"));

        if (!err) {

            if (data.length && data.length > 0) {
                for (var i =0; i < data.length; i++) {
                    data[i].ts = makePrettyDate(data[i].msgStamp);
                }
                var lastIndex = data[data.length - 1].msgStamp;

                res.render('index', { title: "Slacked", lastIndex: lastIndex, channel: channelId, groups: slackService.getGroups("U02HA00AX"), channels: slackService.getChannels(), messages: data});
            } else {
                res.render('index', { title: "Slacked", channel: channelId, channels: slackService.getChannels(), groups: slackService.getGroups("U02HA00AX"), messages: [{ts: "Now", name: "Slacked", msg: "No data in channel"}]});
            }
        } else {
            res.status(500).send(err);
        }
    });

};

function makePrettyDate(inDate) {

    var aDate = new Date(inDate);
    return (aDate.getMonth() + 1) + "/" + aDate.getDate() + "/" + aDate.getUTCFullYear() + " " + aDate.getHours() + ":" + aDate.getMinutes();
}

module.exports = router;

