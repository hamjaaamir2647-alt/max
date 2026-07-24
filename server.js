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
const LABOUR_SHEET = "Labour Master";
const BANK_SHEET = "Bank Accounts";

// =====================
// Home
// =====================

app.get("/", (req, res) => {
  res.send("✅ MAX API is running!");
});

// =====================
// Read Labour Master
// =====================

async function getLabours() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${LABOUR_SHEET}!A2:E`,
  });

  const rows = response.data.values || [];

  return rows.map((row) => ({
    id: row[0] || "",
    name: row[1] || "",
    mobile: row[2] || "",
    status: row[3] || "",
    address: row[4] || "",
  }));
}
async function getBanks() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BANK_SHEET}!A2:E`,
  });

  const rows = response.data.values || [];

  return rows.map((row) => ({
    id: row[0] || "",
    bank: row[1] || "",
    account: row[2] || "",
    last4: row[3] || "",
    alias: row[4] || "",
  }));
}
async function getNextTransactionId(prefix, sheetName) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:A`,
  });

  const rows = response.data.values || [];

  if (rows.length === 0) {
    return `${prefix}000001`;
  }

  const lastId = rows[rows.length - 1][0];

  if (!lastId || !lastId.startsWith(prefix)) {
    return `${prefix}000001`;
  }

  const number = parseInt(lastId.replace(prefix, ""), 10) + 1;

  return `${prefix}${String(number).padStart(6, "0")}`;
}
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

// Get labour list first
const labours = await getLabours();
const banks = await getBanks();
const transactionId = await getNextTransactionId("PAY", SHEET_NAME);

// Extract amount
const amountMatch = command.match(/\d+/);
const amount = amountMatch ? amountMatch[0] : "";

// Find labour
const cleanCommand = command.toLowerCase().replace(/\s+/g, " ").trim();

let labour = "";

for (const l of labours) {
  const name = l.name.toLowerCase().trim();

  if (cleanCommand.includes(name)) {
    labour = l.name;
    break;
  }
}

// Extract bank
let bank = "";
const bankMatch = command.match(/from\s+(.+?)(?:\s+by|$)/i);

if (bankMatch) {
  const input = bankMatch[1].trim().toLowerCase();

  const matches = banks.filter((b) =>
    (b.alias || "")
      .toLowerCase()
      .split(",")
      .map((a) => a.trim())
      .includes(input)
  );

  if (matches.length === 1) {
    bank = matches[0].account;
  } else if (matches.length > 1) {
    return res.json({
      success: false,
      message: "Multiple bank accounts found.",
      options: matches.map((b) => ({
        id: b.id,
        account: b.account,
        last4: b.last4,
      })),
    });
  }
}

// Extract payment mode
let mode = "";

const text = command.toLowerCase();

if (text.includes("cash")) {
  mode = "Cash";
} else if (
  text.includes("googlepay") ||
  text.includes("google pay") ||
  text.includes("gpay")
) {
  mode = "Google Pay";
} else if (
  text.includes("phonepe") ||
  text.includes("phone pe")
) {
  mode = "PhonePe";
} else if (text.includes("paytm")) {
  mode = "Paytm";
} else if (text.includes("upi")) {
  mode = "UPI";
} else if (text.includes("neft")) {
  mode = "NEFT";
} else if (text.includes("rtgs")) {
  mode = "RTGS";
} else if (text.includes("imps")) {
  mode = "IMPS";
} else if (text.includes("cheque") || text.includes("check")) {
  mode = "Cheque";
} else {
  mode = "";
}

console.log("Labours Found:", labours.length);

    const matches = labours.filter(
      (l) => l.name.toLowerCase() === labour.toLowerCase()
    );

    if (matches.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No labour named "${labour}" found.`,
      });
    }

    if (matches.length > 1) {
      return res.status(400).json({
        success: false,
        needSelection: true,
        type: "labour",
        matches,
      });
    }

    const selectedLabour = matches[0];

    // =====================
    // Indian Date & Time
    // =====================

    const now = new Date();

    const date = now.toLocaleDateString("en-GB", {
      timeZone: "Asia/Kolkata",
    });

    const time = now.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Kolkata",
      hour12: false,
    });

    // =====================
    // Save Payment
    // =====================

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:G`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
  [
    transactionId,
    date,
    time,
    selectedLabour.name,
    amount,
    bank,
    mode,
    "",
  ],
],
      },
    });

    res.json({
  success: true,
  message: "Payment saved successfully.",
  data: {
    transactionId,
    labour: selectedLabour.name,
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
  console.log(`✅ MAX API running on port ${PORT}`);
});
