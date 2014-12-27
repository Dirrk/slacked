/**
 * Created by Derek Rada on 12/23/2014.
 */


// require modules
var SlackRequest = require('./slackRequest');
var slackUtil = require('./slackUtil');
var SlackWorker = require('./slackWorker');
var util = require('util');
var WebSocket = require('ws');


function SlackLiveWorker (locations) {

    SlackWorker.call(this, locations);

    var self = this;
    self.userId = "";
    self.url = '';
    self.socket;

    // Connect to RTM via SlackRequest followed by opening WebSocket
    // Parse incoming messages and emit as needed

   /* aWorker.start = startWorkerJob;
    aWorker.openRTM = openRTM;

    aWorker.collector = null;
    aWorker.emitter = new events.EventEmitter();
    aWorker.errorhandler = errorHandler;

    aWorker.data = [];

    return aWorker;*/
}
util.inherits(SlackLiveWorker, SlackWorker);

SlackLiveWorker.prototype.startLiveSocket = function (cb) {

    var self = this;

    if (!self.url || self.url == "") {

        self.getLiveUrl(function (err) {
            if (!err) {
                self.startLiveSocket(cb);
            } else if (cb) {
                cb(err);
            } else {
                self.emit("error", err);
            }
        });

    } else {

        var ws = self.socket = new WebSocket(self.url);

        ws.on('open', function open() {
            console.log("SlackLiveWorker WebSocket Connected");
            self.emit('live');
            if (cb) {
                cb(null);
            }
        });

        ws.on('message', function(message) {
            console.log(message);
            // Doing this for now
        });

        ws.on('error', function (err) {
            console.error(err);
            self.emit('error', err);
        });
        ws.on('close', function () {
            console.log("WebSocket closed unexpectedly");
            self.emit('error', new Error("Unexpected close from Websocket"));
        });
    }

};

SlackLiveWorker.prototype.getLiveUrl = function (cb) {

    var self = this;
    SlackRequest('rtm.start', function (err, data) {
       if (!err) {
           self.url = data.url;
           self.userId = data.self.id;
       }
        if (cb) {
            cb(err, data);
        }
    });

};


// Will remove this but keep here for reference
function parseRTM(message) {

    var ret = {
        action: null,
        msg: {
            location: "",
            lastIndex: "",
            channel: true,
            data: []
        }
    };
    switch (message.type) {

        case "message":
            ret.action = "message";
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
            ret.action = null;
    }
    return ret;
}


module.exports = SlackLiveWorker;