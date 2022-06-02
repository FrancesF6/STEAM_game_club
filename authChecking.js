// req.session: {loggedin, uid, username, sessionName}
const sessionName = 'SteamGameClubSession';

// continue to next if the user has logged in
function checkAuth(req, res, next) {
    if (!req.session.loggedin || req.session.sessionName !== sessionName
        || !req.session.uid || !req.session.username) {
        res.status(401).send("You haven't been logged in.");
        return;
    }
    next();
}

// continue to next if the user is not logged in
function checkUnAuth(req, res, next) {
    if (req.session.loggedin && req.session.sessionName === sessionName
        && req.session.uid && req.session.username) {
        res.status(400).send("You have already logged in.");
        return;
    }
    next();
}


module.exports.sessionName = sessionName;
module.exports.checkAuth = checkAuth;
module.exports.checkUnAuth = checkUnAuth;
