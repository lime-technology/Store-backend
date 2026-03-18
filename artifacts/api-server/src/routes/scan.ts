// POST /api/scan — Simulates a store scan with a 2-3 second delay
// Protected by JWT middleware

import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

// POST /api/scan — Simulate scanning a Shopify store
router.post("/scan", requireAuth, async (req, res) => {
  const { storeUrl } = req.body as { storeUrl?: string };
  console.log(`[POST /scan] Scanning store: ${storeUrl}`);

  if (!storeUrl) {
    res.status(400).json({ error: "storeUrl is required." });
    return;
  }

  // Simulate a real scan with a 2-3 second delay
  const delay = 2000 + Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));

  console.log(`[POST /scan] Scan complete for: ${storeUrl}`);
  res.json({
    score: 62,
    issues: [
      "Users leaving product page",
      "Checkout abandonment high",
      "Images not optimized",
    ],
    recommendations: [
      "Improve product images",
      "Reduce load time",
      "Simplify checkout",
    ],
  });
});

export default router;
