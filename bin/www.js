#!/usr/bin/env node

var config = require("../lib/config");

config.www(function (settings) {

  var app = require('../app');

  app.set('token', settings.token);

  var server = app.listen(settings.port, function() {
    console.log('Express server listening on port ' + server.address().port);
  });

});


