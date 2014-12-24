/**
 * Created by Derek Rada on 12/24/2014.
 */

var sqlUtil = require('./sqlUtil');
var async = require('async');
var slackUtil = require('./slackService/v2/slackUtil');
var slackRequest = require('./slackService/v2/slackRequest');
var redis = require('./redisCache');

/***
 * Sends token for authentication to a user via slack
 * @param userId
 * @param token
 */
exports.sendToken = function(userId, token) {

    var slackToken = global.appConfig.token;

    if (!userId || !token || !slackToken) { return };
    var srOptions = {
        uri:   "im.open",
        query: {
            token: slackToken,
            user:  userId
        }
    };
    console.log("Sending token: %s for user: %s",token,userId);
    slackRequest(srOptions, function (err, data) {

        if (data && data.channel) {
            var pm = data.channel.id;

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



/***
 * Queries the database for the User and the users channels / groups
 * Does not store in cache as this data is held in session cache any how
 * @param userId
 * @param callback(err, UserObject)
 */
exports.getUserById = function(userId, callback) {

    var userQuery = "SELECT user.name as 'userName', user.userId, locations.locationId, locations.name, locations.isChannel " +
                    "FROM user " +
                    "INNER JOIN locationMembership " +
                    "ON user.userId=locationMembership.memberUserId "+
                    "INNER JOIN locations "+
                    "ON locationMembership.memberLocationId=locations.locationId "+
                    "WHERE user.userId=?";
    sqlUtil.getConnection(function (conn) {

        if (conn) {

            var query = conn.query(userQuery,[userId],function(err, results) {
               conn.release();
                if (err || !results || !results.length) {
                    callback(err);
                    return;
                }
                console.log("Query: %s", query.sql);
                console.log("GetUserById Results :: %j", results);
                callback(null, filterUserResults(results));
            });

        } else {
            callback(new Error("Couldn't connect to sql"));
        }
    });

    function filterUserResults(userResults) {
        var ret = {
            userId: "",
            name: "",
            channels: [],
            groups: []
        };
        for (var i = 0; i < userResults.length; i++) {

            if (i === 0) {
                ret.userId = userResults[i].userId;
                ret.name = userResults[i].userName;
            }
            if (!userResults[i].isChannel) {
                ret.groups.push(userResults[i].locationId);
            } else {
                ret.channels.push(userResults[i].locationId);
            }
        }
        return ret;
    }
};



/***
 * Queries the database for all Users.
 * Stores users in redis for quick lookups
 * calls back with (err, Users[])
 *
 * @param callback
 */
exports.getUsers = function(callback) {

    var obj = function (next) {
        var self = this;
        self.id = "slacked:users";
        next(null, self);
    };

    async.waterfall(
        [
            obj,
            cacheRetrieve,
            getUsersFromSQL,
            cacheSave
        ],
        function (err, self, data) {
            callback(err, data);
        }
    );

    function getUsersFromSQL(self, data, next) {

        if (self.skip === true) {
            console.log("Skipping sql calls data was cached");
            next(null, self, data);
            return;
        }
        self.skip = true;
        sqlUtil.getConnection(
            function (conn) {
                if (!conn) {
                    next(new Error("Could not connect to sql"), self, data);
                    return;
                }
                var sqlQuery = "SELECT * FROM user;";
                conn.query(sqlQuery, function (err, results) {
                    if (!err && results && results.length && results.length > 0) {
                        self.skip = false; // Cache Results
                        console.log("Retrieved users from DB: ", results);
                        next(null, self, results);
                    } else {
                        next(err, self, []);
                    }
                    conn.release();
                });
        });
    }
};




var cacheRetrieve = function(self, next) {

    if (!self.id) {
        console.warn("No identifier was sent to cache");
        next(null, self, null);
        return;
    }

    var client = redis.client();
    client.get(self.id, function (err, data) {
        if (err || !data) {
            console.log("RedisMiss - Key %s",self.id);
            next(null, self, false);
            return;
        }

        var result = null;
        data = data.toString();
        console.log("RedisHit - Retrieved key %s from redis value: %j", self.id, data);

        try {
            result = JSON.parse(data);
            self.skip = true;
        } catch (err) {
            console.warn(err);
        } finally {
            next(null, self, result);
        }
    });
};
var cacheSave = function(self, data, next) {

    var self = self;
    if (!self.id || !data || self.skip) {
        if (!self.skip) {
            console.warn("Failed caching content to invalid content\n--Self:%j\n--Data:%j",self.id,data);
        }
        next(null, self, data);
        return;
    }
    var result = "";
    try {
        result = JSON.stringify(data);
    } catch (e) {
        console.error(e);
        next(null, self, data);
        return;
    }
    var client = redis.client();
    client.setex(self.id, self.ttl || 3600, result, function (err) {
        if (err) {
            console.error(err);
        }
        next(null, self, data);
    });
};


