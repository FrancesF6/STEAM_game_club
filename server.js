const port = process.env.PORT || 3000;
const express = require('express');
const app = express();

const fs = require('fs');
const https = require('https');
const path = require('path');
const argon2 = require('argon2');   // hash passwords and store to database
const morgan = require('morgan');

const session = require('express-session');
const sqlite3 = require('better-sqlite3');
const Sqlite3Store = require("better-sqlite3-session-store")(session);   // express-session with better-sqlite3

const DBPath = 'data/steam_club.db';
const db = new sqlite3(DBPath, {
    verbose: console.log   // logs sqlite3 query strings
});

// store session data in better-sqlite3
const sessionStore = new Sqlite3Store({
    client: db, 
    expired: {
        clear: true,
        intervalMs: 3600000   // 1 hour
    }
});

// import authentication and authorization functions
const sessionName = require('./authChecking').sessionName;
const checkAuth = require('./authChecking').checkAuth;
const checkUnAuth = require('./authChecking').checkUnAuth;


//**********************************************************************//
// middlewares
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(express.static('public'));  // static resources
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(session({
    name: sessionName,
    store: sessionStore,
    secret: "A world of wonder, a land of beauty",
    cookie: {
        maxAge: 3600000   // 1 hour
    },
    resave: true,
    saveUninitialized: false
}));


// log requests and status
app.use(morgan('tiny'));   // 'dev', 'short', 'tiny' - getting smaller


//**********************************************************************//
// server routes
app.use(exposeSession);   // expose req.session to res.locals

app.use("/users", require("./routers/user-router"));   // user router
app.use("/games", require("./routers/game-router"));   // game router

app.get('/', (req, res) => res.render('home'));  // home page

app.get('/register', checkUnAuth, (req, res) => {res.render('register');});
app.post('/register', checkUnAuth, createNewUser);

app.post('/login', checkUnAuth, login);
app.get('/logout', checkAuth, logout);


//**********************************************************************//
// FUNCTIONS

// store session data to res.locals so template engine can access
function exposeSession(req, res, next) {
    if (req.session) res.locals.session = req.session;
    next();
}

// async - verify received password with hashkey stored in database (argon2.verify)
// req.body = {username, password}
async function login(req, res) {
    if (req.body.username && req.body.password) {
        let row = db.prepare(`SELECT uid, profile_name, password FROM users WHERE username = ?`).get(req.body.username);
        if (row != undefined) {
            try {
                if (await argon2.verify(row.password, req.body.password)) {
                    req.session.loggedin = true;
                    req.session.uid = row.uid;
                    req.session.username = req.body.username;
                    req.session.profileName = row.profile_name;
                    req.session.sessionName = sessionName;
                    res.status(200).send();
                    return;
                } else {
                    res.status(403).send("Wrong password");
                    return;
                }
            } catch (err) {
                res.status(500).send("Server error");
                return;
            }
        }
    }
    // invalid request, or not found user
    res.status(401).send("Unauthorized");
}


// async - store hashed password to database (argon2.hash)
// req.body = {username, profileName, password}
async function createNewUser(req, res) {
    if (req.body.username && req.body.profileName && req.body.password) {
        // create a new row into database
        try {
            let hashkey = await argon2.hash(req.body.password);   // hash the password
            db.prepare('INSERT INTO users (username, profile_name, password) VALUES (?, ?, ?)')
            .run(req.body.username, req.body.profileName, hashkey);
        } catch (err) {
            if (err.constructor.name == "SqliteError" && err.code == "SQLITE_CONSTRAINT_UNIQUE") {
                res.status(409).send("Duplicate username");
            } else {
                res.status(500).send("Server error");
            }
            return;
        }
        // get auto generated uid of new user and assign to session
        let row = db.prepare(`SELECT uid, profile_name FROM users WHERE username = ?`).get(req.body.username);
        if (row != undefined) {
            // automatically logged in
            req.session.loggedin = true;
            req.session.uid = row.uid;
            req.session.username = req.body.username;
            req.session.profileName = row.profile_name;
            req.session.sessionName = sessionName;
            res.status(201).send({uid: row.uid});
        } else {
            res.status(500).send("Server error");
        }
    } else {
        // invalid request
        res.status(400).send("Bad Request");
    }
}


function logout(req, res) {
    req.session.destroy((err) => {});
    delete res.locals.session;
    res.status(200).redirect('/');
}


//**********************************************************************//
// connect the database and start server

https.createServer({
    key: fs.readFileSync('certificate/server.key'),
    cert: fs.readFileSync('certificate/server.cert')
}, app).listen(port, () => {
    console.log(`Server listening at port ${port}.`);
});
