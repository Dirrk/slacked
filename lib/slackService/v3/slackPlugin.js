/**
 * Created by Derek Rada on 2/26/2015.
 */


function SlackPlugin() {

    var self = this;

    self._locations = {};
    self._users = {};
    self._me = "";

}

SlackPlugin.prototype.setUsers = function(users) {

    this._users = users;
};

SlackPlugin.prototype.setSelf = function(userId) {

    this._me = userId;
};

SlackPlugin.prototype.setLocations = function(locations) {

    this._locations = locations;
};


module.exports = SlackPlugin;