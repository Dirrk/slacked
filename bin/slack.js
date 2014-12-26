/**
 * Created by Derek Rada on 12/24/2014.
 */

var config = require('../lib/config');

config.slack(function (settings) {

    var slackService = require('../lib/slackService/v2/slackService');

    slackService.start(settings.token);
});



