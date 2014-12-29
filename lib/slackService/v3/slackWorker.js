/**
 * Created by Derek Rada on 12/23/2014.
 */


// require modules
var async = require('async');
var SlackRequest = require('./slackRequest');
var EventEmitter = require('events').EventEmitter;
var slackUtil = require('./slackUtil');
var util = require('util');
var groupUri = "groups.history";
var channelUri = "channels.history";

// slackWorker
// will collect the historical data that the liveWorker may have missed

function SlackWorker (locations) {

    // locations

    EventEmitter.call(this);
    var self = this;
    self.token = slackUtil.token();
    self.locations = locations || [];
    self._closing = false;

}
util.inherits(SlackWorker, EventEmitter);

SlackWorker.prototype.updateLocations = function updateLocations(locations) {

    this.locations = locations;
};

SlackWorker.prototype.runHistoryTask = function runHistoryTask(callback) {

    var self = this;
    if (callback) {
        collectData.call(self, callback);
    } else {
        collectData.call(self, function (err) {
            if (!err) {
                self.emit("HistoryDone");
            } else {
                self.emit("error", err);
            }
        });
    }
};

SlackWorker.prototype.__killWorker = function __killWorker(cb) {

    if (this._closing) {
        return;
    }
    this._closing = true;
    var self = this;
    setTimeout(
        function () {
            self.removeAllListeners();
            if (cb) {
                cb();
            } else {
                console.log("Killed worker successfully");
            }
        },60 * 1000 // 60 seconds to give a chance for everything to close out
    );
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

            SlackRequest(options, function (err, results) {

                if (err) {
                    console.error(err);
                    setTimeout(function() { next() }, 750);
                }
                else {
                    var history = parseResults(dataPoint.locationId, results.messages);
                    if (history) {
                        me.emit("history", history);
                    }
                    setTimeout(function() { next() }, 750);
                }
            });
        }, function (err) {
            if (err) { console.error(err) };
            cb(null);
        });
};

function parseResults(location, results) {

    var ret = {
        location: location,
        lastIndex: "",
        data: []
    };
    if (!results || !results.length || results.length < 1) {
        return null;
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

            ret.data.push(JSON.parse(JSON.stringify(tmp)));
        }
    }
    ret.lastIndex = results[0].ts;
    return ret;
};

module.exports = SlackWorker;