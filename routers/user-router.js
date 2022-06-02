const express = require('express');
const sqlite3 = require('better-sqlite3');
const router = express.Router();
const argon2 = require('argon2');   // hash passwords and store to database

const DBPath = 'data/steam_club.db';
const db = new sqlite3(DBPath, {
    verbose: console.log   // this logs the sqlite3 query strings
});

// import authentication and authorization functions
const sessionName = require('../authChecking').sessionName;
const checkAuth = require('../authChecking').checkAuth;


//**********************************************************************//
// router routes
router.get("/", (req, res) => res.redirect('/'));   // not support users list, redirect to home page

router.get("/:uidName/:listType", checkAuth, getUser, getDataLists);  // get JSON data of followers, followings, likes, reviews

router.post("/:uidName/follow", checkAuth, getUser, followUser);   // follower a user
router.delete("/:uidName/follow", checkAuth, getUser, unfollowUser);   // unfollower a user based on uidName (uid)
router.delete("/:uidName/:dataType", checkAuth, getUser, deleteData);   // unfollower a user, unlike a game, delete a review

router.get("/:uidName", checkAuth, getUser, getRelationship, sendUser);  // get certain user's profile
router.put("/:uidName", checkAuth, getUser, updateProfile);  // user change profile settings


//**********************************************************************//

// search "users" table from DB for a certain user with matched uid or username
// Output: req.user = {uid, username, profile_name, privacy}, req.owner = true/false
function getUser(req, res, next) {
    let uidOrName = req.params.uidName;   // can either be userid or username
    let row;

    try {
        // first search for user_id
        row = db.prepare('SELECT uid, username, profile_name, privacy FROM users WHERE uid = ?').get(uidOrName);
        
        // if not found, try searching username
        if (row == undefined) row = db.prepare('SELECT uid, username, profile_name, privacy FROM users WHERE username = ?').get(uidOrName.toLowerCase());
    } catch (err) {
        res.status(500).send("Server error");
        return;
    }
    // still not found, unknown
    if (row == undefined) {
        res.status(404).send("Unknown ID");
        return;
    }
    req.user = row;

    // decide if searched user matched with the logged in user
    req.owner = (req.session.sessionName === sessionName && req.session.uid == row.uid && req.session.username == row.username);
    next();
}

// if not owner, check if the logged in user has followed searched user
// Output: req.following = true/false
function getRelationship(req, res, next) {
    if (!req.owner) {
        let row;
        try {
            row = db.prepare('SELECT * FROM followings WHERE follower = ? AND followed = ?').get(req.session.uid, req.user.uid);
        } catch (err) {
            res.status(500).send("Server error");
            return;
        }
        req.following = (row != undefined);
    }
    next();
}

function getDataLists(req, res) {
    // if searched user profile is private but logged in user not match, forbid
    if (!req.owner && req.user.privacy) {
        res.status(403).send('Forbidden');
        return;
    }

    const dataLimit = 100;
    let listType = req.params.listType;
    let JSONData = {};
    let rows;

    if (listType == "followings") {
        try {
            rows = db.prepare(
                `SELECT followed, profile_name FROM followings
                JOIN users ON users.uid = followings.followed
                WHERE follower = ? LIMIT ?`).all(req.user.uid, dataLimit);
        } catch (err) {
            res.status(500).send("Server error");
            return;
        }
        for (let row of rows) {
            JSONData[row.followed] = row.profile_name;  // {uid: profileName, ...}
        }
    } else if (listType == "followers") {
        try {
            rows = db.prepare(
                `SELECT follower, profile_name FROM followings
                JOIN users ON users.uid = followings.follower
                WHERE followed = ? LIMIT ?`).all(req.user.uid, dataLimit);
        } catch (err) {
            res.status(500).send("Server error");
            return;
        }
        for (let row of rows) {
            JSONData[row.follower] = row.profile_name;  // {uid: profileName, ...}
        }
    } else if (listType == "likes") {
        try {
            rows = db.prepare(
                `SELECT id, title FROM games
                JOIN likes ON games.id = likes.game_id
                WHERE user_id = ? LIMIT ?`).all(req.user.uid, dataLimit);
        } catch (err) {
            res.status(500).send("Server error");
            return;
        }
        for (let row of rows) {
            JSONData[row.id] = row.title;  // {gameID: gameTitle, ...}
        }
    } else if (listType == "reviews") {
        try {
            rows = db.prepare(
                `SELECT title, review_id, game_id, timestamp FROM reviews
                JOIN games ON games.id = reviews.game_id
                WHERE user_id = ? LIMIT ?`).all(req.user.uid, dataLimit);
        } catch (err) {
            res.status(500).send("Server error");
            return;
        }
        for (let row of rows) {
            JSONData[row.game_id] = {
                reviewID: row.review_id,
                gameTitle: row.title,
                timestamp: row.timestamp
            };  // {gameID: {reviewID, gameTitle, timestamp}, ...}
        }
    } else {
        res.status(400).send('Bad request');
        return;
    }
    sendJSON(res, JSONData);
}


// Input: req.body = {profile_name: string}, or {privacy: boolean}, or {password: string}
async function updateProfile(req, res) {
    if (req.owner) {
        let row;
        if (typeof req.body.privacy === 'boolean') {
            try {
                db.prepare(`UPDATE users SET privacy = ? WHERE uid = ?`).run(Number(req.body.privacy), req.session.uid);
            } catch (err) {
                res.status(500).send("Server error");
                return;
            }
            res.status(200).send();

        } else if (req.body.profile_name) {
            try {
                db.prepare(`UPDATE users SET profile_name = ? WHERE uid = ?`).run(req.body.profile_name, req.session.uid);
            } catch (err) {
                res.status(500).send("Server error");
                return;
            }
            req.session.profileName = req.body.profile_name;
            res.status(200).send();

        } else if (req.body.password) {
            try {
                // hash the password, and update hashkey to database
                let hashkey = await argon2.hash(req.body.password);
                db.prepare(`UPDATE users SET password = ? WHERE uid = ?`).run(hashkey, req.session.uid);
            } catch (err) {
                res.status(500).send("Server error");
                return;
            }
            res.status(200).send();

        } else { res.status(400).send("Bad Request"); }
    } else { res.status(403).send('Forbidden'); }
}

// follower a user
function followUser(req, res) {
    try {
        db.prepare('INSERT INTO followings (follower, followed) VALUES (?, ?)').run(req.session.uid, req.user.uid);
    } catch (err) {
        res.status(500).send("Server error");
        return;
    }
    res.status(200).send();
}


function unfollowUser(req, res) {
    try {
        db.prepare('DELETE FROM followings WHERE follower = ? AND followed = ?').run(req.session.uid, req.user.uid);
    } catch (err) {
        res.status(500).send("Server error");
        return;
    }
    res.status(200).send();
}

// unfollower a user, unlike a game, delete a review
function deleteData(req, res) {
    let dataType = req.params.dataType;
    
    // if user is not owner logged in, forbid
    if (!req.owner) {
        res.status(403).send('Forbidden');
        return;
    }

    if (dataType == "following" && req.body.following) {   // req.body = {"following": uid}
        try {
            db.prepare('DELETE FROM followings WHERE follower = ? AND followed = ?').run(req.session.uid, req.body.following);
        } catch (err) {
            res.status(500).send("Server error");
            return;
        }
        res.status(200).send();
    } else if (dataType == "like" && req.body.like) {   // req.body = {"like": gameID}
        try {
            db.prepare('DELETE FROM likes WHERE user_id = ? AND game_id = ?').run(req.session.uid, req.body.like);
        } catch (err) {
            res.status(500).send("Server error");
            return;
        }
        res.status(200).send();
    } else if (dataType == "review" && req.body.review) {   // req.body = {"review": {gameID, reviewID}}
        try {
            db.prepare('DELETE FROM reviews WHERE user_id = ? AND game_id = ? AND review_id = ?')
            .run(req.session.uid, req.body.review.gameID, req.body.review.reviewID);
        } catch (err) {
            res.status(500).send("Server error");
            return;
        }
        res.status(200).send();
    } else {
        res.status(400).send('Bad request');
    }
}


//**********************************************************************//
// only send responses

function sendUser(req, res) {
    res.format({
        'text/html': () => {
            res.set('Content-Type', 'text/html');
            res.render('user', {
                user: req.user,
                owner: req.owner,
                following: req.following
            });
        },
        'application/json': () => {
            res.set('Content-Type', 'application/json');
            res.json(req.user);
        },
        'default': () => { res.status(406).send('Not Acceptable'); }
    });
}

function sendJSON(res, data) {
    res.format({
        'application/json': () => {
            res.set('Content-Type', 'application/json');
            res.json(data);
        },
        'default': () => { res.status(406).send('Not Acceptable'); }
    });
}


module.exports = router;