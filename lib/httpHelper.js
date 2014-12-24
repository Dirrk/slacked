/**
 * Created by Derek Rada on 12/24/2014.
 */


var sqlUtil = require('sqlUtil');
var slackUtil = require('slackUtil');




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



