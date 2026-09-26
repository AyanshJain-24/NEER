const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

const MOCK_DATA_PATH = path.join(__dirname, 'data', 'mockForecasts.json');
// Path to the Python executable in your virtual environment
const PYTHON_PATH = path.resolve(__dirname, '../ml-pipeline/venv/Scripts/python.exe');
const INFERENCE_SCRIPT = path.resolve(__dirname, '../ml-pipeline/src/inference.py');

// Helper function to execute the PyTorch inference script on demand
function runMLInference() {
  return new Promise((resolve, reject) => {
    console.log('[ML-TRIGGER] Executing PyTorch inference script...');
    exec(`"${PYTHON_PATH}" "${INFERENCE_SCRIPT}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`[ML-ERROR] Inference failed: ${stderr || error.message}`);
        // Resolve anyway so the server can fall back to the existing JSON data
        return resolve(false);
      }
      console.log(`[ML-SUCCESS] Model inference output:\n${stdout}`);
      resolve(true);
    });
  });
}

// 1. Run inference once immediately when backend server boots up
runMLInference();

// 2. Endpoint: Runs ML model dynamically on each request (e.g., page refresh)
app.get('/api/v1/forecasts', async (req, res) => {
  // If ?refresh=true is provided (or by default on fetch), run inference before returning data
  await runMLInference();

  try {
    const rawData = fs.readFileSync(MOCK_DATA_PATH, 'utf-8');
    const forecasts = JSON.parse(rawData);
    res.status(200).json({
      success: true,
      count: forecasts.length,
      data: forecasts
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to read forecast data',
      error: err.message
    });
  }
});

// Endpoint: Fetch single block
app.get('/api/v1/forecasts/:blockId', (req, res) => {
  try {
    const rawData = fs.readFileSync(MOCK_DATA_PATH, 'utf-8');
    const forecasts = JSON.parse(rawData);
    const block = forecasts.find(f => f.block_id === req.params.blockId);

    if (!block) {
      return res.status(404).json({ success: false, message: 'Block not found' });
    }

    res.status(200).json({ success: true, data: block });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error reading data' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});