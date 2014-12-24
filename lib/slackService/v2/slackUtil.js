/**
 * Created by Derek Rada on 12/1/2014.
 */

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