/**
 * Created by Derek Rada on 12/10/2014.
 */

var express = require('express');
var router = express.Router();
var sqlUtil = require('../lib/sqlUtil');
var slackSerice = require('../lib/slackService');

router.get('/:id', channelHandler);

function channelHandler(req, res) {

    var channelId = req.params.id;
    var start = req.query.start || new Date().getTime();

    sqlUtil.getChannelHistory(start,channelId,function (err, data) {

        if (!err) {

            if (data.length && data.length > 0) {
                for (var i =0; i < data.length; i++) {
                    data[i].ts = makePrettyDate(data[i].msgStamp);
                }
                var lastIndex = data[data.length - 1].msgStamp;

                res.render('index', { title: "slacker", lastIndex: lastIndex, channel: channelId, channels: slackSerice.getChannels(), messages: data});
            } else {
                res.render('index', { title: "slacker", channel: channelId, channels: slackSerice.getChannels(), messages: [{ts: "Now", name: "Slacked", msg: "No data in channel"}]});
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
