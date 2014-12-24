/**
 * Created by Derek Rada on 12/1/2014.
 */


// require modules
var async = require('async');
var slackRequest = require('./slackRequest');
var events = require('events');
var sUtil = require('./../../slackUtil');
var util = require('util');
console.log("I am a slackworker");


// slackWorker
//  is essentially a timer that collects data from a given set of channels or private groups
//  it is either a channel or a group worker defined by options.default === true(channel)
//  there should only be 1 channel worker and the rest are group workers
//  TODO for now we are going to exclude group workers until I get this part working for channels
function slackWorker (options) {

    // options
    /// *site example "google."
    /// *default: true = "channel worker", false = "group worker"
    /// *token: slackapi token https://api.slack.com/tokens
    /// retrieveChannels: function (callback[err, resultArray]) { } function defined for getting the list of channels
    /// userId: Uxxxxx
    /// groups: []
    var aWorker = this;
    console.log("I am worker");

    aWorker.uriStem = "api/";


    if (options.default === true) {
        aWorker.uriStem = aWorker.uriStem + "channels.history";
        aWorker.isChannel = true;

    } else {
        if (options.userId) {
            aWorker.userId = options.userId;
        } else {
            console.log("Warning cannot start group worker without userId");
            aWorker.run = false;
            return;
        }
        aWorker.uriStem = aWorker.uriStem + "groups.history";
        aWorker.isChannel = false;
        console.log("Warning worker started for group before complete");
    }

    if (options.retrieveChannels && typeof options.retrieveChannels === 'function') {
        aWorker.getter = options.retrieveChannels;
        console.log("Channel retriever defined successfully for default worker");
    } else {
        console.warn("No channel retriever function defined.  Not starting worker");
        aWorker.run = false;
        return null;
    }

    if (options.token) {

        aWorker.token = options.token;

    } else {
        console.warn("No token defined for worker");
        aWorker.run = false;
        return null;
    }

    if (options.site) {
        aWorker.site = options.site + ".slack.com";
    } else {
        aWorker.site = "api.slack.com";
    }

    aWorker.delay = options.delay || global.appConfig.defaultDelay || 14400000; // 4 hours
    aWorker.url = "https://" + aWorker.site + "/" + aWorker.uriStem + "?token=" + aWorker.token + "&channel=";
    aWorker.run = true;


    aWorker.execute = runWorkerJob;
    aWorker.stop = stopWorkerJob;
    aWorker.start = startWorkerJob;
    aWorker.resume = resumeWorkerJob;
    aWorker.collectData = collectData;


    aWorker.emitter = new events.EventEmitter();

    aWorker.data = [];

    return aWorker;
}



function runWorkerJob(cb) {

    var me = this;
    console.log("RunWorkerJob started");

    if (me.run === true) {

        if (me.isChannel) {

            me.getter(function (err, data) {
                if (err) {
                    console.warn("Failed at getter");
                    console.error(err);
                    if (cb) { cb(err); }

                } else if (data && util.isArray(data) && data.length > 0) {

                    // successfully retrieved channel
                    console.log(data);
                    me.data = data;
                    me.collectData();

                } else {
                    // no data
                    console.log("no data");
                    console.log(data);

                    // using old channel list if availible
                    if (me.data.length > 0) {
                        me.collectData();
                    } else {
                        if (cb) { cb("No data"); }
                    }
                }
            });
        } else {

            me.getter(me.userId, function (err, data) {
                if (err) {
                    console.warn("Failed at getter");
                    console.error(err);
                    if (cb) { cb(err); }

                } else if (data && util.isArray(data) && data.length > 0) {

                    // successfully retrieved channel
                    console.log(data);
                    me.data = data;
                    me.collectData();

                } else {
                    // no data
                    console.log("no data");
                    console.log(data);

                    // using old channel list if availible
                    if (me.data.length > 0) {
                        me.collectData();
                    } else {
                        if (cb) { cb("No data"); }
                    }
                }
            });

        }


    } else {
        console.log("Did not start");
        if (cb) { cb("Worker not started"); }
    }
}

function stopWorkerJob() {
    var me = this;

    me.run = false;
}

function resumeWorkerJob() {
    var me = this;
    me.run = true;

    me.execute(function (err) {
        if (err) {
            console.warn("Failed to start worker");
            console.error(err);
        } else {
            console.log("Resumed worker successfully");
        }
    });
    return me.emitter;
}

function startWorkerJob() {

    var me = this;

    me.run = true;
    setImmediate(me.execute());
    setInterval(function () { me.execute(); }, me.delay);
    return me.emitter;
}


function collectData() {

    var me = this;
    console.log("Collecting data for");
    console.log(JSON.stringify(me.data));

    async.eachSeries(me.data, function (dataPoint, next) {

        console.log("Processing: " + dataPoint.locationId);
        var url = me.url.slice(0);
        url = url + dataPoint.locationId;
        if (dataPoint.lastIndex) {
            url = url + "&oldest="+ dataPoint.lastIndex;
        }

        slackRequest(url, function (err, results) {

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
    });
}


function parseResults(sender, location, results) {

    var ret = {

        location: location,
        lastIndex: "",
        channel: sender.isChannel,
        data: []
    };

    if (util.isArray(results) && results.length > 0) {
        for (var i = 0; i < results.length; i++) {
            var tmp = {
                dateTimeStamp: sUtil.slackTStoJSTS(results[i].ts).getTime(),
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
                    } else if (results[i].subtype == "bot_message") {
                        tmp.user = results[i].bot_id;
                        console.log("Bot Message sent");
                        var bot = {
                            userId: results[i].bot_id,
                            name: results[i].username || results[i].bot_id
                        };
                        sender.emitter.emit('bot', bot);
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
}

module.exports = slackWorker;