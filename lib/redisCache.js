/**
 * Created by Derek Rada on 12/20/2014.
 */

redis = require('redis');

// Local Globals
var redisConnection = null,
    options         = null,
    ready           = false;

exports.ttl = 3600; // 1 hour


exports.start = function start(config, cb) {

    var redisConfig = config || global.appConfig.redis || {};
    console.log(redisConfig);

    redisConnection = redis.createClient(redisConfig.port, redisConfig.host, redisConfig.options);

    redisConnection.on(
        'ready',
        function () {
            ready = true;
            console.log("Redis caching server has connected successfully");
            if (cb) {
                cb(null);
            }
        }
    );
    redisConnection.on(
        'error',
        function (err) {
            console.error(err);
            ready = false;
            if (cb) {
                cb(err);
            }
        }
    );
};

exports.stop = function stop(cb) {
    try {
        redisConnection.quit();
        setTimeout(function () {
            try {
                redisConnection.end();
                cb();
            } catch (ignore) {
                cb();
            }
        }, 2500
        );
    } catch (ignore) {
        cb();
    }
};

exports.client = function client() {
    return redisConnection;
};

exports.test = function (cb, tries) {

    if (ready) {
        console.log("Redis started");
        cb(null);
    } else {
        if (!tries) {
            var tries = 0;
        }
        if (tries > 5) {
            cb(null);
        } else {
            setTimeout(function () {
                           exports.test(cb, (tries + 1));
                       }, 1000
            );
        }
    }
};
