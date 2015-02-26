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
var slackPluginHandler = require('./slackPluginHandler');

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
        slackPluginHandler.updateLocations(locations);
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
    setInterval(self.locationUpdateTask.bind(self), HOURS_4).unref();
    setInterval(self.userUpdateTask.bind(self), HOURS_12).unref();
};

// Public Methods
/***
 * Starts the processes needed to get the live Worker online
 * Also calls the botHandler because this is the only method to retrieve that data
 * @param next
 */
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

/***
 * Performs an update to the users.list api query in slack and then inserts the new users into sql.users
 * @param next
 */
SlackService.prototype.userUpdateTask = function(next) {

    var self = this;
    if (!next) {  next = function (err) { if (err) { console.error(err)}; } }

    slackRequest("users.list", function (err, data) {

        if (!err && data.members) {

            var tmp = slackUtil.mergeObjectsById(self.usersById, slackUtil.parseUserData(data.members));
            self.usersById = tmp.values;
            console.log("Users downloaded: %j", self.usersById);

            if (!tmp.newValues || tmp.newValues.length < 1) {
                console.log("No new users found: %j", tmp);
                next(null);
            } else {
                // Call Plugin Handler
                slackPluginHandler.updateUsers(self.usersById);

                // Import new values
                sqlHelper.insertUsers(tmp.newValues, function (err) {
                    console.log("Updated users in sql %j", tmp.newValues);
                    next(err);
                });
            }
        } else {
            next(err || new Error("Data was not in correct format for users.list"));
        }
    });
};

/***
 * Requests Location Service for an update
 * @param next
 */
SlackService.prototype.locationUpdateTask = function (next) {

    var self = this;
    self.locService.emit('update');
    if (next) {
        next();
    }
};

// Private Methods
/***
 * Generates the worker handlers
 */
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

    // Away (for keeping the bot active)
    worker.on('away', handleKeepActive);

    // Mark (for marking a private messagae read)
    worker.on('mark', handleMarkMessage);

    // Handle Plugin
    worker.on('other', handleOther);

    // Handle My User
    worker.on('myUser', handleMyUser)

};

// Handlers
/***
 * Handles history data received after updating
 * Takes in channel data from a worker then puts data in sql and updates the locations index in sql
 * @param data
 */
function handleHistory(data) {

    var self = this;
    console.log("History received: " + JSON.stringify(data));

    logChannelEvents(data.data, function (completed) {

        if (completed) {
            updateIndex.call(self, data.location, data.lastIndex);
        }
    });
};

/***
 * Handles errors from worker
 * Tries to gracefully restart worker
 * @param err
 */
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

/***
 * Handles new location from the live worker.  This occurs when the worker receives a channel_joined or group_joined notification meaning they have joined a new location
 * To ensure we collect as much data as possible this process forced the locationUpdateTask to force history and repopulate the channels
 * @param data
 */
function handleLocation(data) {

    var self = this;

    if (self.locationsById[data.locationId]) {
        self.locationsById[data.locationId].isMember = true;
        self.locationsById[data.locationId].members = data.members;
        sqlHelper.updateLocationsAndMembership([self.locationsById[data.locationId]], function (err) {
           if (err) {
               console.error(err);
           } else {
               console.log("Bot joined previously followed location and updated sql membership\n\tLocation: %j", self.locationsById[data.locationId]);
           }
        });
    } else {
        console.log("New location found, performing location update (%j)", data);
        self.locationUpdateTask.call(self);
    }
};

/***
 * Handles when there are bots information availible.  Bots are only given when starting the live service
 * Takes in an array of bots objects and updates sql.user table
 * @param inbots
 */
function botHandler(inBots) {

    var self = this;

    var bots = slackUtil.parseUserData(inBots);
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


/***
 * Handle Other message
 */
function handleOther(message) {

    slackPluginHandler.handler(message);
}


/***
 *
 * handleMyUser
 *
 */
function handleMyUser(message) {
    slackPluginHandler.setSelf(message);
}

/***
 * Call slack for setActive
 */
function handleKeepActive() {

    slackRequest('auth.test', function (err) {
       if (err) {
           console.error(err);
       } else {
           console.log("Stayed active");
       }
    });
}

/***
 * Handles data for marking direct messages as read so there are no emails sent to the bot
 * only warn on error
 */
function handleMarkMessage(message) {

    var options = {
        uri: "im.mark",
        query: {
            channel: message.locationId,
            ts: message.ts
        }
    };
    slackRequest(options, function (err) {
       if (err) {
           console.error(err);
       }
    });
}
/***
 * Inserts channel events into sql.channel_history
 * @param data
 * @param cb
 */
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

/***
 * Updates the locations lastIndex locally and in sql
 * @param channel
 * @param index
 */
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
        self.locationUpdateTask.call(self);

    } else {
        console.log("Channel found!");
        self.locationsById[channel].lastIndex = index;

        sqlHelper.updateIndex(channel, index);
    }

};

module.exports = SlackService;
