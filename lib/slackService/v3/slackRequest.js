/**
 * Created by Derek Rada on 12/1/2014.
 */

// require modules
var https = require('https');
var qs = require("querystring");
var slackUtil = require("./slackUtil");
var site = "https://slack.com/api";


// slackRequest

function SlackRequest(options, callback) {

    var url = "";
    if (!callback && !options) {
        return null;
    }
    if (options.uri === null || options.uri === undefined || typeof options !== "object") {
        url = site + '/' + options + "?token=" + slackUtil.token() + "&set_active=true";
    } else {
        if (options.uri.charAt(0) == '/') {
            url = site + options.uri;
        } else {
            url = site + '/' + options.uri;
        }
        if (options.query) {
            options.query.token = slackUtil.token();
            options.set_active = true;
            url = url + "?" + qs.stringify(options.query);
        }
    }
    console.log("slackRequest url=%s",url);
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

module.exports = SlackRequest;