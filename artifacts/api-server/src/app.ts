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

// POST /scan - Full Shopify store audit
app.post("/scan", async (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url) {
      res.status(400).json({ success: false, error: "URL is required" });
      return;
    }

    console.log(`Scanning URL: ${url}`);

    const axiosOpts = {
      timeout: 8000,
      httpsAgent,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PHIX360-Scanner/1.0)" },
    };

    // Fetch main page HTML and measure response time
    const startTime = Date.now();
    const response = await axios.get(url, axiosOpts);
    const responseTime = Date.now() - startTime;

    const html: string = String(response.data);
    const pageSize = Buffer.byteLength(html, "utf8");

    // ── SEO Signals ──────────────────────────────────────────────
    const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;

    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,500})["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']{1,500})["'][^>]+name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim() : null;

    const hasOgTitle = /<meta[^>]+property=["']og:title["']/i.test(html);
    const hasOgImage = /<meta[^>]+property=["']og:image["']/i.test(html);
    const hasOgDescription = /<meta[^>]+property=["']og:description["']/i.test(html);
    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
    const h1Matches = html.match(/<h1[^>]*>/gi);
    const h1Count = h1Matches ? h1Matches.length : 0;

    // ── Images ───────────────────────────────────────────────────
    const allImgTags = html.match(/<img[^>]+>/gi) ?? [];
    const totalImages = allImgTags.length;

    // Product images: src containing 'product', 'cdn', large dimensions, or not icon/logo
    const productImages = allImgTags.filter((tag) =>
      /product|cdn\.shopify|\/files\//i.test(tag) &&
      !/logo|icon|badge|avatar|sprite/i.test(tag)
    ).length;

    // Images missing alt text
    const imagesWithoutAlt = allImgTags.filter(
      (tag) => !/alt=["'][^"']+["']/i.test(tag)
    ).length;

    // ── Shopify Detection ─────────────────────────────────────────
    const isShopify =
      /cdn\.shopify\.|Shopify\.shop|shopify_pay|myshopify\.com/i.test(html) ||
      url.includes("myshopify.com") ||
      url.includes("shopify");

    let products = 0;
    if (isShopify) {
      try {
        const base = new URL(url).origin;
        const productsRes = await axios.get(`${base}/products.json?limit=250`, {
          ...axiosOpts,
          timeout: 5000,
        });
        const data = productsRes.data as { products?: unknown[] };
        products = Array.isArray(data.products) ? data.products.length : 0;
      } catch {
        // products.json not accessible — leave at 0
      }
    }

    // ── Scoring (start at 100, deduct for issues) ─────────────────
    const issues: { issue: string; severity: "High" | "Medium" | "Low" }[] = [];
    const suggestions: string[] = [];
    let score = 100;

    if (!title) {
      score -= 15; issues.push({ issue: "Missing page title", severity: "High" });
      suggestions.push("Add a descriptive <title> tag to improve SEO ranking.");
    } else if (title.length < 30) {
      score -= 5; issues.push({ issue: "Page title too short (under 30 chars)", severity: "Medium" });
      suggestions.push("Expand your page title to 50–60 characters for better SEO.");
    } else if (title.length > 70) {
      score -= 5; issues.push({ issue: "Page title too long (over 70 chars)", severity: "Low" });
      suggestions.push("Shorten your page title to under 70 characters to avoid truncation.");
    }

    if (!description) {
      score -= 12; issues.push({ issue: "Missing meta description", severity: "High" });
      suggestions.push("Add a meta description (120–160 chars) to improve click-through rates.");
    } else if (description.length < 80) {
      score -= 4; issues.push({ issue: "Meta description too short", severity: "Medium" });
      suggestions.push("Write a fuller meta description (120–160 chars).");
    }

    if (!hasOgTitle || !hasOgImage || !hasOgDescription) {
      score -= 8; issues.push({ issue: "Incomplete Open Graph tags", severity: "Medium" });
      suggestions.push("Add og:title, og:description, and og:image for better social sharing previews.");
    }

    if (!hasViewport) {
      score -= 10; issues.push({ issue: "Missing viewport meta tag", severity: "High" });
      suggestions.push("Add <meta name='viewport'> to make your store mobile-friendly.");
    }

    if (!hasCanonical) {
      score -= 5; issues.push({ issue: "No canonical tag found", severity: "Low" });
      suggestions.push("Add a canonical link tag to prevent duplicate content penalties.");
    }

    if (h1Count === 0) {
      score -= 8; issues.push({ issue: "No H1 heading found", severity: "High" });
      suggestions.push("Add a primary H1 heading to each page for SEO clarity.");
    } else if (h1Count > 1) {
      score -= 4; issues.push({ issue: `Multiple H1 tags found (${h1Count})`, severity: "Medium" });
      suggestions.push("Use only one H1 per page — multiple H1s confuse search engines.");
    }

    if (totalImages > 40) {
      score -= 8; issues.push({ issue: `Too many images on page (${totalImages})`, severity: "High" });
      suggestions.push("Reduce the number of images loaded on the homepage to improve speed.");
    } else if (totalImages > 20) {
      score -= 4; issues.push({ issue: `High image count (${totalImages})`, severity: "Medium" });
      suggestions.push("Consider lazy-loading images to improve initial page load time.");
    }

    if (imagesWithoutAlt > 0) {
      score -= Math.min(imagesWithoutAlt * 2, 10);
      issues.push({ issue: `${imagesWithoutAlt} image(s) missing alt text`, severity: "Medium" });
      suggestions.push("Add descriptive alt attributes to all images for accessibility and SEO.");
    }

    if (pageSize > 500_000) {
      score -= 10; issues.push({ issue: `Heavy page size (${(pageSize / 1024).toFixed(0)} KB)`, severity: "High" });
      suggestions.push("Minify HTML/CSS/JS and compress assets to reduce page weight.");
    } else if (pageSize > 200_000) {
      score -= 5; issues.push({ issue: `Large page size (${(pageSize / 1024).toFixed(0)} KB)`, severity: "Medium" });
      suggestions.push("Aim for a page size under 200 KB for faster load times.");
    }

    if (responseTime > 3000) {
      score -= 10; issues.push({ issue: `Slow server response (${responseTime}ms)`, severity: "High" });
      suggestions.push("Improve server response time — aim for under 1 second (Time to First Byte).");
    } else if (responseTime > 1500) {
      score -= 5; issues.push({ issue: `Moderate server response time (${responseTime}ms)`, severity: "Medium" });
      suggestions.push("Optimize server-side rendering or use a CDN to reduce response time.");
    }

    if (!url.startsWith("https://")) {
      score -= 10; issues.push({ issue: "Site not using HTTPS", severity: "High" });
      suggestions.push("Enable HTTPS — it is a Google ranking factor and required for trust.");
    }

    score = Math.max(0, Math.min(100, score));

    res.json({
      success: true,
      url,
      isShopify,
      score,
      pageSize: `${(pageSize / 1024).toFixed(1)} KB`,
      responseTime: `${responseTime}ms`,
      seo: {
        title: title ?? "Missing",
        description: description ?? "Missing",
        hasOgTags: hasOgTitle && hasOgImage && hasOgDescription,
        hasViewport,
        hasCanonical,
        h1Count,
      },
      images: {
        total: totalImages,
        productImages,
        missingAlt: imagesWithoutAlt,
      },
      products: isShopify ? products : null,
      issues,
      suggestions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    res.status(500).json({ success: false, error: message });
  }
});

app.use("/api", router);

export default app;
