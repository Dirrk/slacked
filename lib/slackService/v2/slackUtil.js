/**
 * Created by Derek Rada on 12/1/2014.
 */
var sqlUtil = require('../../sqlUtil');
var slackService = require('./slackService');
var slackRequest = require('./slackRequest');

var slackToken = global.appConfig.token;

// SlackTimeStamp to Javascript Timestamp
exports.slackTStoJSTS = function slackTS2JSTS(stringInput){

    var time = parseFloat(stringInput);
    var newTime = Math.round(time) * 1000;
    return new Date(newTime);
};

exports.getNameById = function getNameById(userId) {

    var users = slackService.getUsers() || [];

    for (var i = 0; i < users.length; i++) {
        if (users[i].userId == userId) {
            return users[i].name;
        }
    }
    console.log("%s was not found in user list.  This has to be an error", userId);
    return "Null";
};

exports.sendToken = function(userId, token) {

    if (!userId || !token || !slackToken) { return };
    var srOptions = {
        uri:   "im.open",
        query: {
            token: slackToken,
            user:  userId
        }
    };

    console.log(srOptions);

    slackRequest(srOptions, function (err, data) {

        if (data && data.channel) {
            var pm = data.channel.id;
            // https://slack.com/api/chat.postMessage?token=SLACK_TOKEN&channel=D037JCR5Y&text=abcdefgh&pretty=1&username=zombie-bot
            var srOptions2 = {
                uri:   "chat.postMessage",
                query: {
                    token:    slackToken,
                    channel:  data.channel.id,
                    text:     token.pass,
                    username: "slacked-bot"
                }
            };
            slackRequest(srOptions2, function (err, data2) {
                if (data2 && data2.channel && data2.ts) {
                    console.log("Sent user token");
                } else {
                    console.log("Failed sending token %j", data2);
                }
            });
        } else {
            console.log("Could not open private message");
        }
    });
};

exports.locationsToArray = function (data) {
    var chans = data.channels;
    var groups = data.groups;
    var ret = [];
    var chanKeys = Object.keys(chans);
    var groupKeys = Object.keys(groups);

    for (var i = 0; i < chanKeys.length; i++)
    {
        ret.push(chans[chanKeys[i]]);
    }
    for (var j = 0; j < groupKeys.length; j++)
    {
        ret.push(groups[groupKeys[j]]);
    }
    return ret;
};


exports.hashToArray = function hashToArray(obj) {
    var keys = Object.keys(obj) || [];
    var ret = [];
    for (var i = 0; i < keys.length; i++)
    {
        ret.push(obj[keys[i]]);
    }
    return ret;
};

exports.verifyUserHasAccess = function verifyUserHasAccess(userId, locationId) {

    var user = slackService.getUsers()[userId];
    if (user) {

        for (var i = 0; i < user.channels.length; i++) {
            if (locationId == user.channels[i]) {
                return true;
            }
        }
        for (var i = 0; i < user.groups.length; i++) {
            if (locationId == user.groups[i]) {
                return true;
            }
        }
    }
    return false;
};