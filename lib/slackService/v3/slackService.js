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

function SlackService() {

    var self = this;

    self.usersById = {};
    self.locationsById = {};
    self.locService = new LocationService();
    self.worker = new SlackLiveWorker();

    // Setting up Handlers for worker
    setupHandlers.call(self);

    // Setting up Handler for locService
    self.locService.on("locations", function (locations) {
        self.locationsById = locations;
        self.worker.updateLocations.call(self.worker, slackUtil.hashToArray(locations));
        self.worker.runHistoryTask.call(self.worker);
    });

    // Call these in order
    async.series(
        [
            self.userUpdateTask.bind(self), // Download Users
            self.locationUpdateTask.bind(self), // Download Locations
            self.startLiveTask.bind(self) // Start worker(locations)
        ]
    );
    // Setup Timers to refresh data
    setInterval(self.locationUpdateTask.bind(self), HOURS_4);
    setInterval(self.userUpdateTask.bind(self), HOURS_12);
};

// Public Methods
SlackService.prototype.startLiveTask = function startLiveTask(next) {

    var self = this;

    if (!next) {  next = function (err) { if (err) { console.error(err)}; } }

    async.series(
        [
            self.worker.getLiveUrl.bind(self.worker),
            self.worker.startLiveSocket.bind(self.worker)
        ],
        function (err, results) {
            if (!err && results && results.length && results[0]) {
                console.log("Bots :%j",results[0].bots);
                botHandler.call(self, results[0].bots);
            } else {
                console.log("Data after going live %j", results);
            }
            next(err);
        }
    );
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
SlackService.prototype.locationUpdateTask = function (next) {

    var self = this;
    self.locService.emit('update');
    if (next) {
        next();
    }
};

// Private Methods
function setupHandlers () {

    "use strict";
    var self = this;
    var worker = self.worker;

    // History (group / channel / history)
    worker.on('history', handleHistory.bind(self));

    // Error from worker
    worker.on('error', handleError.bind(self));

    // New location (group / channel)
    worker.on('location', handleLocation.bind(self));
};

// Handlers
function handleHistory(data) {

    var self = this;
    console.log("History received: " + JSON.stringify(data));

    logChannelEvents(data.data, function (completed) {

        if (completed) {
            updateIndex.call(self, data.location, data.lastIndex);
        }
    });
};

function handleError(err) {

    var self = this;

    console.warn("Worker stopped for an unknown reason");
    console.error(err || new Error("Error thrown to handleError was null"));

    self.worker.stop(
        function () {
            console.log("Worker stopped\nCreating new worker");
            // Creating new Worker
            self.worker = new SlackLiveWorker(slackUtil.locationsToArray(self.locationsById));
            // Recreate Listeners
            setupHandlers.call(self);
        }
    );
};

function handleLocation(data) {
    console.log(data);
};

function botHandler(inbots) {

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
    console.log("Logging channel data: %j", data);

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

    if (!channel || !channel.length || !channel.length >= 8) {
        console.error("Channel was invalid %j", channel);
        throw new Error("Channel was not in correct format and should not be updated");
        return;
    }

    if (!self.locationsById[channel]) {

        // How would this happen?

        console.log("New channel was sent to handle Channel data without being in the index %s", channel);

        // TODO REFACTOR THIS
        newLocationFound.call(self, channel, function (err) {
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
function newLocationFound(locationId, next) {

    var self = this;

    if (!self || !locationId || !locationId || locationId.length < 8) {
        next(new Error("Service and/or location were not sent to add the newLocations"));
        return;
    }

    getLocationInformation.call(self, locationId, function (err, info) {

        if (!err || !info || !info.length || !info.length < 1) {
            sqlHelper.updateLocationsAndMembership(info, function (err) {
               next(err);
            });
        } else {
            next(null);
        }
    });
};
function getLocationInformation(locationId, cb) {

    var self = this;
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
            cb(err);

        } else {

            if (locationId.charAt(0) === 'G') {

                if (data && data.groups && data.groups.length) {

                    var newGroups = slackUtil.mergeObjectsById(self.locationsById, slackUtil.parseGroupData(data.groups.map(slackUtil.parseLocation)));
                    self.locationsById = newGroups.values;

                    if (newGroups.newValues && newGroups.newValues.length > 0) {
                        console.log("Found new groups %j", newGroups.newValues);
                        cb(null, newGroups.newValues);
                    } else {
                        console.warn("No new groups found even after getting notification ofa new group(%s)\nGroupsRecieved: %j\nPreviousGroups: %j",locationId,data.groups,self.groupsById);
                        cb(null, []);
                    }
                }
                else {
                    console.warn("No groups from slackApi %j", data);
                    cb(null, []);
                }
            } else if (data.channel) {

                var chan = slackUtil.parseLocation(data.channel);
                if (!self.locationsById[chan.locationId]) {
                    self.locationsById[chan.locationId] = chan;
                }
                cb(null, [chan]);

            } else {
                console.warn("No channels were retrieved from slackApi %j", data);
                cb(new Error("Unexpected locationId or no data from channel"));
            }
        }
    });
};


module.exports = SlackService;
