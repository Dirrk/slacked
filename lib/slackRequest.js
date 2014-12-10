/**
 * Created by Derek Rada on 12/1/2014.
 */



// require modules
var https = require('https');


// slackRequest

function slackRequest(url, callback) {

    if (!callback) {
        return null;
    }

    var req = https.request(url, slackRequestHandler);

    req.end();

    req.on('error', function (err) {
        console.log("error caught in slackRequest");
        callback(err);
    });

    function slackRequestHandler(res) {

        var data = '';

        res.setEncoding('utf8');
        res.on('data', function (d) {
            data = data + d.toString();
        });
        res.on('end', function () {
            try {
                var slackMessage = JSON.parse(data);
                if (slackMessage.ok !== true) {
                    console.warn("Slack message was NOT ok: " + slackMessage.error);
                    callback(new Error(slackMessage.error));
                } else {
                    callback(null, slackMessage);
                }
            } catch (e) {
                console.log("error caught trying to parse data");
                console.log(data);
                console.log(e);
                callback(e);
            }
        });
    }
}

module.exports = slackRequest;