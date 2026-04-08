const express = require('express');
const app = express();

// Test the zones router
const zonesRouter = require('./routes/zones');

app.use(express.json());
app.use('/api/zones', zonesRouter);

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Test server is running', timestamp: new Date().toISOString() });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Test server running on http://117.251.19.107:${PORT}`);
  console.log('Available endpoints:');
  console.log(`- GET http://117.251.19.107:${PORT}/test`);
  console.log(`- GET http://117.251.19.107:${PORT}/api/zones/test`);
  console.log(`- POST http://117.251.19.107:${PORT}/api/zones/check-breach`);
});

// Test the zones router
app.get('/api/zones/test', (req, res) => {
  res.json({ message: 'Zones router test endpoint', timestamp: new Date().toISOString() });
});
