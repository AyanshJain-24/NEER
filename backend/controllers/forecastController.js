const mockForecasts = require('../data/mockForecasts.json');
const { processForecastData } = require('../services/rulesEngine');

/**
 * Controller to fetch all processed monsoon forecasts
 */
exports.getAllForecasts = (req, res) => {
  try {
    const processed = processForecastData(mockForecasts);
    return res.status(200).json(processed);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};