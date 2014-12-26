/**
 * Created by Derek Rada on 12/23/2014.
 */


// require modules
var async = require('async');
var slackRequest = require('./slackRequest');
var events = require('events');
var slackUtil = require('./slackUtil');

var groupUri = "groups.history";
var channelUri = "channels.history";

// slackWorker
// will collect the historical data that the liveWorker may have missed

function slackWorker (options) {

    // options
    // retrieveLocations(callback[err, locations])
    // locations
    // token
    // delay default = 0 which means it will exit after running

    if (!options || !options.token) {
        throw new Error("Invalid options");
        return;
    }

    var aWorker = this;
    aWorker.token = options.token;
    aWorker.locations = options.locations || [];
    aWorker.retrieveLocations = options.retrieveLocations || function (callback) { callback (null, aWorker.locations)};
    aWorker.delay = options.delay || 0;

    aWorker.updateLocatons = runLocationJob;
    aWorker.start = startWorkerJob;
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

    return aWorker;
}

function runLocationJob(cb) {

    var me = this;
    console.log("Updating Locations For slackWorker started");
    if (!cb) {
        cb = function () {};
    }

    me.retrieveLocations(
        function (err, data) {
            if (!err) {
                if (data && data.length && data.length > 0) {
                    me.locations = data;
                    cb(null);
                } else {
                    cb(null);
                    console.warn("SlackLiveWorker was unable to update locations %j", data);
                }
            } else {
                cb(null);
                console.error(err);
            }
        });
};

function startWorkerJob(cb) {

    var me = this;

    // Run Once
    if (cb) {
        me.collectData(function () {
            cb(null);
            if (me.delay != 0) {
                setTimeout(
                    function ()
                    {
                        me.start();
                    },
                    me.delay
                );
            } else {
                me.exit();
            }
        });
        return me.emitter;

    } else if (me.delay === 0){
        me.collectData(function () {
           console.log("slackWorker ran once is going to exit now");
            me.exit();
        });
        return me.emitter;
    } else {

        async.series(
            [
                me.updateLocatons,
                me.collectData
            ],
            function (err) {
                if (err) {
                    me.emitter('error', err);
                } else {
                    setTimeout(
                        function()
                        {
                            me.start();
                        },
                        me.delay
                    );
                }
            }
        );
    }
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
    sender.emitter.emit('history', ret);
}

module.exports = slackWorker;