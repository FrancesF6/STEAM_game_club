const express = require('express');
const sqlite3 = require('better-sqlite3');
const router = express.Router();
const fs = require("fs");
const reviewsPath = 'data/reviews';

const DBPath = 'data/steam_club.db';
const db = new sqlite3(DBPath, {
    verbose: console.log   // this logs the sqlite3 query strings
});

// import authentication and authorization functions
const checkAuth = require('../authChecking').checkAuth;


//**********************************************************************//
// router routes
router.get("/", sendSearchForm, getGames, sendGames);   // html: send games search form, json: send matched games

router.get("/:gameID/likes", getLikedUsers);
router.get("/:gameID/reviews/:reviewID", sendReviewText);
router.get("/:gameID/reviews", getReviewsList);

router.post("/:gameID/review", checkAuth, saveNewReview);   // user save new review on a game
router.post("/:gameID/like", checkAuth, likeAGame);   // user like a game
router.delete("/:gameID/like", checkAuth, unlikeAGame);   // user cancel like a game

router.get("/:gameID", getGame, sendGame);


//**********************************************************************//

// if no query, send the games page with a search form and empty result
function sendSearchForm(req, res, next) {
    if (Object.keys(req.query) == 0) {
        res.render('games', {games: {}});
        return;
    }
    next();
}

// queries: title(contain), genre(match), company(contain), companyid(contain), releaseafter, releasebefore
function getGames(req, res, next) {
    const pageGamesLimit = 10;

    // 1 - extract query components
    let query = [];
    let tables = new Set();   // required additional tables
    let page = (req.query.page) ? parseInt(req.query.page) : 1;
    if (isNaN(page) || page < 1) page = 1;

    if (req.query.title) {
        query.push(`title LIKE \'%${req.query.title.trim()}%\'`);
    }
    if (req.query.genre) {
        query.push(`genre = \'${req.query.genre.trim()}\'`);
        tables.add("genres");
    }
    if (req.query.company) {
        query.push(`(name LIKE \'%${req.query.company.trim()}%\' OR cid LIKE \'%${req.query.company.trim()}%\')`);
        tables.add("companies");
    }
    if (req.query.releaseafter) {
        let datestamp = Date.parse(req.query.releaseafter);
        if (!isNaN(datestamp)) {
            query.push(`date >= ${datestamp}`);
        }
    }
    if (req.query.releasebefore) {
        let datestamp = Date.parse(req.query.releasebefore);
        if (!isNaN(datestamp)) {
            query.push(`date <= ${req.query.datestamp}`);
        }
    }
    if (query.length > 0) query = "WHERE " + query.join(" AND ");

    // 2 - make query string
    let dbQuery = "CREATE TEMP TABLE IF NOT EXISTS search_games AS "
                + "SELECT id, title FROM games ";
    if (tables.has("genres")) dbQuery += "JOIN game_genres ON games.id = game_genres.game_id ";
    if (tables.has("companies")) {
        dbQuery += "JOIN develop_publish ON games.id = develop_publish.game_id "
                + "JOIN companies ON companies.cid = develop_publish.company_id ";
    }
    dbQuery += query;

    // 3 - paging and exec query
    dbQuery += ` LIMIT ${(page+1)*pageGamesLimit}`;   // trying to search more to decide if provide 'next' button
    let total;
    let rows;
    let results = {};
    try {
        db.prepare(dbQuery).run();
        total = db.prepare(
            `SELECT COUNT(*) AS sum FROM search_games`).get();
        rows = db.prepare(
            `SELECT * FROM search_games 
            WHERE rowid BETWEEN ? AND ?`).all((page-1)*pageGamesLimit, page*pageGamesLimit);
    } catch (err) {
        console.log(err)
        res.status(500).send("Server error");
        return;
    }
    for (let row of rows) {
        results[row.id] = row.title;
    }
    req.searchGames = results;
    req.searchPage = page;
    req.nextPage = (total.sum > page*pageGamesLimit);  // if there are results on next page

    // remove page query, needed for previous and next buttons
    if (page > 1 || req.nextPage) {
        let parsedURL = req.url.replace(/(page=\d*&*)+/, '');
        if (parsedURL.slice(-1) == '&') req.currentURL = parsedURL.slice(0, parsedURL.length-1)
        else req.currentURL = parsedURL;
    }

    // 4 - delete temp table
    db.prepare("DROP TABLE IF EXISTS search_games").run();

    next();
}


// get game data based on game id
function getGame(req, res, next) {
    let gameID = req.params.gameID;
    let row;
    // find game basic data
    try {
        row = db.prepare('SELECT * FROM games WHERE id = ?').get(gameID);
    } catch (err) {
        res.status(500).send("Server error");
        return;
    }
    if (row == undefined) {   // not found, unknown
        res.status(404).send("Unknown ID");
        return;
    }
    let foundGame = row;
    
    // find game genre list
    foundGame.genres = [];
    let rows;
    try {
        rows = db.prepare(`SELECT genre FROM game_genres WHERE game_id = ?`).all(gameID);
    } catch (err) {
        res.status(500).send("Server error");
        return;
    }
    for (let r of rows) {
        foundGame.genres.push(r.genre);
    }
    
    // find game company list
    foundGame.devCompanies = {};
    foundGame.pubCompanies = {};
    try {
        rows = db.prepare(
            `SELECT name, cid, dev_or_pub FROM develop_publish
            JOIN companies ON companies.cid = develop_publish.company_id
            WHERE game_id = ? AND
            (dev_or_pub = 'dev' OR dev_or_pub = 'pub' OR dev_or_pub = 'both')`).all(gameID);
    } catch (err) {
        res.status(500).send("Server error");
        return;
    }
    for (let r of rows) {
        if (r.dev_or_pub == 'dev' || r.dev_or_pub == 'both') {
            foundGame.devCompanies[r.cid] = r.name;
        }
        if (r.dev_or_pub == 'pub' || r.dev_or_pub == 'both') {
            foundGame.pubCompanies[r.cid] = r.name;
        }
    }

    req.searchGame = foundGame;

    // if user logged in and have liked or reviewed this game
    if (req.session.loggedin && req.session.uid) {
        try {
            row = db.prepare('SELECT * FROM likes WHERE user_id = ? AND game_id = ?').get(req.session.uid, gameID);
            req.searchGameLiked = (row != undefined);
            
            row = db.prepare('SELECT review_id, timestamp FROM reviews WHERE user_id = ? AND game_id = ?').get(req.session.uid, gameID);
            req.searchGameReviewed = (row != undefined)? {reviewID: row.review_id , timestamp: row.timestamp} : undefined;
        } catch (err) {
            res.status(500).send("Server error");
            return;
        }
    }
    next();
}


// Output: req.likedUsers = {uid: profile_name, ...}
function getLikedUsers(req, res) {
    const suggestUserLimit = 10;
    let gameID = req.params.gameID;
    let rows;
    let likedUsers = {};

    try {
        rows = db.prepare(
            `SELECT uid, profile_name FROM likes
            JOIN users ON likes.user_id = users.uid
            WHERE game_id = ? LIMIT ?`).all(gameID, suggestUserLimit);
    } catch (err) {
        res.status(500).send("Server error");
        return;
    }
    for (let row of rows) {
        likedUsers[row.uid] = row.profile_name;
    }
    sendJSON(res, likedUsers);
}

// get reviews list from database
function getReviewsList(req, res) {
    const reviewsLimit = 5;
    let gameID = req.params.gameID;
    let rows;
    let reviewsList = {};

    try {
        rows = db.prepare(
            `SELECT uid, profile_name, review_id, timestamp FROM reviews
            JOIN users ON reviews.user_id = users.uid
            WHERE game_id = ? LIMIT ?`).all(gameID, reviewsLimit);
    } catch (err) {
        res.status(500).send("Server error");
        return;
    }
    for (let row of rows) {
        console.log(row);
        reviewsList[row.review_id] = {
            userID: row.uid,
            userPName: row.profile_name,
            timestamp: row.timestamp
        };
    }
    sendJSON(res, reviewsList);
}

// extract review from files based on review ID
function sendReviewText(req, res) {
    let gameID = req.params.gameID;
    let reviewID = req.params.reviewID;

    // first check gameID and reviewID match (avoid bad request)
    let row;
    try {
        row = db.prepare(`SELECT * FROM reviews WHERE game_id = ? AND review_id = ?`).get(gameID, reviewID);
    } catch (err) {
        res.status(500).send("Server error");
        return;
    }
    if (row == undefined) {
        res.status(404).send("Unknown ID");
        return;
    }

    // then extract review content from server archive and send to client
    fs.readFile(`data/reviews/${gameID}/${reviewID}`, 'utf8', (err, data) => {
        if (err) {
            res.status(500).send("Server error");
            return;
        }
        // console.log(data);
        res.set('Content-Type', 'text/plain');
        res.status(200).send(data);
    });
}

// req.body = {content: string}
function saveNewReview(req, res) {
    if (!req.body.content) {
        res.status(400).send("Bad request");
        return;
    }

    let gameID = req.params.gameID;
    let userID = req.session.uid;

    // get the max review_id for now to generate the next review_id
    let row;
    try {
        row = db.prepare(`SELECT max(review_id) AS max FROM reviews`).get();
    } catch (err) {
        res.status(500).send("Server error"); return;
    }
    if (row == undefined || !row.max) { res.status(500).send("Server error"); return; }
    let newReviewID = row.max+1;

    // save new review index into database
    let today = parseInt(new Date().getTime() / 1000);   // timestamp in seconds
    try {
        db.prepare(`INSERT INTO reviews (user_id, review_id, game_id, timestamp) VALUES (?, ?, ?, ?)`).run(userID, newReviewID, gameID, today);
    } catch (err) {
        if (err.constructor.name == "SqliteError" && err.code == "SQLITE_CONSTRAINT_UNIQUE")
            res.status(409).send("Duplicate reviews");
        else res.status(500).send("Server error");
        return;
    }

    // then save review content into file
    fs.writeFile(`${reviewsPath}/${gameID}/${newReviewID}`, req.body.content, {
        encoding: "utf8",
        flag: "w"
    }, (err) => {
        if (err) {
            res.status(500).send("Server error");
            return;
        }
        res.status(200).send();
    });
}


function likeAGame(req, res) {
    let gameID = req.params.gameID;
    let userID = req.session.uid;

    // add new like row into database
    try {
        db.prepare(`INSERT INTO likes (user_id, game_id) VALUES (?, ?)`).run(userID, gameID);
    } catch (err) {
        if (err.constructor.name != "SqliteError" || err.code != "SQLITE_CONSTRAINT_PRIMARYKEY")
            res.status(500).send("Server error");
        return;
    }
    res.status(200).send();
}

function unlikeAGame(req, res) {
    let gameID = req.params.gameID;
    let userID = req.session.uid;

    // delete like row from database
    try {
        db.prepare(`DELETE FROM likes WHERE user_id = ? AND game_id = ?`).run(userID, gameID);
    } catch (err) {
        res.status(500).send("Server error");
        return;
    }
    res.status(200).send();
}


//**********************************************************************//
// only send responses

// response based on html or json request
// html - browser utl; json - button js onclick
function sendGames(req, res) {
    res.format({
        'text/html': () => {
            res.set('Content-Type', 'text/html');
            res.render('games', {
                games: req.searchGames,
                page: req.searchPage,
                nextPage: req.nextPage,
                currentURL: req.currentURL
            });
        },
        'application/json': () => {
            res.set('Content-Type', 'application/json');
            res.json(req.searchGames);
        },
        'default': () => { res.status(406).send('Not Acceptable'); }
    });

}

function sendGame(req, res) {
    res.format({
        'text/html': () => {
            res.set('Content-Type', 'text/html');
            res.render('game', {
                game: req.searchGame,
                liked: req.searchGameLiked,
                reviewed: req.searchGameReviewed
            });
        },
        'application/json': () => {
            res.set('Content-Type', 'application/json');
            res.json(req.searchGame);
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