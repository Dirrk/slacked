/**
 * Created by Derek Rada on 12/1/2014.
 */

// require modules
var async = require('async');
var slackRequest = require('./slackRequest');
var slackWorker = require('./slackWorker');
var slackLiveWorker = require('./slackLiveWorker');
var sqlHelper = require('./slackSqlHelper');
var slackUtil = require('./slackUtil');

var HOURS_12 = 43200000;
var HOURS_4 = 14400000;

var Service;


/**
 * Export this function to start the service
 * Creates a new ServiceRunner and returns that service
 * @param apiToken
 * @returns {*}
 */
function startSlackService(apiToken) {


    if (!apiToken) {
        return null;
    } else {

        Service = new ServiceRunner(apiToken);
        startTasks(Service);
        return Service;
    }
};

function ServiceRunner(apiToken) {

    var self = this;
    self.token = apiToken;

    // hash tables
    self.channelsById = {};
    self.groupsById = {};
    self.usersById = {};
    self.locationsById = {};
    self.me = null;
    self.worker = null;

    var historyWorker = new slackWorker([]);
    historyWorker.on('history', self.handleHistory);
    self.historyWorker = historyWorker;

    self.getLocationsForWorker = function getLocationsForWorker(cb) {

        locationUpdateTask(self, function (err, self, locations) {
            if (!err && locations && locations.length) {
                cb(null, locations);
            } else {
                cb(err || new Error("No data retrieved"));
            }
        });
    };
}

function startTasks(me) {

    if (me) {

        var taskContainer = new TaskContainer(me);

        async.waterfall(
            [
                taskContainer.start,
                authenticateTask, // get userId from slack and ensure it is connecting properly
                userUpdateTask, // Update Users from slack, merge into sql, get list back
                locationUpdateTask, // Update Locations from slack, merge in sql, get list back
                historyUpdateTask, // Update History from slack
                realTimeMessageTask // Start RTM Service
            ],
            function (err) {
                if (err) {
                    console.error(err);
                }
            }
        );
    }
};

function TaskContainer(selfObject) {

    var container = this;
    container.self = selfObject;
    container.start = function (next) {
        next(null, container.self);
    };
};

function authenticateTask(self, next) {

    var self = self;

    if (self.me === null) {

        var options = {
            uri: 'auth.test',
            query: {
                token: self.token
            }
        };

        slackRequest(options, function (err, data) {

            if (err) {
                console.log("Could not authenticate zombie user");
                next(err);
            } else {
                self.me = {
                  userId: data.user_id
                };
                next(null, self);
            }
        });

    } else {
        next(null, self);
    }
};

function userUpdateTask(self, next) {


    var self = self;

    var config = {
        uri: "users.list",
        query: {
            token: self.token
        }
    };

    slackRequest(config, function (err, data) {

        if (!err && data.members) {

            var tmp = slackUtil.mergeObjectsById(self.usersById, parseUserData(data));
            self.usersById = tmp.values;

            if (!tmp.newValues || tmp.newValues.length < 1) {
                next(null, self);
            } else {
                sqlHelper.insertUsers(tmp.newValues, function (err) {
                    next(err, self);
                });
            }
        } else {
            next(err || new Error("Data was not in correct format for users.list"));
        }
    });
};


/***
 * Takes paramater self which is the slackService and callback(err, self, locationArray);
 * Downloads locations from slack, updates mysql / downloads from mysql and generates membership statuses
 * Also sets Service.channelsById and Service.groupsById
 * @param self
 * @param next
 */
function locationUpdateTask(self, next) {

    var self = self;

    var locationTask = new TaskContainer(self);

    async.waterfall(
      [
         locationTask.start,
         downloadChannelsFromSlack,
         downloadGroupsFromSlack,
         combineLocationsAndUpdateSQL
      ],
      function (err, self, results) {

          console.log("RESULTS::: %j", results);
          next(err, self, slackUtil.hashToArray(results));
      }
    );
};

// Tasks assiciated with locationUpdateTask
function downloadChannelsFromSlack(self, next) {

    var self = self;

    var config = {
        uri: 'channels.list',
        query: {
            token: self.token
        }
    };
    slackRequest(config, function (err, data) {
        if (!err && data && data.channels) {

            var channels = data.channels.map(parseLocation);
            console.log("locationUpdateTask - Made Channel Request Successfully (channels: %j)", channels);
            next(null, self, channels);

        } else {
            console.error("Data %j", data);
            next(err || new Error("Data is not in correct format"));
        }
    });
};
function downloadGroupsFromSlack(self, channels, next) {

    var self = self;
    var channels = channels;

    var config = {
        uri: 'groups.list',
        query: {
            token: self.token
        }
    };
    slackRequest(config, function (err, data) {
        if (!err && data && data.groups) {

            var groups = data.groups.map(parseLocation);
            console.log("locationUpdateTask - Made Group Request Successfully (groups: %j)", groups);
            next(null, self, channels, groups);

        } else {
            console.error("Data %j", data);
            next(err || new Error("Data is not in correct format"));
        }
    });
}
function combineLocationsAndUpdateSQL(self, channels, groups, next) {

    var self = self;

    sqlHelper.getAllLocations(function (err, data) {

        if (!err && data && data.length) {

            console.log("locationUpdateTask - combineLocationsAndUpdateSQL - Retrieved all locations");

            var locations = data;
            self.channelsById = parseChannelData(channels, locations);
            self.groupsById = parseGroupData(groups, locations);
            var locationsHashMap = slackUtil.mergeObjectsById(self.locationsById, self.channelsById).values;
            locationsHashMap = slackUtil.mergeObjectsById(locationsHashMap, self.groupsById).values;
            self.locationsById = locationsHashMap;
            console.log("Location HashMap: %j", locationsHashMap);

            sqlHelper.updateLocationsAndMembership(slackUtil.hashToArray(locationsHashMap), function (err) {
                console.log("locationUpdateTask - After updateLocationsAndMemberShip");
                next(err, self, locationsHashMap);
            });

        } else {
            next(err);
        }
    });

};

// historyUpdateTask
function historyUpdateTask(self, locations, next) {

    console.log("historyUpdateTask");

    var self = self;
    var locations = locations;

    var t = setTimeout(
      function () {
          next(new Error("History timed out"));
      }, 15000
    );

    if (locations && locations.length) {

        self.historyWorker.updateLocations(locations);
        self.historyWorker.runHistoryTask(function (err) {
            clearTimeout(t);
            if (err) {
                console.error(err);
            }
            next(null, self, locations);
        });

    } else {
        clearTimeout(t);
        console.warn("Locations were empty %j", locations);
        next(null, self, locations);
    }
};

// RealTimeMessageTask
function realTimeMessageTask(self, locations, next) {

    var self = self;
    var locations = locations;

    if (self.worker != null) {
        next(null, self, locations);
        return;
    }

    startRTM(self, function (err, data) {
        if (!err) {

            var bots = parseBotsData(data.bots);
            var newUsers = slackUtil.mergeObjectsById(self.usersById, bots);

            if (newUsers.newValues  && newUsers.newValues.length > 0) {

                sqlHelper.insertUsers(newUsers.newValues, function (err) {
                   if (!err) {
                       console.log("Successfully inserted bot users");
                   }
                    self.usersById = newUsers.values;
                    next(null, self, locations);
                });
            }
            RTMHandler(null, self, locations, data.url);


        } else {
            next(err);
        }

    });

};

function RTMHandler(err, self, locations, url) {

    if (err) {
        console.error(err);
        throw err;
    } else {
        var config = {
            token: self.token,
            url: url,
            userId: self.me.userId,
            locations: locations,
            retrieveLocations: self.getLocationsForWorker,
            delay: HOURS_4
        };

        self.worker = new slackLiveWorker(config).start();

        // Diagnosiing LiveWorker
        self.worker.on("history", /* handleChannelData */ function (data) {
            console.log("Relieved data from liveworker %j", data);
        });
    }
};
function startRTM(me, callback) {

    var options = {
        uri: "rtm.start",
        query: {
            token: me.token
        }
    };
    slackRequest(options, function (err, data) {
        if (err) {
            callback(err);
        } else if (data && data.url) {
            callback(null, data);
        } else {
            callback(new Error("Data was not in correct format"));
        }
    });
};

// Parsers
function parseBotsData(data) {
    var ret = {};
    for (var i = 0; i < data.length; i++) {
        ret[data[i].id] = { userId: data[i].id, name: data[i].name };
    }
    return ret;
};
function parseGroupData(data, locations) {

    var ret = {};

    // console.log("ParseGroupData: dataFromSlack: %j \n\t\t dataFromSQL: %j", data, locations);
    // Go through new groups from slack and add them
    for (var i = 0;i < data.length; i++) {
        ret[data[i].locationId] = data[i];
    }
    // console.log("ParseGroupData - AfterFirstRun: dataFromSlack: %j \n\t\t dataFromSQL: %j \n\t\t returnData: %j", data, locations, ret);
    // Go through groups from sql and update / add them
    for (var i = 0;locations && locations.length && i < locations.length; i++) {

        if (ret[locations[i].locationId]) {
            ret[locations[i].locationId].lastIndex = locations[i].lastIndex;

        } else if (!locations[i].isChannel) {
            locations[i].members = [];
            ret[locations[i].locationId] = locations[i];
        }
    }
    console.log("ParseGroupData - AfterSecondRun: dataFromSlack: %j \n\t\t dataFromSQL: %j \n\t\t returnData: %j", data, locations, ret);

    return ret;
};
function parseChannelData(data, locations) {

    var ret = {};
    for (var i = 0;i < data.length; i++) {
        var found = false;
        for (var j = 0; locations && locations.length && j < locations.length && !found; j++) {
            if (data[i].locationId == locations[j].locationId) {
                locations[j].members = data[i].members;
                ret[data[i].locationId] = locations[j];
                found = true;
            }
        }
        if (!found && data[i].isMember == true && data[i].isChannel) {
            ret[data[i].locationId] = { locationId: data[i].id, lastIndex: null, isChannel: true, name: data[i].name, members: data[i].members || [] };
        }
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
function parseLocation(data) {
    return {
        locationId: data.id,
        name: data.name,
        lastIndex: "",
        members: data.members || [],
        isChannel: data.is_channel || false,
        isMember: data.is_member
    };
};


ServiceRunner.prototype.handleHistory = function (data) {

    var self = this;
    console.log("History received: " + JSON.stringify(data));

    logChannelEvents(data.data, function (completed) {

        if (completed) {
            updateIndex.call(self, data.location, data.lastIndex);
        }
    });
};

/***
 * Older handleChannel Data
 * @param data
 */
function handleChannelData(data) {

    var self = Service;

    console.log("History received: " + JSON.stringify(data));

    logChannelEvents(data.data, function (completed) {

        var currentChannel = data.location;
        if (completed === true) {

            // Change local index and store in sql
            if (!self.locationsById[currentChannel]) {
                console.log("New channel was sent to handle Channel data without being in the index %s", currentChannel);
                newLocationFound(self, currentChannel, function (err) {
                    if (err || !self.locationsById[currentChannel]) {
                        console.error(err || new Error("Channel found but was not added"));
                    } else {
                        self.locationsById[currentChannel].lastIndex = data.lastIndex;
                        sqlHelper.updateIndex(currentChannel, data.lastIndex);
                    }
                });
            } else {
                console.log("Channel found!");
                self.locationsById[currentChannel].lastIndex = data.lastIndex;

                sqlHelper.updateIndex(currentChannel, data.lastIndex);
            }

        } else {
            console.warn("Couldn't store data, did not update index for channel " + currentChannel);
        }
    });
};

function updateIndex(channel, index) {

    var self = this;

    if (!self.locationsById[channel]) {
        console.log("New channel was sent to handle Channel data without being in the index %s", channel);
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

function handleNewLocation(data) {
    console.log(data);
};

/***
 * Logs channel events from data.  Callback with true or false determined from the success of the sql status update
 * @param data
 * @param cb
 */
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


exports.start = startSlackService;
