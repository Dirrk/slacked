/**
 * Created by Derek Rada on 12/24/2014.
 */

var sqlUtil = require('./sqlUtil');
var async = require('async');
var slackUtil = require('./slackService/v3/slackUtil');
var slackRequest = require('./slackService/v3/slackRequest');
var redis = require('./redisCache');
var crypto = require('crypto');
var DEFAULT_PAGE_SIZE = 25;


/***
 * Sends token for authentication to a user via slack
 * @param userId
 * @param token
 */
exports.sendToken = function(userId, token) {

    var slackToken = slackUtil.token();

    if (!userId || !token || !slackToken) { return };
    var srOptions = {
        uri:   "im.open",
        query: {
            token: slackToken,
            user:  userId
        }
    };
    console.log("Sending token: %j for user: %s",token, userId);
    slackRequest(srOptions, function (err, data) {

        if (data && data.channel) {
            var pm = data.channel.id;

            var srOptions2 = {
                uri:   "chat.postMessage",
                query: {
                    token:    slackToken,
                    channel:  data.channel.id,
                    text:     token.pass,
                    username: "Zombie Bot",
                    as_user: true
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
 * Queries the database for the User and the users Channels / Groups / Display Name
 * Does not store in cache as this data is held in session cache
 * UserObject = {
 *   userId: "userID"
 *   name: "user.name",
 *   channels: [{ locationId: "chann##", name: "channel1"}, { locationId: "chan###", name: "channel2"} ],
 *   groups: [{ locationId: "group##", name: "group1"}, { locationId: "group###", name: "group2"} ]
 * }
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
                ret.groups.push({ locationId: userResults[i].locationId, name: userResults[i].name });
            } else {
                ret.channels.push({ locationId: userResults[i].locationId, name: userResults[i].name });
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
        self.skip = false;
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
                        console.log("Retrieved users from DB: %j", results);
                        next(null, self, results);
                    } else {
                        next(err, self, []);
                    }
                    conn.release();
                });
        });
    }
};


/***
 * Takes options object and searches for location query
 * @param options
 * @param callback
 */
var locationHistoryHelper = function locationHistoryHelper(options, callback) {

    console.log("Location History: %j", options);
    var sqlQuery = "SELECT channel_history.locationId, channel_history.userId, user.name, channel_history.msg, channel_history.msgStamp " +
        "FROM channel_history " +
        "INNER JOIN locationMembership " +
        "ON channel_history.locationId=locationMembership.memberLocationId " +
        "LEFT JOIN user " +
        "ON channel_history.userId=user.userId " +
        "WHERE locationMembership.memberUserId = ? AND msgStamp >= ? AND msgStamp <= ?";

    var words = [];
    if (options.query) {
        words = options.query.split(" ");
    }
    var params = [options.userId, options.startDate || 0, options.endDate || 4389369600000];
    if (options.locationId) {
        sqlQuery = sqlQuery + " AND channel_history.locationId = ?";
        params.push(options.locationId);
    }
    for (var i = 0; i < words.length; i++) {

        words[i] = "%" + words[i] + "%";
        sqlQuery = sqlQuery + ' AND msg like ?';
        params.push(words[i]);
    }
    var limit = DEFAULT_PAGE_SIZE + 1; // DEFAULT + 1
    if (options.pageSize && typeof options.pageSize === 'number') {
        limit = (options.pageSize + 1);
    }
    sqlQuery = sqlQuery + " ORDER BY channel_history.msgStamp DESC LIMIT " + limit + ";";

    sqlUtil.getConnection(
        function (conn) {
            var q = conn.query(
                sqlQuery,
                params,
                function (err, data) {

                    conn.release();
                    console.log(q.sql);
                    if (err) {
                        console.log(err);
                        callback([]);
                    } else {
                         // console.log(data);
                         callback(data);
                    }
                }
          );
      }
    );
};

/***
 * Calls locationHistoryHelper to peform history searches / lookups
 * @param options
 * @param callback
 */
exports.locationHistory = function (options, callback) {

    if (!options.locationId || !options.userId) {
        callback(new Error("No location was provided"));
        return;
    }
    var options = options;
    var obj = function (next) {
        var self = this;
        self.id = optionsToHash(options);
        self.options = options;
        self.skip = false;
        next(null, self);
    };

    async.waterfall(
        [
            obj,
            cacheRetrieve,
            execLocHistory,
            cacheSave
        ], function (err, self, results) {
            callback(results);
        }
    );

    function execLocHistory(self, data, next) {
        if (self.skip === true) {
            next(null, self, data);
        } else {
            locationHistoryHelper(self.options, function (results) {
                if (results == null || !results.length || results.length == 0) {
                    self.skip = true;
                }
                next(null, self, results);
            });
        }
    }
};

/***
 * Takes in options for history search and creates a hash value for redis
 * @param options
 * @returns {string}
 */
function optionsToHash(options) {

    var historyHash = options.locationId || options.userId + ":";
    historyHash = historyHash + (options.startDate || "0") + "-" + (options.endDate || "4389369600000");
    if (options.query) {
        historyHash = historyHash + options.query;
    }
    var shasum = crypto.createHash("sha1");
    shasum.update(historyHash, 'utf8');
    return "history:" + shasum.digest('hex');
};

/**
 * Function for handling cache retrieval
 * @param self
 * @param next
 */
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
            next(null, self, null);
            return;
        }

        console.log("RedisHit - Retrieved key %s from redis value: %j", self.id, data);
        var result = null;
        data = data.toString();


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

/***
 * Function for handling cache saving
 * @param self
 * @param data
 * @param next
 */
var cacheSave = function(self, data, next) {

    var self = self;
    if (!self.id || !data || self.skip) {
        if (!self.skip) {
            console.warn("Failed caching content\n--Self:%j\n--Data:%j",self.id,data);
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

/***
 * Handles express requests for /group/:id /history/:id and /search/:id
 * Parses input data and returns json to user
 * @param req
 * @param res
 */
exports.searchRouteHandler = function(req, res) {

    var location = req.params.id;
    var startDate = parseInt(req.query.start) || 0;
    var endDate = parseInt(req.query.end) || 4389369600000;
    var query = req.body.query || null;
    var userId = req.session.userId;
    var page = parseInt(req.query.page) || 1;
    console.log("SearchRouteHandler");

    var options = {

        userId: userId,
        locationId: location,
        startDate: startDate,
        endDate: endDate,
        query: query,
        page: page
    };
    console.log("SearchRouteHandler %j", options);

    exports.locationHistory(options, function (results) {

        console.log("SearchRouteHandler results: %j", results);

        var ret = JSON.parse(JSON.stringify(options));
        if (results && results.length) {

            var pageStart = (page - 1) * 50;
            var pageEnd = (page) * 50;
            if (pageEnd > results.length) {
                pageEnd = results.length;
            }
            if (pageStart > results.length) {
                pageStart = 0;
            }
            ret.success = true;
            ret.total = results.length;
            ret.data = results.slice(pageStart, pageEnd);
            res.json(ret);

        } else {
            ret.success = false;
            ret.data = [];
            res.json(ret);
        }
    });

};

/***
 * Returns all the channels
 * @param callback
 */
exports.getAllChannels = function(callback) {

    slackRequest("channels.list", function (err, results) {
        if (!err && results.channels) {

            callback(null, results.channels.map(function (chan) {
                return { locationId: chan.id, name: chan.name };
            }));
        } else {
            callback(err || new Error("Could not retrieve all channels"));
        }
    });
};

/***
 * Joins a channel by name, used by www application
 * @param name
 * @param callback
 */
exports.joinChannel = function joinChannel(name, callback) {

    var config = {
        uri: "channels.join",
        query: {
            token: slackUtil.token(),
            name: name
        }
    };
    console.log("Joining channel: %j", config);

    slackRequest(config, function (err, message) {
        if (!err) {
            console.log("Successfully joining channel:%s because %j", name, message);
            callback(null);
        } else {
            console.log("Failed joining channel:%s because %j", name, err.message);
            callback(err);
        }
    });
};