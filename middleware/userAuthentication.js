/**
 * Created by Derek Rada on 12/20/2014.
 */

// Start working on user Authentication

function UserAuthentication(req, res, next) {

    if (req.session && req.session.loggedIn === true) {
        next();
    } else {
        req.session.loggedIn = false;
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    }
}

module.exports = UserAuthentication;