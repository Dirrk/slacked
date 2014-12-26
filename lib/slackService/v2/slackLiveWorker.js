/**
 * Created by Derek Rada on 12/23/2014.
 */


// require modules
var slackRequest = require('./slackRequest');
var events = require('events');
var slackUtil = require('./slackUtil');
var WebSocket = require('ws');
var HOURS_4 = 14400000;


function SlackLiveWorker (options) {

    // options
    // retrieveLocations(callback[err, locations])
    // locations
    // token
    // url

    if (!options || !options.token || !options.url) {
        throw new Error("Invalid options");
        return;
    }

    var aWorker = this;
    aWorker.token = options.token;
    aWorker.url = options.url;
    aWorker.locations = options.locations || [];
    aWorker.retrieveLocations = options.retrieveLocations || function (callback) { callback (null, aWorker.locations)};
    aWorker.user = options.userId;
    aWorker.delay = options.delay || HOURS_4;

    aWorker.updateLocatons = runLocationJob;
    aWorker.start = startWorkerJob;
    aWorker.openRTM = openRTM;

    aWorker.collector = null;
    aWorker.emitter = new events.EventEmitter();
    aWorker.errorhandler = errorHandler;

    aWorker.data = [];

    return aWorker;
}

function runLocationJob() {

    var me = this;
    console.log("Keys: %j", Object.keys(me));
    console.log("Updating Locations for LiveWorker started");

    me.retrieveLocations(
        function (err, data) {
            if (!err) {
                if (data && data.length && data.length > 0) {
                    me.locations = data;
                } else {
                    console.warn("SlackLiveWorker was unable to update locations %j", data);
                }
            } else {
                console.error(err);
            }
        });
}

function startWorkerJob() {

    var me = this;

    openLiveSocket(me, function (err) {
        if (err) {
            me.openRTM();
        }
    });
    setInterval(function () {
        me.updateLocatons();
    },me.delay);

    return me.emitter;
}

function openLiveSocket(me, cb) {

    var ws = new WebSocket(me.url);
    var me = me;
    var t = setTimeout(function () {
       cb(new Error("Timed out"));
    }, 30000);

    ws.on('open', function open() {
        clearTimeout(t);
        me.collector = ws;
        cb(null);
        console.log("Workers WebSocket Connected");
    });

    ws.on('message', function(message, err) {

        console.log(message);
        var tmp = parseRTM(message);
        if (tmp.action) {
            console.log("Found actionable message: %j",tmp);
            me.emitter.emit("history", tmp.msg);
        } else { tmp = null; }
        // flags.binary will be set if a binary data is received.
        // flags.masked will be set if the data was masked.
    });
    ws.on('error', function (err) {
        console.error(err);
        me.emitter.emit('error', err);
    });
    ws.on('close', function () {
        console.log("WebSocket closed unexpectedly");
        me.emitter.emit('error', new Error("Unexpected close from Websocket"));

    });
}

function openRTM() {

    var me = this;
    var options = {

        uri: "rtm.start",
        query: {
            token: me.token
        }
    };

    slackRequest(options, function (err, data) {

        if (!err && data.url) {
            me.url = data.url;

            openLiveSocket(me, me.errorHandler);
        }
    });
}

function errorHandler(err) {
    if (err) {
        me.emitter.emit('error', err);
    }
}

function parseRTM(message) {

    var ret = {
        action: false,
        msg: {
            location: "",
            lastIndex: "",
            channel: true,
            data: []
        }
    };
    switch (message.type) {

        case "message":
            ret.action = true;
            ret.msg.location = message.channel;
            ret.msg.data[0] = {
                dateTimeStamp: slackUtil.slackTStoJSTS(message.ts).getTime(),
                user: message.user || message.username || null,
                text: message.text || "",
                location: message.channel
            };
            ret.msg.lastIndex = slackUtil.slackTStoJSTS(message.ts).getTime();
            break;
        default:
            ret.action = false;
    }
    return ret;
}


module.exports = SlackLiveWorker;