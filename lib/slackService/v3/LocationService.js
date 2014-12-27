/**
 * Created by Derek Rada on 12/27/2014.
 */

var slackUtil = require('./slackUtil');
var EventEmitter = require('events').EventEmitter;
var async = require('async');
var SlackRequest = require('./slackRequest');
var sqlHelper = require('./slackSqlHelper');
var util = require('util');


util.inherits(LocationService, EventEmitter);
function LocationService() {

    EventEmitter.call(this);

    var self = this;

    self.on("update", self.handleUpdateRequest.bind(self));
};


LocationService.prototype.handleUpdateRequest = function () {

    var self = this;

    async.series(
        [
            self.downloadChannelsFromSlack.bind(self),
            self.downloadGroupsFromSlack.bind(self)
        ],
        function (err, results) {
            if (!err) {
                self.combineLocationsAndUpdateSQL.call(self, results[0], results[1], function (err, locations) {
                    self.emit("locations", locations);
                });
            } else {
                self.emit("error", err);
            }
        }
    )
};

LocationService.prototype.downloadChannelsFromSlack = function (next) {

    if (!next) {  next = function (err) { console.error(err)}; }

    SlackRequest('channels.list', function (err, data) {
        if (!err && data && data.channels) {

            var channels = data.channels.map(slackUtil.parseLocation);
            console.log("locationUpdateTask - Made Channel Request Successfully (channels: %j)", channels);
            next(null, channels);

        } else {
            console.error("Data %j", data);
            next(err || new Error("Data is not in correct format"));
        }
    });
};
LocationService.prototype.downloadGroupsFromSlack = function(next) {

    if (!next) {  next = function (err) { console.error(err)}; }

    SlackRequest('groups.list', function (err, data) {
        if (!err && data && data.groups) {

            var groups = data.groups.map(slackUtil.parseLocation);
            console.log("locationUpdateTask - Made Group Request Successfully (groups: %j)", groups);
            next(null, groups);

        } else {
            console.error("Data %j", data);
            next(err || new Error("Data is not in correct format"));
        }
    });
};
LocationService.prototype.combineLocationsAndUpdateSQL = function (channels, groups, callback) {

    sqlHelper.getAllLocations(function (err, data) {

        if (!err && data && data.length) {

            console.log("locationUpdateTask - combineLocationsAndUpdateSQL - Retrieved all locations");

            var locations = data;
            var channelsById = slackUtil.parseChannelData(channels, locations);
            var groupsById = slackUtil.parseGroupData(groups, locations);

            var locationsHashMap = slackUtil.mergeObjectsById({}, channelsById).values;
            locationsHashMap = slackUtil.mergeObjectsById(locationsHashMap, groupsById).values;

            var locationsById = locationsHashMap;
            console.log("Location HashMap: %j", locationsHashMap);

            sqlHelper.updateLocationsAndMembership(slackUtil.hashToArray(locationsHashMap), function (err) {
                console.log("locationUpdateTask - After updateLocationsAndMemberShip");
                callback(err, locationsHashMap);
            });

        } else {
            callback(err);
        }
    });

};

module.exports = LocationService;