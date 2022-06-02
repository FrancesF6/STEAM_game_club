
function init() {
    document.getElementById("liked-users").onload = renderLikedUsers();
    document.getElementById("reviews-list").onload = renderReviewList();
}

// GET requests

function renderLikedUsers() {
    let container = document.getElementById("liked-users");

    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            let users = JSON.parse(this.responseText);
            // users = {uid: profile_name, ...}

            if (Object.keys(users).length == 0) {
                container.innerHTML = `<p id="likes-msg">There are no users like this game (for now) &#128528</p>`
                return;
            }
            container.innerHTML = 
            `<p id="likes-msg">These are the ${Object.keys(users).length} users who like this game...</p>
            <div id="liked-users-list"></div>`
            let list = document.getElementById("liked-users-list")

            for (let uid in users) {
                let userDiv = document.createElement("div");
                userDiv.className = "liked-user";
                userDiv.innerHTML = 
                `<a class="liked-user-link" href="/users/${uid}">
                    <img class="avatar" src="/avatars/uid_${uid}">
                    <p class="liked-user-title">${users[uid]}</p></a>`;

                list.appendChild(userDiv);
            }
        }
    }
    req.open("GET", `/games/${gameID}/likes`, true);
    req.setRequestHeader("Accept", "application/json");
    req.send();
}

function renderReviewList() {
    let list = document.getElementById("reviews-list");

    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            let reviewList = JSON.parse(this.responseText);
            // reviewList = {reviewID: {userID, userPName, timestamp}, ...}

            if (Object.keys(reviewList).length == 0) {
                list.innerHTML = `<p id="reviews-msg">There are no reviews for this game. Share your review now!</p>`
                return;
            }
            list.innerHTML = `<p id="reviews-msg">Showing ${Object.keys(reviewList).length} reviews...</p>`

            for (let reviewID in reviewList) {
                let reviewDiv = document.createElement("div");
                reviewDiv.className = "review";
                reviewDiv.innerHTML = 
                `<a class="review-user" href="/users/${reviewList[reviewID].userID}">${reviewList[reviewID].userPName}</a>
                <div class="review-time">${new Date(reviewList[reviewID].timestamp*1000).toUTCString()}</div>
                <div class="review-content" id="content-${reviewID}"></div>`;

                list.appendChild(reviewDiv);
               
                renderReview(reviewID);   // render review content
            }
        }
    }
    req.open("GET", `/games/${gameID}/reviews`, true);
    req.setRequestHeader("Accept", "application/json");
    req.send();
}

// get a certain review based on review ID
// receive plain text
function renderReview(reviewID) {
    let contentDiv = document.getElementById(`content-${reviewID}`);

    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            contentDiv.innerText = this.responseText;
        }
    }
    req.open("GET", `/games/${gameID}/reviews/${reviewID}`, true);
    req.setRequestHeader("Accept", "text/plain");
    req.send();
}


// POST, DELETE requests

function sendReview() {
    let reviewContent = document.getElementById("form-review").value;
    console.log(reviewContent);

    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            window.location.href = `/games/${gameID}`;   // refresh the page
        }
    }
    req.open("POST", `/games/${gameID}/review`, true);
    req.setRequestHeader("Content-Type", "application/json");
    req.send(JSON.stringify({content: reviewContent}));
}

function changeLike(ele) {
    if (ele.id == 'liked') {
        let req = new XMLHttpRequest();
        req.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                ele.id = "nolike";
                ele.src = "/images/nolike.png";
            }
        }
        req.open("DELETE", `/games/${gameID}/like`, true);
        req.send();

    } else if (ele.id == 'nolike') {
        let req = new XMLHttpRequest();
        req.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                ele.id = "liked";
                ele.src = "/images/like.png";
            }
        }
        req.open("POST", `/games/${gameID}/like`, true);
        req.send();
    }
}