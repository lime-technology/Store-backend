// GET /api/dashboard — Returns mock store analytics
// Protected by JWT middleware

import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

// GET /api/dashboard — Mock dashboard metrics
router.get("/dashboard", requireAuth, (req, res) => {
  console.log("[GET /dashboard] Dashboard requested");
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

export default router;
