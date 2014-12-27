/**
 * Created by Derek Rada on 12/23/2014.
 */


// require modules
var async = require('async');
var slackRequest = require('./slackRequest');
var EventEmitter = require('events').EventEmitter;
var slackUtil = require('./slackUtil');
var util = require('util');
var groupUri = "groups.history";
var channelUri = "channels.history";

// slackWorker
// will collect the historical data that the liveWorker may have missed

function SlackWorker (locations) {

    // locations

    var self = this;
    self.token = slackUtil.token();
    self.locations = locations || [];
    /*
    this.updateLocatons = runLocationJob;
    this.start = startWorkerJob;
    aWorker.collectData = collectData;

    aWorker.emitter = new events.EventEmitter();
    aWorker.data = [];

    aWorker.exit = function () {
      setTimeout(
          function () {
              aWorker.emitter.removeAllListeners();
          }, 500
      )
    };
    */
}
util.inherits(SlackWorker, EventEmitter);

SlackWorker.prototype.updateLocations = function updateLocations(locations) {

    this.locations = locations;
};

SlackWorker.prototype.runHistoryTask = function runHistoryTask(callback) {

    collectData.call(this, callback);
};



function collectData(cb) {

    var me = this;

    async.eachSeries(
        me.locations,
        function (dataPoint, next) {

            console.log("SlackWorker: dataPoint = %j", dataPoint);

            var options = {
                uri: "",
                query: {
                    token: me.token,
                    channel: dataPoint.locationId
                }
            };
            if (dataPoint.lastIndex != null && dataPoint.lastIndex != '') {
                options.query.oldest = dataPoint.lastIndex
            }
            if (!dataPoint.isChannel) {
                options.uri = groupUri;
            } else {
                options.uri = channelUri;
            }
            console.log("Processing: " + dataPoint.locationId);


            slackRequest(options, function (err, results) {

                if (err) {
                    console.error(err);
                    setTimeout(function() { next() }, 750);
                }
                else {
                    setTimeout(function() { next() }, 750);
                    parseResults(me, dataPoint.locationId, results.messages);
                }
            });
        }, function (err) {
            if (err) { console.error(err) };
            cb(null);
        });
};

function parseResults(sender, location, results) {

    var ret = {
        location: location,
        lastIndex: "",
        channel: sender.isChannel,
        data: []
    };
    if (!results || !results.length || results.length < 1) {
        return;
    }

    for (var i = 0; i < results.length; i++) {

        var tmp = {
            dateTimeStamp: slackUtil.slackTStoJSTS(results[i].ts).getTime(),
            location: location,
            user: "",
            text: ""
        };
        if (results[i].type == "message") {

            tmp.text = results[i].text;
            tmp.user = results[i].user || results[i].bot_id || results[i].username;

            // sub type should not include user but may also want to edit text
            if (results[i].subtype) {
                // just exclude user
                if (results[i].subtype == "channel_purpose" || results[i].subtype == "channel_join") {
                    tmp.user = null;
                } else { // define later
                    tmp.user = null;
                }
            }
            ret.data.push(JSON.parse(JSON.stringify(tmp)));
        }
    }
    ret.lastIndex = results[0].ts;
    sender.emit('history', ret);
}

module.exports = SlackWorker;