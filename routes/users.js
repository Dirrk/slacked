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

    if (req.session && req.session.loggedIn === true) {
    res.json(
        {
            success:  true,
            userId:      req.session.userId,
            displayName: req.session.name,
            loggedIn: true
        }
    );
  } else if (req.query.userId) {

        generateToken(function (token) {

            console.log("Generated token %s for user %s", token.pass, req.query.userId);
            req.session.token = token;
            req.session.userId = req.query.userId;
            req.session.loggedIn = false;

            slackService.sendToken(req.query.userId, token);

            res.send({success: true});
        }
        );

  } else {
        res.json({success: false});
  }
});

router.all('/auth/:userId', function (req, res) {

    var userId = req.params.userId;
    var tokenSent = req.query.token || req.body.token || '';

    if (req.session.token) {

        var tokenExpected = req.session.token;
        if (tokenExpected.expires >= new Date().getTime() && req.session.userId == userId && tokenExpected.pass == tokenSent.toUpperCase()) {

            req.session.userId = userId;
            req.session.loggedIn = true;
            req.session.name = slackUtil.getNameById(req.params.userId);
            res.json(
                {
                    success:     true,
                    displayName: req.session.name,
                    loggedIn:    true,
                    userId:      userId
                }
            );

        } else {
            console.log("%s :: User: %s was denied access when trying token %s against %s that expires %s",
                        new Date().toLocaleString(),
                        userId,
                        tokenSent,
                        tokenExpected.pass,
                        new Date(tokenExpected.expires).toLocaleString()
            );
            res.json({success: false});
        }

    } else {
        res.json({success: false});
    }
});


/***
 * Gernerates a token for authentication 8 letter token as token.pass and expires in 5 minutes
 * @param callback
 */
function generateToken(callback) {

    var token = {
        pass:    "",
        expires: new Date().getTime() + 300000
    };
    var hSum = crypto.createHash('sha256');

    crypto.randomBytes(256, function (ex, buf) {
        if (ex) {
            var a = Math.round(Math.random() * 1000000000000).toString(16);
            hSum.update(a);
            console.error(ex);
        } else {
            hSum.update(buf);
        }
        var hash = hSum.digest('base64');
        token.pass = hash.slice(0, 8).toUpperCase();
        callback(token);
    }
    );
}

module.exports = router;
