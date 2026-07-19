const API_URL = "https://max-api-4tx2.onrender.com/payment";

const saveBtn = document.getElementById("saveBtn");
const command = document.getElementById("command");
const status = document.getElementById("status");

saveBtn.addEventListener("click", async function () {

    status.innerHTML = "Sending...";

    try {

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                command: command.value
            })
        });

        const data = await response.json();

        if (data.success) {
            status.innerHTML = "✅ " + data.message;
        } else {
            status.innerHTML = "❌ " + data.message;
        }

    } catch (err) {
        status.innerHTML = "❌ " + err.message;
    }

});
