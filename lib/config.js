/**
 * Created by Derek Rada on 12/26/2014.
 */

var appArgs = require('minimist')(process.argv.slice(2));
var appConfig;

function setup() {

    if (appArgs.c) {
        try {
            appConfig = require(appArgs.c);
        } catch (e) {
            try {
                appConfig = require('../config.json');
            } catch (e) {
                badConfigExit(e);
            }
        }
    } else {
        try {
            appConfig = require('../config.json');
        } catch (e) {
            badConfigExit(e);
        }
    }
    global.appConfig = appConfig;

    console.log(appConfig);

    if (!appConfig || !appConfig.token || appConfig.token == "") {
        badConfigExit(new Error("No/Invalid token, cannot start service"));
    } else {

        console.log("Config token was loaded successfully");

        var slackUtil = require('../lib/slackService/v2/slackUtil');
        slackUtil.setToken(global.appConfig.token);
    }
}
exports.www = function (cb) {

    setup();
    var settings = {};
    settings.port = appArgs.p || 3000;
    settings.token = appConfig.token;

    // Start Services in order
    var redisCache = require('../lib/redisCache');
    redisCache.start(appConfig.redis, function (err) {
        if (err) {
            // SWITCH TO MEMORY CACHE
            badConfigExit(err);
        } else {
            var mysql = require('../lib/sqlUtil');
            mysql.start(appConfig.mysql || null, function (err) {
                if (err) {
                    badConfigExit(err);
                } else {
                    cb(settings);
                }
            });
        }
    });
};

exports.slack = function (cb) {

    setup();
    var mysql = require('../lib/sqlUtil');
    var settings = { token: appConfig.token };
    mysql.start(appConfig.mysql || null, function (err) {
        if (err) {
            badConfigExit(err);
        } else {
            // Start other services
            cb(settings);
        }
    }
    );
};


function badConfigExit(e) {
    if (e) { console.error(e); }
    console.warn("FATAL: Exiting www service because config was not given");
    process.exit(-1);
}