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
    const bankMatch = command.match(/from\s+([A-Za-z0-9 ]+?)\s+by/i);
    const modeMatch = command.match(/by\s+(.+)$/i);

    const amount = amountMatch ? amountMatch[1] : "";
    const labour = nameMatch ? nameMatch[1].trim() : "";
    const bank = bankMatch ? bankMatch[1].trim() : "";
    const mode = modeMatch ? modeMatch[1].trim() : "";

    // ==========================
    // Validate Labour
    // ==========================

    const labours = await getLabours();

    const matches = labours.filter(
      l => l.name.toLowerCase() === labour.toLowerCase()
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

    const now = new Date();

const date = now.toLocaleDateString("en-GB", {
  timeZone: "Asia/Kolkata"
});

const time = now.toLocaleTimeString("en-GB", {
  timeZone: "Asia/Kolkata",
  hour12: false
});

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:G`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
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
