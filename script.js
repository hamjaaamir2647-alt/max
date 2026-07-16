const API_URL = "https://script.google.com/macros/s/AKfycbxmO2Q7ifgwBGMQoqYool1bRM8m7F4CmkApg_1gH3Ff8xQmo4tVZaDA6jURuVmrHHyR/exec";

const micBtn = document.getElementById("micBtn");
const saveBtn = document.getElementById("saveBtn");
const command = document.getElementById("command");
const status = document.getElementById("status");

saveBtn.addEventListener("click", sendCommand);

async function sendCommand() {

    const text = command.value.trim();

    if (!text) {
        status.innerHTML = "Please enter a command.";
        return;
    }

    status.innerHTML = "Sending...";

    try {

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                command: text
            })
        });

        const result = await response.text();

        status.innerHTML = "✅ " + result;

    } catch (err) {

        status.innerHTML = "❌ " + err.message;

    }

}
