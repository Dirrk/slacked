/**
 * Created by Derek Rada on 12/1/2014.
 */

// require modules
var async = require('async');
var slackRequest = require('./slackRequest');
var SlackLiveWorker = require('./slackLiveWorker');
var sqlHelper = require('./slackSqlHelper');
var slackUtil = require('./slackUtil');
var LocationService = require('./LocationService');

var HOURS_12 = 43200000;
var HOURS_4 = 14400000;

var Service;

function SlackService() {

    var self = this;

    self.usersById = {};
    self.locationsById = {};
    self.locService = new LocationService();
    self.worker = new SlackLiveWorker();
    self.userUpdateTask.call(self);

    self.locService.emit("update");

    self.locService.on("locations", function (locations) {
        self.locationsById = locations;
        self.worker.updateLocations.call(self.worker, slackUtil.hashToArray(locations));
        self.worker.runHistoryTask.call(self.worker);
    });

    async.series(
        [
            self.worker.getLiveUrl.bind(self.worker),
            self.worker.startLiveSocket.bind(self.worker)
        ],
        function (err, results) {
            if (!err && results && results.length && results[0]) {
                console.log(results[0].bots);
                self.botHandler.call(self, results[0].bots);
            } else {
                console.log("Data after going live %j", results);
            }
        }
    );

    self.worker.on('history', self.handleHistory.bind(self));

    // Download Users
    // Download Locations
    // Start worker(locations)
    // Start Timer to periodically get locations and update worker

}

SlackService.prototype.botHandler = function (inbots) {

    var self = this;

    var bots = parseBotsData(inbots);
    var newUsers = slackUtil.mergeObjectsById(self.usersById, bots);

    if (newUsers.newValues  && newUsers.newValues.length > 0) {

        sqlHelper.insertUsers(newUsers.newValues, function (err) {
            if (!err) {
                console.log("Successfully inserted bot users");
            }
            self.usersById = newUsers.values;
        });
    }
};

SlackService.prototype.userUpdateTask = function(next) {

    var self = this;
    if (!next) {  next = function (err) { if (err) { console.error(err)}; } }

    slackRequest("users.list", function (err, data) {

        if (!err && data.members) {

            var tmp = slackUtil.mergeObjectsById(self.usersById, parseUserData(data));
            self.usersById = tmp.values;

            if (!tmp.newValues || tmp.newValues.length < 1) {
                next(null);
            } else {
                sqlHelper.insertUsers(tmp.newValues, function (err) {
                    next(err);
                });
            }
        } else {
            next(err || new Error("Data was not in correct format for users.list"));
        }
    });
};
SlackService.prototype.locationUpdateTask = function () {

    var self = this;
    self.locService.emit('update');
};

SlackService.prototype.handleHistory = function (data) {

    var self = this;
    console.log("History received: " + JSON.stringify(data));

    logChannelEvents(data.data, function (completed) {

        if (completed) {
            updateIndex.call(self, data.location, data.lastIndex);
        }
    });
};

SlackService.prototype.handleLocation = function (data) {
    console.log(data);
};

// Parsers
function parseBotsData(data) {
    var ret = {};
    for (var i = 0; i < data.length; i++) {
        ret[data[i].id] = { userId: data[i].id, name: data[i].name };
    }
    return ret;
};
function parseUserData(data) {
    var ret = {};
    for (var i = 0; i < data.length; i++) {
        ret[data[i].id] = { userId: data[i].id, name: data[i].name };
    }
    return ret;
};


// Helpers for history
function logChannelEvents(data, cb) {

    // perform sql insert
    // insert ROWS into db.channelhistory
    console.log("Logging channel data");
    console.log(data);

    try {
        sqlHelper.addHistoryToSQL(data, function(err, success) {
            if (err) {
                console.error(err);
                cb(false);
            } else if (!success) {
                console.log("Unsuccessfully logged data");
                cb(false);
            } else {
                console.log("Successfully logged channel events");
                cb(true);
            }
        });
    } catch (e) {
        console.log("Error Adding History to SQL");
        console.error(e);
    }
};
function updateIndex(channel, index) {

    var self = this;

    if (!self.locationsById[channel]) {

        console.log("New channel was sent to handle Channel data without being in the index %s", channel);

        // TODO REFACTOR THIS
        newLocationFound(self, channel, function (err) {
            if (err || !self.locationsById[channel]) {
                console.error(err || new Error("Channel found but was not added"));
            } else {
                self.locationsById[channel].lastIndex = index;
                sqlHelper.updateIndex(channel, index);
            }
        });
    } else {
        console.log("Channel found!");
        self.locationsById[channel].lastIndex = index;

        sqlHelper.updateIndex(channel, index);
    }

};

// Helpers for location
function newLocationFound(self, locationId, next) {

    var self = self;

    if (!self || !locationId || !locationId || locationId.length < 8) {
        next(new Error("Service and/or location were not sent to add the newLocations"), self);
        return;
    }

    getLocationInformation(null, self, locationId, function (err, self, info) {
        if (!err || !info || !info.length || !info.length < 1) {

            sqlHelper.updateLocationsAndMembership(info, function (err) {
               next(err);
            });
        } else {
            next(null, self);
        }

    });

};
function getLocationInformation(self, locationId, cb) {

    var self = self;
    var locationId = locationId;

    var options = {
        uri: "channels.info",
        query: {
            token: self.token
        }
    };
    if (locationId.charAt(0) == 'G') {
        options.uri = "groups.list";
    } else {
        options.query.channel = locationId;
    }
    slackRequest(options, function (err, data) {
        if (err || !data) {
            console.error("NewLocation was not found in slack using uri: %s channel: %s data returned was \n%j",options.uri,locationId,data);
            cb(err, self);
        } else {

            if (locationId.charAt(0) === 'G') {

                if (data && data.groups && data.groups.length) {

                    var newGroups = slackUtil.mergeObjectsById(self.groupsById, parseGroupData(data.groups.map(parseLocation)));
                    self.groupsById = newGroups.values;
                    self.locationsById = slackUtil.mergeObjectsById(self.locationsById, self.groupsById).values;
                    if (newGroups.newValues && newGroups.newValues.length > 0) {
                        console.log("Found new groups %j", newGroups.newValues);
                        cb(null, self, newGroups.newValues);
                    } else {
                        console.warn("No new groups found even after getting notification ofa new group(%s)\nGroupsRecieved: %j\nPreviousGroups: %j",locationId,data.groups,self.groupsById);
                        cb(null, self, []);
                    }
                }
                else {
                    console.warn("No groups from slackApi %j", data);
                    cb(null, self, []);
                }
            } else if (data.channel) {

                var chan = parseLocation(data.channel);
                if (!self.channelsById[chan.locationId]) {
                    self.channelsById[chan.locationId] = chan;
                }
                if (!self.locationsById[chan.locationId]) {
                    self.locationsById[chan.locationId] = chan;
                }
                cb(null, self, [chan]);

            } else {
                console.warn("No channels were retrieved from slackApi %j", data);
                cb(new Error("Unexpected locationId or no data from channel"), self);
            }
        }
    });
};



module.exports = SlackService;
