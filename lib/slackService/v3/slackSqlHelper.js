/**
 * Created by Derek Rada on 12/23/2014.
 */

var sqlUtil = require('../../sqlUtil');
var async = require('async');
var util = require('util');

function callError(cb, err) {
    if (err && err.stack) {
        cb(err);
    } else {
        cb(new Error(err || "Unknown sql error"));
    }
};

/***
 * Inserts Users into db, on duplicate it updates name
 * @param users
 * @param callback
 */
exports.insertUsers = function(users, callback) {

    if (users && users.length && users.length > 0) {

        var userArray = convertUserDataToArray(users);
        sqlUtil.getConnection(function (conn) {

            if (conn) {

                var sqlQuery = "INSERT INTO user (userId, name) VALUES ? ON DUPLICATE KEY UPDATE name = values(name)";

                var query = conn.query(sqlQuery, [userArray], function (err) {
                    conn.release();

                    callback(err);
                    if (global.appConfig.debug) {
                        console.log("Added users to db: %s", query.sql);
                    }
                });

            } else {
                callError(callback);
            }
        });

    } else {
        callError(callback, "Users in wrong format")
    }
};

exports.getAllLocations = function(cb) {

    sqlUtil.getConnection(function (conn) {
        if (conn) {

            var sqlQuery = "SELECT * FROM locations WHERE subscribed=1;";
            var query = conn.query(sqlQuery, function (err, data) {
                conn.release();
                if (err) {
                    console.log(query.sql);
                    callError(cb, err);
                } else {
                    if (global.appConfig.debug) {
                        console.log("Downloaded data for subscribed channels %j", data);
                        console.log(data);
                    }
                    cb(null, data);
                }
            });
        } else {
            callError(cb);
        }
    });

};

exports.updateLocationsAndMembership = function(locations, cb) {

    if (locations && locations.length && locations.length > 0) {

        console.log("updateLocationsAndMembership :: %j", locations);

        insertAndMergeLocations(locations.slice(0), function (err) {

            if (err) {
                console.error(err);
                callError(cb, err);
                return;
            }
            async.eachSeries(
              locations,
              insertMembershipData,
              function (err) {
                  console.log("Returned From Series");
                  cb(err);
              }
            );
        });

    } else {
        console.warn("Locations was empty or null: %j", locations);
        callError(cb);
    }
};

function insertAndMergeLocations(locations, cb) {

    if (locations && locations.length && locations.length > 0) {

        var sqlQuery = "INSERT INTO locations (locationId, name, isChannel, subscribed) VALUES ? ON DUPLICATE KEY UPDATE subscribed = values(subscribed)";

        sqlUtil.getConnection(function (conn) {

            if (conn) {

                var query = conn.query(sqlQuery, [convertLocationsDataToArray(locations)], function (err, data) {

                    conn.release();
                    if (err) {
                        console.error("Failed to subscribe to locations: %s", query.sql);
                        callError(cb, err);
                    } else {

                        if (global.appConfig.debug) {
                            console.log("InsertedLocations: %j", data);
                        }
                        cb(null);
                    }
                });
            } else {
                console.log("SubscribeToLocation :: Could not obtain a sql connection");
                callError(cb);
            }
        });


    } else {
        console.warn("Locations was emptyu or null: %j", locations);
        callError(cb);
    }
};

function insertMembershipData(location, next) {

    if (location.locationId && location.locationId.length && location.locationId.length >= 8 && location.members && location.members.length > 0) {
        var users = location.members.toString();
        var locationId = location.locationId;
        console.log("insertMembershipData location: %j", location);

        sqlUtil.getConnection(
            function (conn) {
                if (conn) {

                    var sqlQuery = "CALL userMembership(?,?)";
                    var query = conn.query(sqlQuery, [locationId, users], function (err, data) {
                        if (err) {
                            console.warn("Error running sql command: %s", query.sql);
                            console.error(err);
                        }
                        conn.release();
                        console.log("Inserting membership for location: %s with users: %s\nsql: %s",locationId,users,query.sql);
                        console.log("Return value from inserting in membership: %j", data);
                        next(null); // dont care because it can get updated later
                    });
                } else {
                    next(null); // dont care if this fails as its going to crash everything anyhow
                }
        });
    } else {
        console.warn("There were no users in location %s", location.name);
        next(null);
    }
};


/**
 *    addHistoryToSQL(data)
 *    @param {array} data - The data to insert ex: [{"dateTimeStamp":1417559852000,"location":"C033NTT94","user":"U02HA1ZM3","text":"boom"},{"dateTimeStamp":1417559844000,"location":"C033NTT94","user":null,"text":"<@U02HA1ZM3|sethdozier> has joined the channel"}]
 *    @param {function} callback - Function to call back to using standard js error first callback
 *
 *    @return callback(err, success)
 *    Convert data from JSON data to Array of Arrays in the order locationId, userId, msgStamp, msg
 *    Execute query
 *    If successful callback(null, true)
 *    else callback(null, false)
 **/
exports.addHistoryToSQL = function addHistoryToSQL(data, callback) {

    var newHistoryQuery = "INSERT INTO slacked.channel_history (locationId, userId, msgStamp, msg) VALUES ?";
    console.log("Inserting data into history table");

    if (data && util.isArray(data)) {
        // convertdata
        var arr = convertHistoryDataToArray(data);

        // open sql connection
        sqlUtil.getConnection(function (conn) {

            if (conn) { // execute query
                var query = conn.query(newHistoryQuery, [arr], function (err) {
                    conn.release();

                    if (err) {
                        console.log("Found error on connection query %s", query.sql);
                        callback(err, false);
                    } else {
                        console.log("AddedHistory to SQL %s", query.sql);
                        callback(null, true);
                    }
                });
            } else {
                // no connection
                console.log("No Connection to sql found");
                callback(null, false);
            }
        });
    } else {
        console.log("History data was not in correct format\nHistoryData: %j", data);
        callback(null, false);
    }
};

exports.updateIndex = function updateIndex(locationId, lastIndex) {

    var locationId = locationId,
        lastIndex = lastIndex || null;

    if (lastIndex == null) {
        console.log("No index provided, will not update index for " + locationId);
        return;
    }
    sqlUtil.getConnection(function (conn) {
        if (conn) {
            var updateIndexQueryString = "UPDATE locations SET lastIndex = ? WHERE locationId = ?";
            var query = conn.query(updateIndexQueryString, [lastIndex, locationId], function (err, results) {
                conn.release();
                if (err) {
                    console.log(query.sql);
                    console.log("Failed updated index in SQL");
                    console.error(err);
                } else {
                    if (global.appConfig.debug) {
                        console.log("Updated index for location: " + locationId + " to " + lastIndex);
                        console.log(results);
                    }
                }
            });
        } else {
            console.log("Couldn't connect to db to update last index of " + locationId);
        }
    });

};


/**

 @function convertHistoryDataToArray(data)
 @data - Array from addHistoryToSQL

 Iterate through Array of JSON
 **/
function convertHistoryDataToArray(data) {

    var ret = [];

    for (var i = 0; i < data.length; i++) {
        ret.push([ data[i].location, data[i].user, data[i].dateTimeStamp, data[i].text]);
    }
    return ret;
}

function convertUserDataToArray(data) {

    var ret = [];

    for (var i = 0; i < data.length; i++) {
        ret.push([ data[i].userId, data[i].name]);
    }
    return ret;
}
function convertLocationsDataToArray(data) {
    var ret = [];
    for (var i = 0; i < data.length; i++) {
        if (data[i].locationId && data[i].locationId.length && data[i].locationId.length >= 8)
        ret.push([ data[i].locationId, data[i].name, data[i].isChannel, 1]);
    }
    return ret;
};
