const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("✅ MAX API is running!");
});

app.post("/payment", (req, res) => {
  const { command } = req.body;

  console.log("Received:", command);

  res.json({
    success: true,
    message: "Payment received successfully",
    command: command
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`MAX API running on port ${PORT}`);
});
