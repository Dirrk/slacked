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
var allChannels = [];
var token = null; // Token for default user
var bots = [];
var zombieProfile = null;
var groupSubscriptions = {};

// Initialize service
//  fetch channels list, add new channels if needed
//  fetch user list, add users if needed
//  define channels to listen to from default user and start Worker
//  retrieve private groups list and start Worker

function startSlackService(apiToken) {

    setupSlackService(apiToken, function (cont) {

        if (cont === true) {
            async.series([
                             fetchProfiles,
                             fetchChannels,
                             fetchUserList,
                             startChannelService,
                             startGroupService,
                             startTimerService
                         ],
                         function (err, results) {
                             console.log("Successfully started slack service");
                         }
            );
        } else {
            console.log("Could not continue to start the slack service");
        }
    });
};


function setupSlackService(apiToken, callback) {

    if (global.appConfig) {

        var conf = global.appConfig;

        if (conf.token) {
            token = conf.token;
            callback(true);
        } else if (apiToken) {
            token = apiToken;
            callback(true);
        } else {
            getZombieProfile(function (profileToken) {
                console.log(profileToken);
                if (profileToken) {
                    token = profileToken;
                    callback(true);
                } else {
                    callback(false);
                }
            });
        }
    } else {
        if (apiToken) {
            token = apiToken;
            callback(true);
        }
        callback(false);
    }
}
function getZombieProfile(callback) {

    sqlUtil.getProfiles(true, function (profile) {
        if (profile) {
            zombieProfile = profile;
            callback(profile.slackToken);
        } else {
            callback(null);
        }
    });
}


function fetchChannels(callback) {

    var url = "https://api.slack.com/api/channels.list?exclude_archived=1&token=" + token;
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
            // This will work but is not optimal.  It is much easier to control the bots location instead
            channels = profileToChannelList();
            override = false;

        } else if (global.appConfig.channelService == "all") {
            // This will work but probably isn't needed.  But then again why not
            channels = allChannels;

        } else {
            // Zombie is default
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

    var url = "https://api.slack.com/api/users.list?token=" + token;

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

function startTimerService(callback) {

    callback(null);

    var hours_12 = 43200000;
    var hours_4 = 14400000;
    setInterval(function () {

        fetchChannels(function () {
            fetchUserList(function () {
               console.log("12 Hour update complete");
            });
        });
    }, hours_12);

    setInterval(function () {

        fetchProfiles(function () {
            prepareGroups(function () {
                console.log("4 Hour update complete");
            });
        });
    }, hours_4);

}

function startChannelService(callback) {

    var config = {
        default: true,
        token: token,
        retrieveChannels: function (cb) { cb(null, channels); },
        delay: 900000
    };

    var channelWorker = new slackWorker(config).start();

    channelWorker.on("history", handleChannelData);

    channelWorker.on("bot", handleBotEvent);

    callback(null);

}
/***
 *  fetchGroups - Gets groups from a profile and puts them into the profile.  It callsback with null or the profile.
 * @param profile
 * @param callback (profile)
 */
exports.fetchGroups = function fetchGroups(profile, callback) {

    // Currently working on the assumption zombie records everything he is in.
    var url = "https://api.slack.com/api/groups.list?exclude_archived=1&token=" + profile.slackToken;

    slackRequest(url, function(err, message) {

        if (err) {
            console.log("Error requesting groups");
            console.error(err);
            callback(profile);
        } else {

            if (global.appConfig.debug) {
                console.log("Groups(%d) received for user %s",message.groups.length, profile.userId);
                console.log(message);
            }
            var _groups = message.groups;
            profile.groups = _groups.map(filterGroups);
            callback(profile);
        }
    });
}
/***
 * Filters groups for map
 * @param {Object} GroupElement group unfiltered from slackapi {"id":"G034HJWCK","name":"d3crew","is_group":true,"created":1417796130,"creator":"U02H0PB9X","is_archived":false,"members":["U02AB065J","U02H0PB9X","U02HA00AX","U02HA1ZM3","U02HABAQ2","U02HAHRST","U02HASL4L","U02LLJVHV"],"topic":{"value":"","creator":"","last_set":0},"purpose":{"value":"","creator":"","last_set":0}}
 * @returns {Object}
 */
function filterGroups(group) {
    return { locationId: group.id, lastIndex: null, isChannel: false, name: group.name };
}

function startGroupService(callback) {

    var groupWorkers = [];
    prepareGroups(function () {

        console.log("Groups have been preparred");
        console.log(JSON.stringify(groupSubscriptions));

        var gUsers = Object.keys(groupSubscriptions) || [];

        for (var i = 0; i < gUsers.length; i++) {

            var config = {

                default: false,
                userId: groupSubscriptions[gUsers[i]].userId,
                token: groupSubscriptions[gUsers[i]].slackToken,
                retrieveChannels: handleGroupWorkerUpdate,
                delay: 14400000
            };

            groupWorkers[i] = new slackWorker(config).start();
            groupWorkers[i].on('history', handleChannelData);
            groupWorkers[i].on('bots', handleBotEvent);
        }
        callback(null);
    });

        // query profiles from db
        // for each profile find groups
        // sort profiles by number of groups in ascending order and add the zombie profile to the end
        // insert each group into location table updating the userId of the profile that found it.


        // build zombie profile

        // find groups
        // insert each group into location table updating the userId of the zombie profile
}

function prepareGroups(cb) {

    var newProfiles = [];

    async.eachSeries(
        profiles,

        function (profile, next) {

             exports.fetchGroups(profile, function (prof) {
                 newProfiles.push(prof);
                 next();
             });

        }, function (err) {

            if (err) {
                console.error(err);
                callback(null);

            } else {
                updateAndMergeGroups(profiles.slice(0), cb);
            }
     });
}

function updateAndMergeGroups(tmpProfiles, cb) {

    console.log("new profiles have been built with groups");


    if (zombieProfile) {

        exports.fetchGroups(zombieProfile, function (prof2) {
            zombieProfile = prof2;
            tmpProfiles.push(zombieProfile);

            sqlUtil.subscribeToGroups(tmpProfiles, function (data) {
                handleGroupProfiles(data);
                cb(null);
            });
        });

    } else {

        sqlUtil.subscribeToGroups(tmpProfiles, function (data) {
            handleGroupProfiles(data);
            cb(null);
        });
    }
    cb(null);
}

function handleGroupProfiles(groupProfilesArray) {

    console.log("Found group profiles");

    var groupUsers = {};

    for(var i = 0; i < groupProfilesArray.length; i++)
    {
        if (groupUsers[groupProfilesArray[i].userId]) {
            groupUsers[groupProfilesArray[i].userId].groups.push({ locationId: groupProfilesArray[i].locationId, name: groupProfilesArray[i].name, lastIndex: groupProfilesArray[i].lastIndex });
        } else {
            groupUsers[groupProfilesArray[i].userId] = {
                userId: groupProfilesArray[i].userId,
                slackToken: groupProfilesArray[i].slackToken,
                groups: [
                    {
                        locationId: groupProfilesArray[i].locationId,
                        name: groupProfilesArray[i].name,
                        lastIndex: groupProfilesArray[i].lastIndex
                    }
                ]
            }
        }
    }
    groupSubscriptions = groupUsers;
    console.log("Converted GroupProfilesArray into usable data");
}


function handleGroupWorkerUpdate (userId, callback) {

    if (groupSubscriptions[userId] && groupSubscriptions[userId].userId == userId) {

        callback(null, groupSubscriptions[userId].groups);

    } else {
        callback(null, []);
    }
}



function fetchProfiles(callback) {

    // Get the zombie profile
    profiles = [];
    sqlUtil.getProfiles(false, function (profs) {

        if (profs) {

            for (var i = 0; i < profs.length; i++) {
                if (profs[i].isZombie) {
                    zombieProfile = profs[i];
                } else {
                    profs[i].groups = [];
                    profiles.push(profs[i]);
                }
            }
            if (!zombieProfile) {
                buildProfile(true, function(profile) {
                   zombieProfile = profile;
                    callback(null, profiles);
                });
            } else {
                callback(null, profiles);
            }

        } else {
            // If we get here we already have a zombie profile configured it just isn't in the profile db
            buildProfile(true, function (profile) {
                zombieProfile = profile;
                callback(null, []);
            });
        }
    });
}
function buildProfile(zombieToken, callback) {

    var isZombie = false;
    var newToken;
    if (zombieToken === true) {
        isZombie = true;
        newToken = token;
    } else {
        newToken = zombieToken;
    }
    var url = "https://api.slack.com/api/auth.test?token=" + newToken;
    slackRequest(url, function (err, data) {

        if (err) {
            console.log("Error building profile");
            console.error(err);
            callback(null);
        }  else {

            var profile = {
                userId: data.user_id,
                slackToken: newToken,
                isZombie: 0
            };
            if (isZombie) { profile.isZombie = 1; }

            sqlUtil.addProfile(profile, function (id) {
                if (id) {
                    profile.slackedId = id;
                    callback(profile);
                } else {
                    callback(null);
                }
            });
        }
    });
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
 * TODO still think this isn't working properly
 */
function handleBotEvent(data) {

    if (global.appConfig.debug) {
        console.log("Bot came in : " + JSON.stringify(data));
    }

    if (bots[data.userId] !== true) {
        bots[data.userId] = true;
        sqlUtil.addUsersToDB([data], function(err) {

            if (err) {
                console.log("Error adding bot to db");
                console.error(err);
            } else {
                console.log("Added bot to db");
            }

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

/**
 * Takes in userId, allChannels and a return array.  The last array is added so it can be combined if needed
 * Returns the ret that was given and the channels left
 * @param userId
 * @param chans
 * @param ret
 * @returns {{ret: *, channels: *}}
 */
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

exports.getChannels = function getChannels(userId, callback) {

    var ret = [];
    var a = getActiveChannelsForUser(userId, allChannels.slice(0), ret);
    callback(a.ret);
    // TODO redis look up
};
/**
 * Returns OR callsback based on callback being there.  Takes in userId returns groups []
 * @param userId
 * @param callback
 * @returns {Array}
 */
exports.getGroups = function getGroupsForProfile(userId, callback) {

    if (!userId) {
        return zombieProfile.groups || [];
    } else  {

        var profile = {};
        for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].userId == userId) {
                 profile = profiles[i];
            }
        }
        if (!callback && profile.groups){

            return profile.groups || [];

        } else if (callback) {
            // use callback to get groups from api
            if (!profile.slackToken) {
                // need to get profile first so I have the api key
                sqlUtil.getProfileByUserId(userId, function(_profile) {
                    exports.fetchGroups(_profile, function(aProfile) {
                       callback(aProfile.groups);
                    });
                });

            } else {
                exports.fetchGroups(profile, function (aProfile) {
                    callback(aProfile.groups);
                });
            }
        } else {
            return [];
        }
    }
};

exports.sendToken = function(userId, token) {

    var sToken = zombieProfile.slackToken;
    var url = "https://api.slack.com/api/im.open?token=" + sToken + "&user=" + userId;

    console.log(url);

    slackRequest(url, function (err, data) {
        console.log("Data: %j", data);
       if (data && data.channel) {
           var pm = data.channel.id;
           // https://slack.com/api/chat.postMessage?token=SLACK_TOKEN&channel=D037JCR5Y&text=abcdefgh&pretty=1&username=zombie-bot
           var url = "https://api.slack.com/api/chat.postMessage?token=" + sToken + "&channel=" + pm + "&text=" + token.pass + "&username=slacked-bot";
           console.log(url);
           slackRequest(url, function (err, data2) {
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

exports.getUsers = function() {
    return users;
};