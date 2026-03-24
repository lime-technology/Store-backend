import express, { type Express } from "express";
import cors from "cors";
import axios from "axios";
import https from "https";
import router from "./routes";

// Allow self-signed / edge-case certificates in scan requests
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

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

// GET /health - Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// POST /scan - Fetch and analyze a real URL
app.post("/scan", async (req, res) => {
  try {
    const { url } = req.body as { url?: string };

    if (!url) {
      res.status(400).json({ success: false, error: "URL is required" });
      return;
    }

    console.log(`Scanning URL: ${url}`);

    // Fetch the HTML from the provided URL
    const response = await axios.get(url, {
      timeout: 8000,
      httpsAgent,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PHIX360-Scanner/1.0)" },
    });

    const html: string = response.data as string;

    // Extract page title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "No title found";

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim() : "No description found";

    // Count images
    const imgMatches = html.match(/<img[^>]*/gi);
    const images = imgMatches ? imgMatches.length : 0;

    // Simple score based on available SEO elements
    let score = 50;
    if (title && title !== "No title found") score += 15;
    if (description && description !== "No description found") score += 15;
    if (images > 0) score += 10;
    if (images > 5) score += 10;

    res.json({
      success: true,
      url,
      title,
      description,
      images,
      score: Math.min(score, 100),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    res.status(500).json({ success: false, error: message });
  }
});

app.use("/api", router);

export default app;
