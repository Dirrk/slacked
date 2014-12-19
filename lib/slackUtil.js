/**
 * Created by Derek Rada on 12/1/2014.
 */
var sqlUtil = require('./sqlUtil');
var slackService = require('./slackService');


// SlackTimeStamp to Javascript Timestamp
exports.slackTStoJSTS = function slackTS2JSTS(stringInput){

    var time = parseFloat(stringInput);
    var newTime = Math.round(time) * 1000;
    return new Date(newTime);
};


exports.getCurrentRequestingUser = function getCurrentRequestingUser(req) {

    if (req.user && req.user.loggedIn === true) {
        return req.user.userId;
    } else if (global.appConfig.debug === true) {
        return "U02HA00AX";
    } else {
        return null;
    }
};
/***
 * Verifies user is in groupId
 * @param userId
 * @param locationId
 * @param callback
 */
exports.verifyUserHasAccess = function (userId, locationId, callback) {

    sqlUtil.getProfileByUserId(userId, function (profile) {

        if (profile) {

            slackService.fetchGroups(profile, function(aProfile) {

                var found = false;
                for (var i = 0; i < aProfile.groups.length; i++) {
                    if (aProfile.groups[i].locationId == locationId) {
                        found = true;
                    }
                }
                console.log("Allowed: %s, user: %s to location: %s", found.toString(),userId, locationId);
                callback(found);
            });

       } else {
           console.log("Denied user: %s to location: %s",userId, locationId);
           callback(false);
       }
    });

};