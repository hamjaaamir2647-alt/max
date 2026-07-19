const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());

// =====================
// Google Authentication
// =====================

const auth = new google.auth.GoogleAuth({
  credentials: {
    project_id: process.env.GOOGLE_PROJECT_ID,
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "Labour Payments";

// =====================
// Home
// =====================

app.get("/", (req, res) => {
  res.send("✅ MAX API is running!");
});

// =====================
// Payment API
// =====================

app.post("/payment", async (req, res) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({
        success: false,
        message: "Command missing",
      });
    }

    console.log("Received:", command);

    // Example:
    // Paid ₹5000 to Rahim from SBI by PhonePe

    const amountMatch = command.match(/₹?\s?(\d+)/i);
    const nameMatch = command.match(/to\s+([A-Za-z ]+?)\s+from/i);
    const bankMatch = command.match(/from\s+([A-Za-z ]+?)\s+by/i);
    const modeMatch = command.match(/by\s+(.+)$/i);

    const amount = amountMatch ? amountMatch[1] : "";
    const labour = nameMatch ? nameMatch[1].trim() : "";
    const bank = bankMatch ? bankMatch[1].trim() : "";
    const mode = modeMatch ? modeMatch[1].trim() : "";

    const date = new Date().toLocaleString("en-IN");

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:F`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            date,
            labour,
            amount,
            bank,
            mode,
            command,
          ],
        ],
      },
    });

    res.json({
      success: true,
      message: "Payment saved successfully.",
      data: {
        labour,
        amount,
        bank,
        mode,
      },
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================
// Start Server
// =====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`MAX API running on port ${PORT}`);
});
