/**
 * Created by Derek Rada on 12/1/2014.
 */

// SlackTimeStamp to Javascript Timestamp
exports.slackTStoJSTS = function slackTS2JSTS(stringInput){

    var time = parseFloat(stringInput);
    var newTime = Math.round(time) * 1000;
    return new Date(newTime);
};
