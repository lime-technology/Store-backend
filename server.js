// StoreInsight AI - Simple Express Backend
// Run with: npm start

const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 3000;

// Middleware: enable CORS and parse JSON bodies
app.use(cors());
app.use(express.json());

// Log every incoming request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// GET / - Confirm server is running
app.get("/", (req, res) => {
  res.send("Server running on port 3000");
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
