const express = require("express");
const cors = require("cors");
const https = require("https");
const http = require("http");
const OpenAI = require("openai");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

// API KEYS
const keys = [
  process.env.GOOGLE_API_KEY,
  process.env.GOOGLE_API_KEY_2,
  process.env.GOOGLE_API_KEY_3
].filter(Boolean);

let currentIndex = 0;
function getKey() {
  const key = keys[currentIndex];
  currentIndex = (currentIndex + 1) % keys.length;
  return key;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ───────── FETCH HTML ─────────
function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;

    const req = client.get(url, {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0" }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}

// ───────── BASIC ROUTES ─────────
app.get("/", (req, res) => res.send("Server running"));
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/test", (req, res) => res.json({ status: "working" }));

// ───────── PAGE SPEED ─────────
async function fetchWithRetry(url) {
  if (keys.length === 0) throw new Error("No API keys");

  for (let i = 0; i < keys.length; i++) {
    const key = getKey();

    const res = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${key}`
    );

    const data = await res.json();

    if (!data.error) return data;
    if (data.error.code !== 429) throw new Error(data.error.message);
  }

  throw new Error("All keys failed");
}

app.post("/pagespeed", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    const data = await fetchWithRetry(url);

    const categories = data.lighthouseResult?.categories || {};

    res.json({
      success: true,
      performance: (categories.performance?.score || 0) * 100,
      seo: (categories.seo?.score || 0) * 100,
      accessibility: (categories.accessibility?.score || 0) * 100,
      bestPractices: (categories["best-practices"]?.score || 0) * 100,
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ───────── SCAN ─────────
app.post("/scan", async (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    const start = Date.now();
    const html = await fetchHTML(url);
    const responseTime = Date.now() - start;
    const pageSize = Buffer.byteLength(html, "utf8");

    let score = 100;
    const issues = [];

    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (!titleMatch) {
      score -= 15;
      issues.push({ title: "Missing title", severity: "High" });
    }

    const images = html.match(/<img[^>]+>/gi) || [];
    const missingAlt = images.filter(i => !/alt=/i.test(i)).length;

    if (missingAlt > 0) {
      score -= 10;
      issues.push({ title: "Images missing alt", severity: "High" });
    }

    res.json({
      success: true,
      score,
      pageSize: (pageSize / 1024).toFixed(1) + " KB",
      responseTime: responseTime + " ms",
      issues
    });

  } catch {
    res.status(500).json({ success: false, error: "Scan failed" });
  }
});

// ───────── AI ANALYSIS ─────────
app.post("/ai-analysis", async (req, res) => {
  try {
    const { scanData } = req.body;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: JSON.stringify(scanData)
    });

    const text = response?.output?.[0]?.content?.[0]?.text || "No response";

    res.json({ success: true, ai: text });

  } catch {
    res.json({ success: true, ai: "AI failed" });
  }
});

// ───────── START ─────────
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

// ───────── SAFE MODE ─────────
process.on("uncaughtException", (err) => {
  console.error("Error:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.error("Promise Error:", err);
});
