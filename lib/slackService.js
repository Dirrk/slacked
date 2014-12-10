/**
 * Created by Derek Rada on 12/1/2014.
 */

// require modules
var async = require('async');
var slackRequest = require('./slackRequest');
var slackWorker = require('./slackWorker');
var util = require('util');
var sqlUtil = require('./sqlUtil');


var channels = [];
var users = [];
var profiles = [];
var groups = [];
var allChannels = [];
var site = null;
var token =  ""; // Token for default user
var bots = [];

// Initialize service
//  fetch channels list, add new channels if needed
//  fetch user list, add users if needed
//  define channels to listen to from default user and start Worker
//  retrieve private groups list and start Worker

function startSlackService() {

    try {
        if (global.appConfig.debug) {
            site = "gannettdigital";
            token = "SLACK_TOKEN";
            channels = [{ "id": "C033NTT94", "name": "test-test" }];
            users = [{ "id": "U02HA00AX", "name": "Derek Rada"}];
        } else {
            setupSlackService();
        }
    } catch (e) {
        setupSlackService();
    }


    async.series([
                     fetchProfiles,
                     fetchChannels,
                     fetchUserList,
                     startChannelService,
                     fetchGroups,
                     startGroupService
                 ],
                 function (err, results) {

                     console.log(results[1]);
                     console.log(results[2]);

                 }
    );
};


function setupSlackService() {

    if (global.appConfig) {

        // TODO parse config and set the values

    } else {
        console.log("No config loaded");
        process.exit(-1);
    }

}

function fetchChannels(callback) {

    var url = "https://" + site + ".slack.com/api/channels.list?exclude_archived=1&token=" + token;
    slackRequest(url, function (err, results) {

        if (err) {
            console.error(err);
        } else {
            console.log("Retrieved " + results.channels.length + " channels");
        }

        // Filter channels so we only get the data that was required
        allChannels = filterChannels(results.channels);
        var override = true;

        // Decide how we will determine if we need to add a channel to the list of subscribed channels
        // zombie == bot if the default user is in the channel it is always monitored.  Even after the user leaves, until its manually removed
        // profiles == parses profiled users for new channels they join but does not override the subscription if it was disabled by someone previously
        // all == parses all channels and stores all data
        if (global.appConfig.channelService == "profiles") {

            channels = profileToChannelList();
            override = false;

        } else if (global.appConfig.channelService == "all") {

            channels = allChannels;

        } else { // zombie is default
            channels = zombieChannelList();
        }

        updateSubscribedChannelsToSQL(override, channels, function (err) {
            if (err) {
                console.log("Error Subscribing Channels to SQL");
                console.error(err);
            } else {

                getSubscribedChannelsFromSQL(function (err1, subscriptions) {
                    if (err1) {
                        console.log("Error getting subscription List");
                        console.error(err1);
                    } else {
                        channels = subscriptions;
                        callback(null, subscriptions);
                    }
                });
            }
        });
    });
}

function fetchUserList(callback) {

    var url = "https://" + site + ".slack.com/api/users.list?token=" + token;

    slackRequest(url, function (err, results) {

        if (err) {
            console.error(err);
        } else {
            console.log("Retrieved " + results.members.length + " users");
        }
        users = filterUsers(results.members);
        sqlUtil.addUsersToDB(users, function (err) {
            if (err) { console.error(err); }
           callback(null, users);
        });
    });
}

// isMember is attached to each channel.  What I would like to do is separate my account from this main account and create an empty user that will join all the subscribed channels making it incredibly easy
function filterChannels(inData) {

    var ret = [];
    for(var i = 0; i < inData.length; i++) {
        var tmp = {
            locationId: inData[i].id,
            name: inData[i].name,
            lastIndex: "",
            members: inData[i].members,
            isChannel: inData[i].is_channel,
            isMember: inData[i].is_member
        };
        ret.push(JSON.parse(JSON.stringify(tmp)));
    }
    return ret;
}


function filterUsers(inData) {

    var ret = [];
    for(var i = 0; i < inData.length; i++) {
        var tmp = {
            userId: inData[i].id,
            name: inData[i].real_name || inData[i].name
        };
        ret.push(JSON.parse(JSON.stringify(tmp)));
    }
    return ret;
}

function startChannelService(callback) {

    var config = {

        site: site,
        default: true,
        token: token,
        retrieveChannels: function (cb) { cb(null, channels); },
        delay: 120000
    };

    var channelWorker = new slackWorker(config).start();

    channelWorker.on("history", handleChannelData);

    channelWorker.on("bot", handleBotEvent);

    callback(null);

}

function fetchGroups(callback) {
    callback(null);
}

function startGroupService(callback) {
    callback(null);
}


function fetchProfiles(callback) {

    if (global.appConfig.debug) {
        profiles[0] = {
            "username": "drada",
            "userId": "U02HA00AX",
            "groups": [],
            "token": "xoxs-2160115660-2588000371-2588000405-589497a63b"
        };
    }
    callback(null);
}

// Channel History Data
function handleChannelData(data) {

    console.log("History received: " + JSON.stringify(data));

    logChannelEvents(data.data, function (completed) {

        var currentChannel = data.location;
        if (completed === true) {

            // Change local index and store in sql
            for (var i = 0; i < channels.length; i++) {

                if (channels[i].locationId == currentChannel) {
                    channels[i].lastIndex = data.lastIndex;
                    i = channels.length;
                }
            }
            sqlUtil.updateIndex(currentChannel, data.lastIndex);

        } else {
            console.log("Couldn't store data, did not update index for channel " + currentChannel);
        }



    });

};

/***
 * event('bot') data = { userId: "botID", name: "displayName" }
 * @param data
 */
function handleBotEvent(data) {

    if (bots[data.userId] !== true) {
        bots[data.userId] = true;
        sqlUtil.addUsersToDB(data, function(err) {
            console.log("Added bot to db");
        });
    }
};


// Used for generation of channel list to subscribe to based off of each profile.  This gets called if the default_user is not a dedicated slacker bot.
function profileToChannelList() {

    var channelList = getAllChannelsFromUserProfiles(allChannels, profiles);
    return channelList;

    /*
    getChannelDetails(channelList, function (err, data) {
        // in detail [ { id: "blah", "" } ]
        cb(data);
    });
    */

    // call to redis and get data about those channels
    // call back
    //cb(newChannelList);
};

/***
 * ZombieChannelList parses allChannels for channels where the default user isMember
 * @returns array[] of channels where isMember=true
 */
function zombieChannelList() {

    var channelList = allChannels.filter(function (elem) {
        return elem.isMember;
    });
    return channelList;
};




// This gets the fake details currently..  What it will do is SELECT channelId, lastIndex, name where isChannel=1 AND subscribed=1
function getSubscribedChannelsFromSQL(callback) {

    sqlUtil.getSubscribedChannels(function (err, data) {
       if (err) {
           console.log("Error getting subscriptions");
           console.error(err);
           callback(null, null);
       } else {
           console.log("Retrieved data from SQL");
           console.log(data);
           callback(null, data);
       }
    });

}

// Call SQL with channel data
/***
 * Merges Channels between slack and subscription.  Override is only true when zombie is the ChannelService type
 * @param override
 * @param chans
 * @param callback
 */
function updateSubscribedChannelsToSQL(override, chans, callback) {

    var chans = chans || [];
    var ret = [];
    for (var i = 0; i < chans.length; i++) {
        ret.push([ chans[i].locationId, chans[i].name, 1, 1]);
    }

    sqlUtil.subscribeToLocation(override, ret, function (err) {
       callback(err);
    });
}

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
        sqlUtil.addHistoryToSQL(data, function(err, success) {
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

function getAllChannelsFromUserProfiles(chan, profiles) {

    var tmpChannels = chan.slice(0);
    var ret = [];
    for (var i = 0; i < profiles.length; i++) {

        var a = getActiveChannelsForUser(profiles[i].userId, tmpChannels, ret);
        ret = a.ret;
        tmpChannels = a.channels;
    }
    return ret;
}

// call getActiveChannelsForUser (user ID, channels, retValue)
function getActiveChannelsForUser(userId, chans, ret) {

    for (var i = chans.length - 1; i >= 0;i--) {
        if (binaryIndexOf.call(chans[i].members, userId) >= 0) {
            // found channels.length
            ret.push(chans[i]);
            console.log("Found channel: " + chans[i].locationId + " " + chans[i].name);
            chans.slice(i,1);
        }
    }
    return { ret: ret, channels: chans };
}


/**
 * Performs a binary search on the host array. This method can either be
 * injected into Array.prototype or called with a specified scope like this:
 * binaryIndexOf.call(someArray, searchElement);
 *
 * @param {*} searchElement The item to search for within the array.
 * @return {Number} The index of the element which defaults to -1 when not found.
 */
function binaryIndexOf(searchElement) {
    'use strict';

    var minIndex = 0;
    var maxIndex = this.length - 1;
    var currentIndex;
    var currentElement;
    var resultIndex;

    if (this.length == 0) {
        return -1;
    }

    while (minIndex <= maxIndex) {
        resultIndex = currentIndex = (minIndex + maxIndex) / 2 | 0;
        currentElement = this[currentIndex];

        if (currentElement < searchElement) {
            minIndex = currentIndex + 1;
        }
        else if (currentElement > searchElement) {
            maxIndex = currentIndex - 1;
        }
        else {
            return currentIndex;
        }
    }

    return ~maxIndex;
}

exports.start = startSlackService;

exports.getChannels = function getChannels() {
    return channels;
};