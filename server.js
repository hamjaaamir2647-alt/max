const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

let pendingRequests = {};

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
const COMPANY_SHEET = "Company Master";
const RECEIPT_SHEET = "Company Receipts";

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
async function getCompanies() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${COMPANY_SHEET}!A2:F`,
  });

  const rows = response.data.values || [];

  return rows.map((row) => ({
    id: row[0] || "",
    company: row[1] || "",
    site: row[2] || "",
    contact: row[3] || "",
    mobile: row[4] || "",
    address: row[5] || "",
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

  let lastId = "";

for (let i = rows.length - 1; i >= 0; i--) {
  if (rows[i][0] && rows[i][0].startsWith(prefix)) {
    lastId = rows[i][0];
    break;
  }
}

if (!lastId) {
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
// Validate Payment Before Saving
// =====================

if (!selectedLabour.name || !amount || !bank || !mode) {
  return res.status(400).json({
    success: false,
    message: "Incomplete payment information. Payment not saved."
  });
}

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
      range: `${SHEET_NAME}!A:H`,
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
// Receipt API
// =====================
app.post("/receipt", async (req, res) => {
    try {
    let { command, sessionId = "default" } = req.body;
      if (pendingRequests[sessionId]) {

  const pending = pendingRequests[sessionId];

  // User replied with bank name (e.g. SBI)
  if (pending.type === "receipt_bank" && !/^\d+$/.test(command)) {
    command = `${pending.command} in ${command}`;
    delete pendingRequests[sessionId];
  }
    else if (pending.type === "receipt_mode" && !/^\d+$/.test(command)) {

  command = `${pending.command} by ${command}`;
  req.selectedBank = pending.bank;

  delete pendingRequests[sessionId];

}

  // User selected bank number (e.g. 1 or 2)
  else if (pending.type === "receipt" && /^\d+$/.test(command)) {

    const selected = pending.options[parseInt(command) - 1];

    if (!selected) {
      return res.json({
        success: false,
        message: "Invalid option."
      });
    }

    command = `${pending.command} in ${selected.account}`;
    req.selectedBank = selected.account;
    delete pendingRequests[sessionId];
  }

}

    if (!command) {
      return res.status(400).json({
        success: false,
        message: "Command missing",
      });
    }

    console.log("Receipt:", command);
          const companies = await getCompanies();
    const banks = await getBanks();
    const transactionId = await getNextTransactionId("REC", RECEIPT_SHEET);

    const amountMatch = command.match(/\d+/);
    const amount = amountMatch ? amountMatch[0] : "";

    const cleanCommand = command.toLowerCase().replace(/\s+/g, " ").trim();
          let company = "";

const companyMatch = command.match(/from\s+(.+?)(?:\s+by|\s+in|$)/i);

if (companyMatch) {
  const input = companyMatch[1].trim().toLowerCase();

  for (const c of companies) {
    const companyName = c.company.toLowerCase();
    const siteName = (c.site || "").toLowerCase();

    if (
      companyName.includes(input) ||
      input.includes(companyName) ||
      siteName.includes(input) ||
      input.includes(siteName)
    ) {
      company = c.company;
      break;
    }
  }
}
          let bank = req.selectedBank || "";
const bankMatch = command.match(/in\s+(.+?)(?:\s+by|$)/i);

      if (!bankMatch && !req.selectedBank) {

  pendingRequests[sessionId] = {
    type: "receipt_bank",
    command
  };

  return res.json({
    success: false,
    pending: true,
    message: "Which bank received the money?"
  });

}
  if (bankMatch && !req.selectedBank) {
      const input = bankMatch[1].trim().toLowerCase();
    console.log("Bank input:", input);

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

  pendingRequests[sessionId] = {
    type: "receipt",
    command,
    options: matches,
  };

  return res.json({
    success: false,
    message: "Multiple bank accounts found.",
    pending: true,
    options: matches.map((b) => ({
      id: b.id,
      account: b.account,
      last4: b.last4,
    })),
  });

}
    }
  
const hasMode =
  command.toLowerCase().includes("cash") ||
  command.toLowerCase().includes("googlepay") ||
  command.toLowerCase().includes("google pay") ||
  command.toLowerCase().includes("gpay") ||
  command.toLowerCase().includes("phonepe") ||
  command.toLowerCase().includes("phone pe") ||
  command.toLowerCase().includes("paytm") ||
  command.toLowerCase().includes("upi") ||
  command.toLowerCase().includes("neft") ||
  command.toLowerCase().includes("rtgs") ||
  command.toLowerCase().includes("imps") ||
  command.toLowerCase().includes("cheque") ||
  command.toLowerCase().includes("check");

if (!hasMode) {

  pendingRequests[sessionId] = {
    type: "receipt_mode",
    command,
    bank: bank
  };

  return res.json({
    success: false,
    pending: true,
    message: "Which payment mode? (Cash / UPI / NEFT / RTGS / IMPS)"
  });

}
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
    }
          const matches = companies.filter(
      (c) => c.company.toLowerCase() === company.toLowerCase()
    );

    if (matches.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No company named "${company}" found.`,
      });
    }

    const selectedCompany = matches[0];

    const now = new Date();

    const date = now.toLocaleDateString("en-GB", {
      timeZone: "Asia/Kolkata",
    });

    const time = now.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Kolkata",
      hour12: false,
    });
          await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${RECEIPT_SHEET}!A:H`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          transactionId,
          date,
          time,
          selectedCompany.company,
          amount,
          bank,
          mode,
          ""
        ]],
      },
    });

    delete pendingRequests[sessionId];
      
      res.json({
      success: true,
      message: "Receipt saved successfully.",
      data: {
        transactionId,
        company: selectedCompany.company,
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
