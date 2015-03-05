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
    self.timeoutNumber = Date.now();

}
util.inherits(SlackLiveWorker, SlackWorker);

SlackLiveWorker.prototype.startLiveSocket = function (cb) {

    var self = this;

    if (!self.url || self.url == "") {

        self.getLiveUrl(function (err) {
            if (!err) {
                self.startLiveSocket.call(self, cb);
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
            try {
                self.timeoutNumber = Date.now();
                parseRTM.call(self, JSON.parse(message));
            } catch (e) {
                console.error(e);
            }
        });

        ws.on('error', function (err) {
            console.error(err);
            self.emit('error', err);
        });
        ws.on('close', function () {
            console.log("WebSocket closed unexpectedly.  Restarting WebSocket");
            ws.removeAllListeners();
            delete self.socket;
            delete self.url;
            self.startLiveSocket();
        });
        self.checkTimeout.bind(self)();
    }
};

SlackLiveWorker.prototype.getLiveUrl = function (cb) {

    var self = this;
    SlackRequest('rtm.start', function (err, data) {
       if (!err) {
           self.url = data.url;
           self.userId = data.self.id;
           self.emit('myUser', self.userId);
       }
        if (cb) {
            cb(err, data);
        }
    });
};

SlackLiveWorker.prototype.stop = function (cb) {

    if (this._closing) {
        return;
    }
    this.socket.close();
    this.__killWorker(cb);
};

SlackLiveWorker.prototype.checkTimeout = function () {

    var self = this;
    var current = Date.now();
    if (current - self.timeoutNumber > 900000) {
        self.emit('error');
    } else {
        console.log("Checking timeout");
        setTimeout(self.checkTimeout.bind(self), 180000);
    }

};

// Will remove this but keep here for reference
function parseRTM(message) {

    var self = this;
    var myUser = self.userId;

    if (message.type == "message") { // If I receive a private message

        if (message.channel.charAt(0) == "D") {
            self.emit('mark', { locationId: message.channel, ts: message.ts }); // Mark that message read
        } else {
            self.emit('other', { locationId: message.channel, userId: message.user, text: message.text, ts: message.ts, myUserId: myUser });
        }

    } else if (message.type == "channel_joined" || message.type == "group_joined") { // I am joining a channel

        var chan = slackUtil.parseLocation(message.channel);
        self.emit("location", chan);

    } else if (message.type == "presence_change" && message.user == myUser && message.presence == "away") { // I am away
        // Make active
        self.emit("away");
    } else {
        console.log("Useless message: %j", message);
    }
}


module.exports = SlackLiveWorker;