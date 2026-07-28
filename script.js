const micBtn = document.getElementById("micBtn");

const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    micBtn.addEventListener("click", () => {
        recognition.start();
    });

    recognition.onresult = function (event) {
        command.value = event.results[0][0].transcript;
    };

    recognition.onerror = function (event) {
        alert("Microphone Error: " + event.error);
    };

} else {

    alert("Speech Recognition is not supported in this browser.");

}

const API_URL = "https://max-api-4tx2.onrender.com";

const saveBtn = document.getElementById("saveBtn");
const command = document.getElementById("command");
const status = document.getElementById("status");

command.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        e.preventDefault();
        saveBtn.click();
    }
});

saveBtn.addEventListener("click", async function () {

    status.innerHTML = "Sending...";

    try {

        let endpoint = sessionStorage.getItem("currentEndpoint") || "/payment";

if (command.value.toLowerCase().startsWith("received")) {
    endpoint = "/receipt";
}

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
        if (data.pending) {
    sessionStorage.setItem("currentEndpoint", endpoint);
}

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
