/**
 * Created by Derek Rada on 12/1/2014.
 */

var __SLACK_TOKEN__ = "";

exports.token = function () { return __SLACK_TOKEN__ };
exports.setToken = function (token) { __SLACK_TOKEN__ = token; };

// SlackTimeStamp to Javascript Timestamp
exports.slackTStoJSTS = function slackTS2JSTS(stringInput){

    var time = parseFloat(stringInput);
    var newTime = Math.round(time) * 1000;
    return new Date(newTime);
};

exports.locationsToArray = function (data) {
    var chans = data.channels;
    var groups = data.groups;
    var ret = [];
    var chanKeys = Object.keys(chans);
    var groupKeys = Object.keys(groups);

    for (var i = 0; i < chanKeys.length; i++)
    {
        ret.push(chans[chanKeys[i]]);
    }
    for (var j = 0; j < groupKeys.length; j++)
    {
        ret.push(groups[groupKeys[j]]);
    }
    return ret;
};


exports.hashToArray = function hashToArray(obj) {
    var keys = Object.keys(obj) || [];
    var ret = [];
    for (var i = 0; i < keys.length; i++)
    {
        ret.push(obj[keys[i]]);
    }
    return ret;
};


exports.mergeObjectsById = function mergeObjectsById(values, newObjects) {

    var ret = [];
    var newObjsKeys = Object.keys(newObjects);

    newObjsKeys.forEach(function (key) {
        if (!values[key]) {
            values[key] = newObjects[key];
            ret.push(newObjects[key]);
        }
    });
    return { values: values, newValues: ret };
};

exports.parseLocation = function(data) {
    return {
        locationId: data.id,
        name: data.name,
        lastIndex: "",
        members: data.members || [],
        isChannel: data.is_channel || false,
        isMember: data.is_member
    };
};

exports.parseChannelData = function(data, locations) {

    var ret = {};
    console.log("ParseChannelData - BeforeRun: dataFromSlack: %j \n\t\t dataFromSQL: %j \n\t\t returnData: %j", data, locations, ret);

    // Go through channels from slack
    for (var i = 0; data && data.length && i < data.length; i++) {

        var found = false;
        // Go through channels from SQL
        for (var j = 0; locations && locations.length && j < locations.length && !found; j++) {
            if (data[i].locationId == locations[j].locationId) {
                console.log("ParseChannelData - found location: %s", data[i].locationId);
                locations[j].members = data[i].members;
                ret[data[i].locationId] = locations[j];
                found = true;
            }
        }
        if (!found && data[i].isMember == true && data[i].isChannel) {
            console.log("ParseChannelData - adding new channel %j", data[i]);
            ret[data[i].locationId] = { locationId: data[i].locationId, lastIndex: null, isChannel: true, name: data[i].name, members: data[i].members || [] };
        }
    }
    return ret;
};

exports.parseGroupData = function (data, locations) {

    var ret = {};

    // console.log("ParseGroupData: dataFromSlack: %j \n\t\t dataFromSQL: %j", data, locations);
    // Go through new groups from slack and add them
    for (var i = 0; i < data.length; i++) {
        ret[data[i].locationId] = data[i];
    }
    // console.log("ParseGroupData - AfterFirstRun: dataFromSlack: %j \n\t\t dataFromSQL: %j \n\t\t returnData: %j", data, locations, ret);
    // Go through groups from sql and update / add them
    for (var i = 0;  locations && locations.length && i < locations.length; i++) {

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


/***
 * Parses user / bot data
 * @param data
 * @returns {{}}
 */
exports.parseUserData = function(data) {
    var ret = {};
    for (var i = 0; i < data.length; i++) {
        ret[data[i].id] = { userId: data[i].id, name: data[i].name };
    }
    return ret;
};