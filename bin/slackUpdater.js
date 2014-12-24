/**
 * Created by Derek Rada on 12/24/2014.
 */


var appArgs = require('minimist')(process.argv.slice(2));
global.appConfig = {};

if (appArgs.c) {
    try {
        global.appConfig = require(appArgs.c);
    } catch (e) {
        try {
            global.appConfig = require('../config.json');
        } catch (e) {
            global.appConfig = {"port": 3000, "debug": true, "token": "", redis: {}};
        }
    }
} else {
    try {
        global.appConfig = require('../config.json');
    } catch (e) {
        global.appConfig = {"port": 3000, "debug": true, "token": "", redis: {}};
    }
}


var slackService = require('../lib/slackService/v2/slackService');

slackService.start(global.appConfig.token);

