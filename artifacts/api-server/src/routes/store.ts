// POST /api/connect-store — Mock Shopify store connection
// POST /api/create-checkout-session — Mock Stripe checkout session

import { Router, type IRouter } from "express";

const router: IRouter = Router();

// POST /api/connect-store — Connect a Shopify store (mock)
router.post("/connect-store", (req, res) => {
  const { storeUrl } = req.body as { storeUrl?: string };
  console.log(`[POST /connect-store] Connecting store: ${storeUrl}`);

  if (!storeUrl) {
    res.status(400).json({ error: "storeUrl is required." });
    return;
  }

  res.json({
    status: "connected",
    store: storeUrl,
  });
});

// POST /api/create-checkout-session — Create a Stripe checkout session (mock)
router.post("/create-checkout-session", (req, res) => {
  console.log("[POST /create-checkout-session] Creating checkout session");
  res.json({
    url: "https://stripe.com/mock-checkout",
  });
});

export default router;
