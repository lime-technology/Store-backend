const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// GET / - Health check
app.get('/', (req, res) => {
  res.send('Server is running');
});

// GET /test - API status check
app.get('/test', (req, res) => {
  res.json({ status: 'success', message: 'API working' });
});

// POST /analyze - Shopify store analysis
app.post('/analyze', (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Analyzing store: ${url}`);

    res.json({
      score: 68,
      metrics: {
        conversionRate: '3.2%',
        visitors: 24521,
        addToCart: '8.7%',
        checkoutDrop: '42.1%'
      },
      issues: [
        { title: 'Missing product images', severity: 'High', page: '/product' },
        { title: 'Slow page load', severity: 'High', page: '/home' },
        { title: 'Weak CTA', severity: 'Medium', page: '/product' },
        { title: 'Broken links', severity: 'Low', page: '/footer' }
      ],
      recommendations: [
        { text: 'Improve product images', impact: '+12% conversion' },
        { text: 'Reduce load time', impact: '+8% conversion' },
        { text: 'Fix checkout flow', impact: '+18% conversion' }
      ]
    });
  } catch (err) {
    res.status(500).json({ error: 'Analysis failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
