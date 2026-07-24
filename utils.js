const { google } = require("googleapis");

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

async function getSheet(sheet, range) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!${range}`,
  });

  return response.data.values || [];
}

async function getLabours() {
  const rows = await getSheet("Labour Master", "A2:E");

  return rows.map((r) => ({
    id: r[0] || "",
    name: r[1] || "",
    mobile: r[2] || "",
    status: r[3] || "",
    address: r[4] || "",
  }));
}

async function getBanks() {
  const rows = await getSheet("Bank Accounts", "A2:E");

  return rows.map((r) => ({
    id: r[0] || "",
    bank: r[1] || "",
    account: r[2] || "",
    last4: r[3] || "",
    alias: r[4] || "",
  }));
}

async function getCompanies() {
  const rows = await getSheet("Company Master", "A2:F");

  return rows.map((r) => ({
    id: r[0] || "",
    company: r[1] || "",
    site: r[2] || "",
    contact: r[3] || "",
    mobile: r[4] || "",
    address: r[5] || "",
  }));
}

async function getNextTransactionId(prefix, sheet) {
  const rows = await getSheet(sheet, "A2:A");

  let lastId = "";

  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][0] && rows[i][0].startsWith(prefix)) {
      lastId = rows[i][0];
      break;
    }
  }

  if (!lastId) return `${prefix}000001`;

  const num = parseInt(lastId.replace(prefix, ""), 10) + 1;

  return `${prefix}${String(num).padStart(6, "0")}`;
}

module.exports = {
  sheets,
  SPREADSHEET_ID,
  getLabours,
  getBanks,
  getCompanies,
  getNextTransactionId,
};
