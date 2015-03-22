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
    self.status = 0; // -1 = error, 0 = start / connecting, 1 = open, 2 = hello received, 3 = first ping response received
    self.stats = {
        lastPing: 0,
        lastPong: 0,
        latency: 0,
        lastMessageReceived: 0,
        lastMessageSent: 0,
        sentMessages: 0,
        receivedMessages: 0,
        serviceStarted: Date.now()
    };
    self.callbacks = {};
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
            self.status = 1;
            if (cb) {
                cb(null);
            }
        });

        ws.on('message', function(message) {
            try {
                self.stats.lastMessageReceived = Date.now();
                parseRTM.call(self, JSON.parse(message));
            } catch (e) {
                console.error(e);
            }
        });

        ws.on('error', function (err) {
            self.status = -1;
            console.error(err);
            self.emit('error', err);
        });
        ws.on('close', function () {
            console.log("WebSocket closed unexpectedly.  Restarting WebSocket");
            self.status = -1;
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

    var currentTime = Date.now();

    // We are active
    if (self.status == 3 && currentTime - self.stats.lastPong > 90000) {
        console.error("Failed Timeout: Status=%d CurrentTime=%d LastPong=%d",self.status, currentTime, self.stats.lastPong);
        self.socket.close()
    } else if (self.status >= 2) {
        self.ping();
    }
    setTimeout(self.checkTimeout.bind(self), 30000);
};

SlackLiveWorker.prototype.ping = function () {

    var self = this;

    if (self.status < 2) {
        return;
    }

    self.stats.sentMessages++;
    self.stats.lastPing = Date.now();

    var pingMessage = {
        id: self.stats.sentMessages,
        type: "ping",
        time: self.stats.lastPing
    };

    self.socket.send(JSON.stringify(pingMessage));
};


// This needs to be revised, what if I want a slackplugin to be able to respond to join / leave events?
// TODO Change this
function parseRTM(message) {

    var self = this;
    self.stats.lastMessageReceived = Date.now();

    if (message.type == "message") { // If I receive a message

        if (message.channel.charAt(0) == "D") { // Direct Message
            self.emit('mark', { locationId: message.channel, ts: message.ts }); // Mark that message read

            // Internal plugins
            // TODO This should be moved to an actual plugin with dependency injection for slack.stats

            // Stats
            if (message.text && message.text.search(/!stats/i) >= 0) {
                self.stats.receivedMessages++;
                self.emit('stats', { locationId: message.channel,  stats: self.stats });
                return;
            }
        }
        if (message.user != self.userId) {
            self.emit('other', { locationId: message.channel, userId: message.user, text: message.text, ts: message.ts, myUserId: self.userId });
        }
    } else if (message.type == "channel_joined" || message.type == "group_joined") { // I am joining a channel

        self.stats.receivedMessages++;
        var chan = slackUtil.parseLocation(message.channel);
        self.emit("location", chan);

    } else if (message.type == "presence_change" && message.user == self.userId && message.presence == "away") { // I am away
        // Make active
        self.emit("away");
    } else if (message.type == "hello") {
        self.stats.receivedMessages++;
        self.status = 2;
        self.ping();

    } else if (message.type == "pong") {

        self.status = 3;
        self.stats.lastPong = Date.now();
        self.stats.latency = self.stats.lastPong - self.stats.lastPing;

    } else {
        // This should be sending other not the message from above
        // self.emit('other', message);
        console.log("Useless message: %j", message);
    }
}


module.exports = SlackLiveWorker;