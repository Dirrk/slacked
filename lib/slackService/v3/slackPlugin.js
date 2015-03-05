/**
 * Created by Derek Rada on 2/26/2015.
 */

var sRequest = require('./slackRequest');
var util = require('util');

function SlackPlugin() {

    var self = this;

    self._locations = {};
    self._users = {};
    self._me = "";

}

SlackPlugin.prototype.setUsers = function(users) {

    this._users = users;
};

SlackPlugin.prototype.setSelf = function(userId) {

    this._me = userId;
};

SlackPlugin.prototype.setLocations = function(locations) {

    this._locations = locations;
};


SlackPlugin.prototype.sendMessage = function(location, messages) {

    if (messages && messages.length) {

        var msgs = [];
        if (!util.isArray(messages)) {
            msgs = [messages]
        } else {
            msgs = messages;
        }
        console.log(msgs);

        for (var j = 0; j < Math.ceil(msgs.length / 10); j++) {

            var longMessage = "";
            for (var i = j * 10; i < msgs.length && i < ((j + 1) * 10); i++) {
                longMessage = longMessage + msgs[i];
            }
            var srOptions = {
                uri:   "chat.postMessage",
                query: {
                    channel:  location,
                    text:     longMessage,
                    username: "Zombie Bot"
                }
            };
            sRequest(srOptions,
                     function (err, data2) {
                         if (data2 && data2.channel && data2.ts) {
                             console.log("Sent message" + longMessage);
                         } else {
                             console.log("Failed sending message", longMessage);
                         }
                     }
            );
        }
    }
};

module.exports = SlackPlugin;