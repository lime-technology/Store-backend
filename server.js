const express = require("express");
const cors = require("cors");
const https = require("https");
const http = require("http");
const OpenAI = require("openai");
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");
const keys = [
  process.env.GOOGLE_API_KEY,
  process.env.GOOGLE_API_KEY_2,
  process.env.GOOGLE_API_KEY_3
].filter(Boolean);

const lighthouse = require("lighthouse");
const chromeLauncher = require("chrome-launcher");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();

// ── Middleware ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Crash-proof helper: fetch URL with timeout ────────────────────
function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(
      url,
      {
        timeout: 8000,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PHIX360-Scanner/1.0)",
        },
        rejectUnauthorized: false,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.setTimeout(8000);
  });
}

// ── Routes ────────────────────────────────────────────────────────

// GET / - Status
app.get("/", (req, res) => {
  res.send("Server is running");
});

// GET /health - Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok v4" });
});

// GET /test - API working check
app.get("/test", (req, res) => {
  res.json({ status: "success", message: "API working" });
});

// POST /analyze - Mock store analysis (fast, no external fetch)
app.post("/analyze", (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    console.log(`[analyze] ${url}`);
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
  } catch (err) {
    console.error("[analyze] error:", err.message);
    res
      .status(500)
      .json({ success: false, error: "Analysis failed but server is running" });
  }
});

app.post("/puppeteer-scan", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL required" });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--no-zygote",
      ],
    });

    const page = await browser.newPage();
    const start = Date.now();

    await page.goto(url, {
      waitUntil: ["domcontentloaded", "networkidle0"],
      timeout: 60000,
    });

    const loadTime = Date.now() - start;

    const data = await page.evaluate(() => ({
      domNodes: document.querySelectorAll("*").length,
      images: document.querySelectorAll("img").length,
      buttons: document.querySelectorAll("button").length,
    }));

    res.json({
      success: true,
      loadTime,
      ...data,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Scan failed" });
  } finally {
    if (browser) await browser.close();
  }
});


app.post("/pagespeed", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL required" });
  }

  try {
let apiKey = keys[Math.floor(Math.random() * keys.length)];

const response = await fetch(
  `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${url}&key=${apiKey}&strategy=mobile&category=performance`
);

let data = await response.json();

// 🔥 retry if quota exceeded
if (data.error && data.error.code === 429 && keys.length > 1) {
  console.log("Quota exceeded, switching API key...");

  apiKey = keys[Math.floor(Math.random() * keys.length)];

  const retryResponse = await fetch(
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${url}&key=${apiKey}&strategy=mobile&category=performance`
  );

  data = await retryResponse.json();
}
// ✅ FIRST check
if (!data.lighthouseResult) {
  return res.status(500).json({
    success: false,
    error: "Invalid PageSpeed response",
    fullData: data
  });
}

// ✅ ONLY ONE RESPONSE
res.json({
  success: true,
  performance: data.lighthouseResult?.categories?.performance?.score
    ? data.lighthouseResult.categories.performance.score * 100
    : 0,
  seo: data.lighthouseResult?.categories?.seo?.score
    ? data.lighthouseResult.categories.seo.score * 100
    : 0,
  accessibility: data.lighthouseResult?.categories?.accessibility?.score
    ? data.lighthouseResult.categories.accessibility.score * 100
    : 0,
bestPractices: data.lighthouseResult?.categories?.["best-practices"]?.score
  ? data.lighthouseResult.categories["best-practices"].score * 100
  : 0,
});
  } catch (err) {
    console.error("PageSpeed error:", err.message);

    res.status(500).json({
      success: false,
      error: "PageSpeed failed",
    });
  }
});



// ================= LIGHTHOUSE ROUTE =================

app.post("/lighthouse", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL required" });
  }

  let chrome;

  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
    });

    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      timeout: 60000,
    });

    const scores = result.lhr.categories;

    res.json({
      success: true,
      performance: scores.performance.score * 100,
      seo: scores.seo.score * 100,
      accessibility: scores.accessibility.score * 100,
      bestPractices: scores["best-practices"].score * 100,
    });
  } catch (err) {
    console.error("Lighthouse error:", err.message);

    res.status(500).json({
      success: false,
      error: "Lighthouse failed",
    });
  } finally {
    if (chrome) await chrome.kill();
  }
});

// POST /scan - Full audit: fetches real HTML, extracts SEO/image data
app.post("/scan", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: "URL is required" });
    }

    console.log(`[scan] Scanning: ${url}`);

    let html = "";
    const startTime = Date.now();

    try {
      html = await fetchHTML(url);
    } catch (fetchErr) {
      console.error("[scan] Fetch failed:", fetchErr.message);
      // Return a safe fallback instead of crashing
      return res.json({
        success: false,
        url,
        error: "Could not fetch the URL. Make sure it is publicly accessible.",
        score: 0,
        issues: [{ issue: "URL not reachable", severity: "High" }],
        suggestions: [
          "Ensure the store URL is public and not password protected.",
        ],
      });
    }

    const responseTime = Date.now() - startTime;
    const pageSize = Buffer.byteLength(html, "utf8");

    // ── SEO ──────────────────────────────────────────────────────
    const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;

    const descMatch =
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,500})["']/i,
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']{1,500})["'][^>]+name=["']description["']/i,
      );
    const description = descMatch ? descMatch[1].trim() : null;

    const hasOgTitle = /<meta[^>]+property=["']og:title["']/i.test(html);
    const hasOgImage = /<meta[^>]+property=["']og:image["']/i.test(html);
    const hasOgDescription = /<meta[^>]+property=["']og:description["']/i.test(
      html,
    );
    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
    const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;

    // ── Images ───────────────────────────────────────────────────
    const allImgTags = html.match(/<img[^>]+>/gi) || [];
    const totalImages = allImgTags.length;
    const productImages = allImgTags.filter(
      (t) =>
        /product|cdn\.shopify|\/files\//i.test(t) &&
        !/logo|icon|badge|avatar|sprite/i.test(t),
    ).length;
    const imagesWithoutAlt = allImgTags.filter(
      (t) => !/alt=["'][^"']+["']/i.test(t),
    ).length;

    // ── Shopify detection ─────────────────────────────────────────
    const isShopify =
      /cdn\.shopify\.|Shopify\.shop|shopify_pay|myshopify\.com/i.test(html) ||
      url.includes("myshopify.com") ||
      url.includes("shopify");

    let products = 0;
    if (isShopify) {
      try {
        const base = new URL(url).origin;
        const productsHTML = await fetchHTML(`${base}/products.json?limit=250`);
        const data = JSON.parse(productsHTML);
        products = Array.isArray(data.products) ? data.products.length : 0;
      } catch {
        // /products.json not accessible — not a crash
      }
    }

    // ── Scoring (deduct from 100) ─────────────────────────────────
    const issues = [];
    const suggestions = [];
    let score = 100;

    if (!title) {
      score -= 15;
      issues.push({ issue: "Missing page title", severity: "High" });
      suggestions.push("Add a descriptive <title> tag to improve SEO ranking.");
    } else if (title.length < 30) {
      score -= 5;
      issues.push({
        issue: "Page title too short (under 30 chars)",
        severity: "Medium",
      });
      suggestions.push(
        "Expand your page title to 50–60 characters for better SEO.",
      );
    } else if (title.length > 70) {
      score -= 5;
      issues.push({
        issue: "Page title too long (over 70 chars)",
        severity: "Low",
      });
      suggestions.push("Shorten your page title to under 70 characters.");
    }

    if (!description) {
      score -= 12;
      issues.push({ issue: "Missing meta description", severity: "High" });
      suggestions.push(
        "Add a meta description (120–160 chars) to improve click-through rates.",
      );
    } else if (description.length < 80) {
      score -= 4;
      issues.push({ issue: "Meta description too short", severity: "Medium" });
      suggestions.push("Write a fuller meta description (120–160 chars).");
    }

    if (!hasOgTitle || !hasOgImage || !hasOgDescription) {
      score -= 8;
      issues.push({ issue: "Incomplete Open Graph tags", severity: "Medium" });
      suggestions.push(
        "Add og:title, og:description, and og:image for better social sharing.",
      );
    }

    if (!hasViewport) {
      score -= 10;
      issues.push({ issue: "Missing viewport meta tag", severity: "High" });
      suggestions.push(
        "Add <meta name='viewport'> to make your store mobile-friendly.",
      );
    }

    if (!hasCanonical) {
      score -= 5;
      issues.push({ issue: "No canonical tag found", severity: "Low" });
      suggestions.push(
        "Add a canonical link tag to prevent duplicate content penalties.",
      );
    }

    if (h1Count === 0) {
      score -= 8;
      issues.push({ issue: "No H1 heading found", severity: "High" });
      suggestions.push("Add a primary H1 heading for SEO clarity.");
    } else if (h1Count > 1) {
      score -= 4;
      issues.push({
        issue: `Multiple H1 tags found (${h1Count})`,
        severity: "Medium",
      });
      suggestions.push("Use only one H1 per page.");
    }

    if (totalImages > 40) {
      score -= 8;
      issues.push({
        issue: `Too many images on page (${totalImages})`,
        severity: "High",
      });
      suggestions.push(
        "Reduce the number of images on the homepage to improve speed.",
      );
    } else if (totalImages > 20) {
      score -= 4;
      issues.push({
        issue: `High image count (${totalImages})`,
        severity: "Medium",
      });
      suggestions.push(
        "Consider lazy-loading images to improve initial page load.",
      );
    }

    if (imagesWithoutAlt > 0) {
      score -= Math.min(imagesWithoutAlt * 2, 10);
      issues.push({
        issue: `${imagesWithoutAlt} image(s) missing alt text`,
        severity: "Medium",
      });
      suggestions.push("Add descriptive alt attributes to all images.");
    }

    if (pageSize > 500000) {
      score -= 10;
      issues.push({
        issue: `Heavy page size (${(pageSize / 1024).toFixed(0)} KB)`,
        severity: "High",
      });
      suggestions.push(
        "Minify HTML/CSS/JS and compress assets to reduce page weight.",
      );
    } else if (pageSize > 200000) {
      score -= 5;
      issues.push({
        issue: `Large page size (${(pageSize / 1024).toFixed(0)} KB)`,
        severity: "Medium",
      });
      suggestions.push(
        "Aim for a page size under 200 KB for faster load times.",
      );
    }

    if (responseTime > 3000) {
      score -= 10;
      issues.push({
        issue: `Slow server response (${responseTime}ms)`,
        severity: "High",
      });
      suggestions.push(
        "Improve server response time — aim for under 1 second.",
      );
    } else if (responseTime > 1500) {
      score -= 5;
      issues.push({
        issue: `Moderate response time (${responseTime}ms)`,
        severity: "Medium",
      });
      suggestions.push(
        "Optimize server-side rendering or use a CDN to reduce response time.",
      );
    }

    if (!url.startsWith("https://")) {
      score -= 10;
      issues.push({ issue: "Site not using HTTPS", severity: "High" });
      suggestions.push(
        "Enable HTTPS — it is a Google ranking factor and builds customer trust.",
      );
    }

    res.json({
      success: true,
      url,
      isShopify,
      score: Math.max(0, Math.min(100, score)),
      pageSize: `${(pageSize / 1024).toFixed(1)} KB`,
      responseTime: `${responseTime}ms`,
      seo: {
        title: title || "Missing",
        description: description || "Missing",
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
    console.error("[scan] Unexpected error:", err.message);
    res.status(500).json({
      success: false,
      error: "Scan failed but server is running",
    });
  }
});

// ── Global error middleware (catches any unhandled Express errors) ──
app.use((err, req, res, next) => {
  console.error("[global error]", err.message);
  res.status(500).json({
    success: false,
    error: "Something went wrong, but server is running",
  });
});

// ── Start server ──────────────────────────────────────────────────

// 🔥 AI ANALYSIS ROUTE
app.post("/ai-analysis", async (req, res) => {
  try {
    const { scanData } = req.body;

    if (!scanData) {
      return res.status(400).json({
        success: false,
        error: "scanData is required",
      });
    }

    const prompt = `
Analyze this Shopify store data and give actionable insights:

URL: ${scanData.url}
Score: ${scanData.score}
Page Size: ${scanData.pageSize}
Issues: ${(scanData.issues || []).map((i) => i.issue || i).join(", ")}

Give:
1. Problems
2. Fixes
3. Priority
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    res.json({
      success: true,
      ai: response.choices[0].message.content,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      success: false,
      error: "AI failed",
    });
  }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

// ── Crash prevention: never let the process die ───────────────────
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] Server kept alive:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection] Server kept alive:", reason);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received — shutting down gracefully");
  server.close(() => process.exit(0));
});
