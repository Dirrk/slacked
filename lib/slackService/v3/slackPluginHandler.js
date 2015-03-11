/**
 * Created by Derek Rada on 2/26/2015.
 */

var async = require('async');

// Setup Plugins
var __plugins = [];


// Add a plugin
exports.add_plugin = function add_plugin(pluginObject) {
    console.log("Adding plugin object");
    console.log(typeof pluginObject);
    console.log(typeof pluginObject.process);
    if (typeof pluginObject === "object" && typeof pluginObject.process === "function") {
        __plugins.push(pluginObject);
        console.log("Succeeded");
    } else {
        console.log("Failed adding plugin");
    }
};


exports.handler = function slackPluginHandler(message) {

    var waterFall = [];
    for (var i = 0; i < __plugins.length; i++) {
        waterFall.push(__plugins[i].process.bind(__plugins[i], message))
    }
    async.series(
        waterFall,
        function (err) {
            if (err) {
                console.error(err)
            }
        }
    );
};

exports.updateUsers = function updateUsers(users) {

    for (var i = 0; i < __plugins.length; i++) {
        __plugins[i].setUsers(users);
    }
};

exports.updateLocations = function updateLocations(locations) {

    for (var i = 0; i < __plugins.length; i++) {
        __plugins[i].setLocations(locations);
    }
};

exports.setSelf = function setSelf(selfString) {

    for (var i = 0; i < __plugins.length; i++) {
        __plugins[i].setSelf(selfString);
    }
};
