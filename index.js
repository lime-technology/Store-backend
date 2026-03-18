const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Server running'));
app.get('/healthz', (req, res) => res.send('OK'));

const PORT = process.env.PORT;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Running on ${PORT}`);
});
