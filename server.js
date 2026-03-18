// StoreInsight AI - Simple Express Backend
// Run with: npm start

const express = require("express");
const app = express();
const PORT = 3000;

// Middleware: parse JSON bodies
app.use(express.json());

// Middleware: enable CORS so any frontend can connect
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// GET /healthz - Health check
app.get("/healthz", (req, res) => {
  res.send("OK");
});

// GET /dashboard - Mock store analytics
app.get("/dashboard", (req, res) => {
  res.json({
    conversionRate: 2.4,
    visitors: 1200,
    orders: 28,
    issues: [
      "High drop-off on product page",
      "Slow loading pages",
      "Missing product images",
    ],
  });
});

// POST /scan - Simulate scanning a Shopify store (2 second delay)
app.post("/scan", (req, res) => {
  const { storeUrl } = req.body;

  if (!storeUrl) {
    return res.status(400).json({ error: "storeUrl is required" });
  }

  console.log(`Scanning store: ${storeUrl} ...`);

  setTimeout(() => {
    res.json({
      score: 62,
      issues: [
        "Users leaving product page",
        "Checkout abandonment high",
      ],
      recommendations: [
        "Improve product images",
        "Reduce load time",
      ],
    });
  }, 2000);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
