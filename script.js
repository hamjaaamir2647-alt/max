alert("MAX JS Loaded");

const API_URL = "https://script.google.com/macros/s/AKfycbxmO2Q7ifgwBGMQoqYool1bRM8m7F4CmkApg_1gH3Ff8xQmo4tVZaDA6jURuVmrHHyR/exec";

const saveBtn = document.getElementById("saveBtn");
const command = document.getElementById("command");
const status = document.getElementById("status");

saveBtn.addEventListener("click", function () {

    alert("Save button clicked");

    status.innerHTML = "Sending...";

    fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            command: command.value
        })
    })
    .then(r => r.text())
    .then(t => {
        alert("Response: " + t);
        status.innerHTML = t;
    })
    .catch(err => {
        alert("ERROR: " + err);
        status.innerHTML = err;
    });

});
