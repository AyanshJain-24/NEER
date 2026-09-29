
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const forecastController = require('./controllers/forecastController');
const farmerController = require('./controllers/farmerController');

const app = express();

app.use(cors());
app.use(express.json());

// Health check — useful for Render deployment
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'NEER backend is running'
  });
});

// Forecast API
app.get(
  '/api/v1/forecasts',
  forecastController.getAllForecasts
);

// Individual farmer/block alert API
app.post(
  '/api/v1/farmers/trigger-alert/:blockId',
  farmerController.triggerBlockAlert
);

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NEER backend running on port ${PORT}`);
});