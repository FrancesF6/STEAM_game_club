function requestLogin() {
    let user = {};
    user.username = document.getElementById("header-login-username").value.trim();
    user.password = document.getElementById("header-login-password").value;
    for (let credential in user) {
        if (user[credential].length === 0) {
            alert(`${credential} is required!`);
            return;
        }
    }
    // console.log(user);

    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4) {
            if (this.status == 200) {
                window.location.href = `/`;  // redirect to home page
            } else {
                alert(this.responseText);
            }
        } 
    }
    req.open("POST", `/login`, true);
    req.setRequestHeader("Content-Type", "application/json");
    req.send(JSON.stringify(user));
}


function openLoginForm() {
    document.getElementById("header-popup-login-box").style.display = "block";
}

function closeLoginForm() {
    document.getElementById("header-popup-login-box").style.display = "none";
}