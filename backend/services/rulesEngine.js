/**
 * Monsoon Advisory Platform - Rules Engine Service
 */

function evaluateBlockRisk(forecast) {
  const continuous_dry_spell_pct = forecast?.probabilities?.continuous_dry_spell_pct ?? 0;
  const predicted_break_days = forecast?.metrics?.predicted_break_days ?? 0;

  let risk_level = "LOW";
  let color_code = "#10b981"; // Emerald green for Low risk

  if (continuous_dry_spell_pct >= 70 || predicted_break_days >= 14) {
    risk_level = "HIGH";
    color_code = "#ef4444"; // Red for High risk
  } else if (continuous_dry_spell_pct >= 40 || predicted_break_days >= 7) {
    risk_level = "MODERATE";
    color_code = "#f59e0b"; // Amber for Moderate risk
  } else {
    risk_level = "LOW";
    color_code = "#10b981";
  }

  return { risk_level, color_code };
}

function processForecastData(rawList) {
  if (!Array.isArray(rawList)) {
    return [];
  }

  return rawList.map((item) => {
    const { risk_level, color_code } = evaluateBlockRisk(item);
    return {
      ...item,
      risk_level,
      color_code
    };
  });
}

module.exports = {
  evaluateBlockRisk,
  processForecastData
};