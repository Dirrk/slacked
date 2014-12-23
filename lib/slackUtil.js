/**
 * Created by Derek Rada on 12/1/2014.
 */
var sqlUtil = require('./sqlUtil');
var slackService = require('./slackService/v1/slackService');


// SlackTimeStamp to Javascript Timestamp
exports.slackTStoJSTS = function slackTS2JSTS(stringInput){

    var time = parseFloat(stringInput);
    var newTime = Math.round(time) * 1000;
    return new Date(newTime);
};

exports.getNameById = function getNameById(userId) {

    var users = slackService.getUsers() || [];

    for (var i = 0; i < users.length; i++) {
        if (users[i].userId == userId) {
            return users[i].name;
        }
    }
    console.log("%s was not found in user list.  This has to be an error");
    return "Null";
};


/***
 * Verifies user is in groupId
 * @param userId
 * @param locationId
 * @param callback
 */
exports.verifyUserHasAccess = function (userId, locationId, callback) {

    if (locationId.charAt(0) === "C") {

        callback(true);
        return;
    }
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

