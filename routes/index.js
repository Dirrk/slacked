var express = require('express');
var router = express.Router();


/* GET home page. */

module.exports = router;

router.get('/', function(req, res) {
    res.render('location');
});
