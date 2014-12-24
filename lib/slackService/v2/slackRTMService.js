/**
 * Created by Derek Rada on 12/22/2014.
 */


// TESTING
var WebSocket = require('ws');
var slackRequest = require('./slackRequest');

var options = {

    uri: "rtm.start",
    query: {
        token: "SLACK_TOKEN"
    }
};

slackRequest(options, function (err, data) {

    if (!err && data.url) {

        console.log(JSON.stringify(data));

        var ws = new WebSocket(data.url);

        ws.on('open', function open() {
            console.log("Connected");
        });

        ws.on('message', function(message, flags) {
            console.log(message);
            // flags.binary will be set if a binary data is received.
            // flags.masked will be set if the data was masked.
        });
        ws.on('error', function (err) {
            console.error(err);
        });
    }
});

setInterval(function () {
   console.log("Testing time issue");
}, 900000);
