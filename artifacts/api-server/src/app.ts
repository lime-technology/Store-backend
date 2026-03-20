import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root-level routes (accessible at / via the proxy)
app.get("/", (_req, res) => {
  res.send("Server is running");
});

app.get("/test", (_req, res) => {
  res.json({ status: "success", message: "API working" });
});

app.post("/analyze", (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url) {
      res.status(400).json({ error: "URL is required" });
      return;
    }
    console.log(`Analyzing store: ${url}`);
    res.json({
      score: 68,
      metrics: {
        conversionRate: "3.2%",
        visitors: 24521,
        addToCart: "8.7%",
        checkoutDrop: "42.1%",
      },
      issues: [
        { title: "Missing product images", severity: "High", page: "/product" },
        { title: "Slow page load", severity: "High", page: "/home" },
        { title: "Weak CTA", severity: "Medium", page: "/product" },
        { title: "Broken links", severity: "Low", page: "/footer" },
      ],
      recommendations: [
        { text: "Improve product images", impact: "+12% conversion" },
        { text: "Reduce load time", impact: "+8% conversion" },
        { text: "Fix checkout flow", impact: "+18% conversion" },
      ],
    });
  } catch {
    res.status(500).json({ error: "Analysis failed" });
  }
});

app.use("/api", router);

export default app;
