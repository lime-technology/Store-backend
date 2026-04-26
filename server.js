```js
const express = require("express");
const cors = require("cors");
const https = require("https");
const http = require("http");
const OpenAI = require("openai");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ── Helper: Fetch HTML ─────────────────────────
function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(
      url,
      {
        timeout: 8000,
        headers: {
          "User-Agent": "Mozilla/5.0 PHIX360",
        },
        rejectUnauthorized: false,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}

// ── HEALTH ─────────────────────────
app.get("/", (req, res) => res.send("Server running"));
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ── SCAN ROUTE (MAIN) ─────────────────────────
app.post("/scan", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });

    let html;
    const start = Date.now();

    try {
      html = await fetchHTML(url);
    } catch {
      return res.json({
        success: false,
        error: "Website not reachable",
      });
    }

    const responseTime = Date.now() - start;
    const pageSize = Buffer.byteLength(html, "utf8");

    const issues = [];
    let score = 100;

    // ── TITLE ─────────────────────────
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : null;

    if (!title) {
      score -= 15;
      issues.push({
        title: "Missing page title",
        severity: "High",
        fix: {
          type: "manual",
          message: "Add title tag",
          code: "<title>Your Store</title>",
          file: "theme.liquid",
          impact: "+15% SEO",
        },
      });
    }

    // ── META DESCRIPTION ─────────────────────────
    const hasDesc = /meta.*name=["']description["']/i.test(html);
    if (!hasDesc) {
      score -= 10;
      issues.push({
        title: "Missing meta description",
        severity: "High",
        fix: {
          type: "manual",
          message: "Add meta description",
          code: "<meta name='description' content='Your store description'>",
          file: "theme.liquid",
          impact: "+10% CTR",
        },
      });
    }

    // ── IMAGES ─────────────────────────
    const images = html.match(/<img[^>]+>/gi) || [];
    const missingAlt = images.filter((img) => !/alt=/i.test(img)).length;

    if (missingAlt > 0) {
      score -= 10;
      issues.push({
        title: `${missingAlt} images missing alt text`,
        severity: "High",
        fix: {
          type: "auto",
          message: "Add alt text",
          code: "<img alt='product image' />",
          shopify: "{{ image | image_tag: alt: 'Product' }}",
          file: "product.liquid",
          impact: "+10% SEO",
        },
      });
    }

    if (images.length > 20) {
      score -= 10;
      issues.push({
        title: "Images not lazy loaded",
        severity: "High",
        fix: {
          type: "auto",
          message: "Enable lazy loading",
          code: "<img loading='lazy'>",
          shopify: "{{ image | image_tag: loading: 'lazy' }}",
          file: "theme.liquid",
          impact: "+25% speed",
        },
      });
    }

    // ── PAGE SIZE ─────────────────────────
    if (pageSize > 500000) {
      score -= 10;
      issues.push({
        title: "Heavy page size",
        severity: "High",
        fix: {
          type: "manual",
          message: "Compress assets",
          code: "Use WebP images + minify CSS/JS",
          file: "theme.liquid",
          impact: "+20% speed",
        },
      });
    }

    // ── RESPONSE TIME ─────────────────────────
    if (responseTime > 2000) {
      score -= 10;
      issues.push({
        title: "Slow server response",
        severity: "High",
        fix: {
          type: "manual",
          message: "Use CDN / optimize server",
          code: "Enable caching",
          file: "hosting",
          impact: "+15% speed",
        },
      });
    }

    return res.json({
      success: true,
      url,
      score: Math.max(0, score),
      pageSize: (pageSize / 1024).toFixed(1) + " KB",
      responseTime: responseTime + " ms",
      issues,
    });
  } catch (err) {
    res.status(500).json({ error: "Scan failed" });
  }
});

// ── AI ANALYSIS ─────────────────────────
app.post("/ai-analysis", async (req, res) => {
  try {
    const { scanData } = req.body;

    const prompt = `
You are a Shopify expert.

For each issue:
- Give exact fix
- Provide Shopify code
- Mention file
- Give impact

Issues:
${JSON.stringify(scanData.issues)}
`;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const text =
      response?.output?.[0]?.content?.[0]?.text || "No AI output";

    res.json({ success: true, ai: text });
  } catch {
    res.json({ success: true, ai: "AI failed" });
  }
});

// ── START ─────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));
```
