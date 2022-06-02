let username = document.getElementById("usr");
let profileName = document.getElementById("pname");
let password = document.getElementById("psw");

let usrRegex = /^(?!.*\s).{4,20}$/;
let pswRegex = /^(?!.*\s)(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,20}$/;

// When clicking on the inputs, show the message div
username.onfocus = function() { document.getElementById("msg-usr").style.display = "block"; }
password.onfocus = function() { document.getElementById("msg-psw").style.display = "block"; }

// When clicking outside of the inputs, hide the message div
username.onblur = function() { document.getElementById("msg-usr").style.display = "none"; }
password.onblur = function() { document.getElementById("msg-psw").style.display = "none"; }


// when typing inside the username field
username.onkeyup = function() {
    let usrLength = document.getElementById("usr-length");
    let usrNoSpace = document.getElementById("usr-nospace");

    // validate username length (4-20), and no space
    usrLength.className = (username.value.length >= 4 && username.value.length <= 20)? "valid" : "invalid";
    usrNoSpace.className = !(/\s/.test(username.value))? "valid" : "invalid";

    updateButton();
}

// when typing inside the password field
password.onkeyup = function() {
    let pswLength = document.getElementById("psw-length");
    let pswLower = document.getElementById("psw-lower");
    let pswUpper = document.getElementById("psw-upper");
    let pswDigit = document.getElementById("psw-digit");
    let pswNoSpace = document.getElementById("psw-nospace");

    // validate password length (8-20), lowercase letters, uppercase letters, digits, and no space
    pswLength.className = (password.value.length >= 8 && password.value.length <= 20)? "valid" : "invalid";
    pswLower.className = (/[a-z]/.test(password.value))? "valid" : "invalid";
    pswUpper.className = (/[A-Z]/.test(password.value))? "valid" : "invalid";
    pswDigit.className = (/\d/.test(password.value))? "valid" : "invalid";
    pswNoSpace.className = !(/\s/.test(password.value))? "valid" : "invalid";

    updateButton();
}


function updateButton() {
    if (usrRegex.test(username.value) && pswRegex.test(password.value)) document.getElementById("register-button").disabled = false;
    else document.getElementById("register-button").disabled = true;
}


// register button only becomes able when username and password inputs are valid
function register() {
    // check again profile name is not empty
    if (profileName.value.trim().length == 0) {
        alert("Profile Name should not be empty!");
        return;
    }

    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if (this.readyState == 4) {
            if (this.status == 201) {
                let userID = JSON.parse(this.responseText).uid;
                window.location.href = `/users/${userID}`;  // redirect to own profile's page
            } else if (this.status == 422 || this.status == 400) {
                alert(this.responseText);
            }
        } 
    }
    req.open("POST", `/register`, true);
    req.setRequestHeader("Content-Type", "application/json");
    req.send(JSON.stringify({
        username: username.value,
        profileName: profileName.value.trim(),
        password: password.value
    }));
}
