var express = require('express');
var router = express.Router();
var sqlUtil = require('../lib/sqlUtil');
var slackUtil = require('../lib/slackUtil');
var slackService = require('../lib/slackService');
var crypto = require('crypto');

// TEMP FOR TESTING ONLY
var users = [];

/* GET users listing. */
router.get('/', function(req, res) {
  res.json(slackService.getUsers());
});

router.get('/auth', function(req, res) {

  if (req.user && req.user.loggedIn) {
    res.json(
        {
           userId: req.user.userId,
           displayName: req.user.name,
           loggedIn: true
        }
    )
  } else if (req.query.userId) {

    var token = {
      pass: "",
      expires: new Date().getTime() + 300000
    };
    var a = Math.round(Math.random() * 1000000000000).toString(16);
    var hSum = crypto.createHash('sha256');
    hSum.update(a);
    var hash = hSum.digest('base64');
    token.pass = hash.slice(0,6);

    // TODO Need session store implemented
    // req.session.token = token;



    slackService.sendToken(req.query.userId, token);
    users[req.query.userId] = {
      token: token
    };

    res.send({ success: true});
  } else {
    res.json({
      success: false
             });
  }
});

router.get('/auth/:userId', function (req, res) {

  var userId = req.params.userId;

  if (users[req.params.userId] && users[req.params.userId].token && users[req.params.userId].token.pass == req.query.token) {
    // /auth/USERID/?token=abcdefg
    req.user = req.user || {};
    req.user.loggedIn = true;
    req.user.userId = req.params.userId;
    console.log("User logged in successfully");
    res.json({
               success: true,
               userId: req.user.userId,
               loggedIn: true
             })
  } else {
    console.log("Bad token: %s from user: %s", req.query.token, req.params.userId);
    res.json({ success: false});
  }
});

module.exports = router;
