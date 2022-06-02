let container = document.getElementById("rSide");

// REQUESTs

function getJSONList(item, owner) {
    if (item != "followings" && item != "followers" && item != "likes" && item != "reviews") return;

    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            if (item == "followings") renderJSONList("followings", JSON.parse(this.responseText), owner);
            else if (item == "followers") renderJSONList("followers", JSON.parse(this.responseText), owner);
            else if (item == "likes") renderJSONList("likes", JSON.parse(this.responseText), owner);
            else if (item == "reviews") renderJSONList("reviews", JSON.parse(this.responseText), owner);
        }
    }
    req.open("GET", `/users/${userID}/${item}`, true);
    req.setRequestHeader("Accept", "application/json");
    req.send();
}


function changeSetting(item) {
    if (item != "privacy" && item != "psw") return;

    let requestJSON = {};
    if (item === "privacy") {
        let radios = document.getElementsByClassName("privacy-radios");
        for (let radio of radios) {
            if (radio.checked) {
                // also change client global variable
                if (radio.id === 'on') requestJSON.privacy = privacy = true;
                else if (radio.id === 'off') requestJSON.privacy = privacy = false;
                break;
            }
        }
    } else if (item === "psw") {
        let newPassword = document.getElementById("psw-input").value;
        let pswRegex = /^(?!.*\s)(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,20}$/;
        if (!pswRegex.test(newPassword)) {
            alert("A validate password should have 8-20 characters, at least 1 lowercase letter, 1 uppercase letter, 1 digit, and no spaces.");
            return;
        }
        requestJSON.password = newPassword;
    }

    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            alert("Saved!");
        }
    }
    req.open("PUT", `/users/${userID}`, true);
    req.setRequestHeader("Content-Type", "application/json");
    req.send(JSON.stringify(requestJSON));
}


function changePName() {
    let newPName = document.getElementById("pname-input").value;
    if (newPName.trim().length == 0) {
        alert("The profile name cannot be empty!");
        return;
    }

    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            document.getElementById("user-profile-name").innerText = newPName;
        }
    }
    req.open("PUT", `/users/${userID}`, true);
    req.setRequestHeader("Content-Type", "application/json");
    req.send(JSON.stringify({profile_name: newPName}));
}

// send: {"following": uid}, or {"like": gameID}, or {"review": {gameID, reviewID}}
function deleteData(type, id) {
    if (type != "following" && type != "like" && type != "review") return;

    let requestJSON = {};
    if (type === "following") requestJSON.following = id;
    else if (type === "like") requestJSON.like = id;
    else if (type === "review") {
        requestJSON.review = {
            gameID: id.split('-')[0],
            reviewID: id.split('-')[1]
        };
    }

    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            document.getElementById(`delete-${type}-${id}`).parentNode.remove();
        }
    }
    req.open("DELETE", `/users/${userID}/${type}`, true);
    req.setRequestHeader("Content-Type", "application/json");
    req.send(JSON.stringify(requestJSON));
}


function unfollow() {
    let ele = document.getElementById("following");

    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            ele.id = "nofollowing";
            ele.innerText = "follow";
        }
    }
    req.open("DELETE", `/users/${userID}/follow`, true);
    req.send();
}

function follow() {
    let ele = document.getElementById("nofollowing");

    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            ele.id = "following";
            ele.innerText = "following";
        }
    }
    req.open("POST", `/users/${userID}/follow`, true);
    req.send();
}

// RENDERINGs            

function renderSettings() {
    container.className = "column-display";
    container.innerHTML =
    `<div id="privacy-mode"> Private Mode:
        <form id="privacy-form">
            <input class="privacy-radios" type="radio" id="on">
            <label class="privacy-labels" for="on">On</label><br>
            <input class="privacy-radios" type="radio" id="off">
            <label class="privacy-labels" for="off">Off</label><br>
            <input id="privacy-button" type="button" value="Save" onclick="changeSetting("privacy")">
        </form></div>
    <div id="change-pname"> Profile Name:
        <form id="pname-form">
            <input id="pname-input" type="text" required maxlength=20><br>
            <input id="pname-button" type="button" value="Change" onclick="changePName()">
        </form></div>
    <div id="change-psw"> Password:
        <form id="psw-form">
            <input id="psw-input" type="password" required maxlength=20><br>
            <input id="psw-button" type="button" value="Change" onclick="changePassword("psw")">
        </form></div>`;
    
    if (privacy) document.getElementById("on").checked = true;
    else document.getElementById("off").checked = true;
}

function renderJSONList(item, jsonData, owner) {
    if (item != "followings" && item != "followers" && item != "likes" && item != "reviews") return;
    container.innerHTML = "";

    if (item == "followings") {
        container.className = "row-display";
        // jsonData = {uid: profileName, ...}
        for (let uid in jsonData) {
            let dataDiv = document.createElement("div");
            dataDiv.className = "following";
            dataDiv.innerHTML = "";
            if (owner) {
                dataDiv.innerHTML += 
                `<span class="delete-span" id="delete-following-${uid}" onclick="deleteData('following', ${uid})"> × </span>`;
            }
            dataDiv.innerHTML += 
            `<a class="follow-link" href="/users/${uid}">
                <img class="follow-avatar" src="/avatars/uid_${uid}">
                <p class="userPName">${jsonData[uid]}</p></a>`;

            container.appendChild(dataDiv);
        }
    }
    else if (item == "followers") {
        container.className = "row-display";
        // jsonData = {uid: profileName, ...}
        for (let uid in jsonData) {
            let dataDiv = document.createElement("div");
            dataDiv.className = "follower";
            dataDiv.innerHTML = 
            `<a class="follow-link" href="/users/${uid}">
                <img class="follow-avatar" src="/avatars/uid_${uid}">
                <p class="userPName">${jsonData[uid]}</p></a>`;
            container.appendChild(dataDiv);
        }
    }
    else if (item == "likes")  {
        container.className = "column-display";
        // jsonData = {gameID: gameTitle, ...}
        for (let gameID in jsonData) {
            let dataDiv = document.createElement("div");
            dataDiv.className = "like";
            dataDiv.innerHTML = "";
            if (owner) {
                dataDiv.innerHTML += 
                `<span class="delete-span" id="delete-like-${gameID}" onclick="deleteData('like', ${gameID})"> × </span>`;
            }
            dataDiv.innerHTML += 
            `<a class="like-link" href="/games/${gameID}">${jsonData[gameID]}</a>`;
            
            container.appendChild(dataDiv);
        }
    }
    else if (item == "reviews")  {
        container.className = "column-display";
        // jsonData = {gameID: {reviewID, gameTitle, timestamp}, ...}
        for (let gameID in jsonData) {
            let dataDiv = document.createElement("div");
            dataDiv.className = "review";
            dataDiv.innerHTML = "";
            if (owner) {
                dataDiv.innerHTML += 
                `<span class="delete-span" id="delete-review-${gameID}-${jsonData[gameID].reviewID}" onclick="deleteData('review', '${gameID}-${jsonData[gameID].reviewID}')"> × </span>`;
            }
            dataDiv.innerHTML += 
            `<a class="review-link" href="/games/${gameID}">${jsonData[gameID].gameTitle}</a>
            <div class="review-time">${new Date(jsonData[gameID].timestamp*1000).toUTCString()}</div>
            <div class="review-content" id="content-${gameID}-${jsonData[gameID].reviewID}"></div>`;
            
            container.appendChild(dataDiv);
           
            renderReview(gameID, jsonData[gameID].reviewID);
        }
    }
}

// get a certain review based on review ID
// receive plain text
function renderReview(gameID, reviewID) {
    let contentDiv = document.getElementById(`content-${gameID}-${reviewID}`);

    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            console.log(this.responseText);
            contentDiv.innerText = this.responseText;
        }
    }
    req.open("GET", `/games/${gameID}/reviews/${reviewID}`, true);
    req.setRequestHeader("Accept", "text/plain");
    req.send();
}