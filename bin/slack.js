/**
 * Created by Derek Rada on 12/24/2014.
 */

var config = require('../lib/config');

config.slack(function (settings) {

    var d = require('domain').create();
    var slackService = require('../lib/slackService/v3/slackService');
    var slack;

    d.on('error', function (err) {
        console.error(err);
        try {
            slack = {};
        } catch (err) {
            console.error("Couldn't even delete object");
            console.error(err);
        } finally {
            slack = new slackService();
            d.add(slack);
        }
    });
    d.run(function () {
        slack = new slackService();
    });
});



