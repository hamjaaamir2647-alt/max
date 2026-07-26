const API_URL = "https://max-api-4tx2.onrender.com";

const saveBtn = document.getElementById("saveBtn");
const command = document.getElementById("command");
const status = document.getElementById("status");

saveBtn.addEventListener("click", async function () {

    status.innerHTML = "Sending...";

    try {

        const endpoint = command.value.toLowerCase().startsWith("received")
  ? "/receipt"
  : "/payment";

const response = await fetch(API_URL + endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
    command: command.value,
    sessionId: "amir"
})
});
        const data = await response.json();

        console.log(data);
        
        if (data.success) {
    status.innerHTML = "✅ " + data.message;
} else {

    if (data.options) {

        let html = "❌ " + data.message + "<br><br>";

        data.options.forEach((item, index) => {
            html += `${index + 1}. ${item.account} (${item.last4})<br>`;
        });

        html += "<br><b>Type the number and press Save.</b>";

        status.innerHTML = html;

    } else {

        status.innerHTML = "❌ " + data.message;

    }

}

    } catch (err) {
        status.innerHTML = "❌ " + err.message;
    }

});
