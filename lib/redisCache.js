/**
 * Created by Derek Rada on 12/20/2014.
 */

redis = require('redis');

// Local Globals
var redisConnection = null,
    options         = null,
    ready           = false;

exports.ttl = 3600; // 1 hour


exports.start = function start() {

    var redisConfig = global.appConfig.redis;
    console.log(redisConfig);

    redisConnection = redis.createClient(redisConfig.port, redisConfig.host, redisConfig.options);

    redisConnection.on('ready', function () {
        ready = true;
        console.log("Redis caching server has connected successfully");
    }
    );
    redisConnection.on('error', function (err) {
        console.error(err);
        ready = false;
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

exports.test = function () {

    if (ready) {
        console.log("Redis started");
    } else {
        setTimeout(function () {
            console.log("Redis hasn't started, going to retry in a second");
            exports.test();
        }, 5000
        );
    }
};
