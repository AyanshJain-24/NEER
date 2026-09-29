import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function LocationDetailModal({
  block,
  onClose,
  lang = 'en',
  t,
  scenario = 'late_season',
  theme = 'light'
}) {
  const [selectedCrop, setSelectedCrop] = useState('ALL');
  const [phone, setPhone] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!block) return null;

  const isFalseOnset = scenario === 'kharif_onset' && block.false_onset?.detected;
  const riskTier = (block.risk_level || 'LOW').toUpperCase();
  const color = isFalseOnset ? '#dc2626' : (block.color_code || (riskTier === 'HIGH' ? '#dc2626' : riskTier === 'MODERATE' ? '#d97706' : '#16a34a'));

  // Metrics extraction with honest empirical labels
  const drySpellRisk = block.risk_assessments?.dry_spell_risk_pct ?? block.probabilities?.continuous_dry_spell_pct ?? 0;
  const downpourRisk = block.risk_assessments?.heavy_downpour_risk_pct ?? block.probabilities?.heavy_downpour_risk_pct ?? 0;
  const onsetRisk = block.risk_assessments?.onset_risk_pct ?? block.probabilities?.onset_probability_pct ?? 0;
  const anomaly = block.metrics?.expected_rainfall_anomaly_mm ?? 0;
  const breakDays = block.metrics?.predicted_break_days ?? 0;
  const activeDays = block.metrics?.predicted_active_days ?? 0;
  const soilMoisture = block.metrics?.soil_moisture_index ?? 0.40;

  // Filter advisories based on selected crop
  const advisories = block.advisories || [];
  const filteredAdvisories = selectedCrop === 'ALL'
    ? advisories
    : advisories.filter(a => a.crop === selectedCrop);

  // Share via WhatsApp client intent
  const handleShareWhatsApp = () => {
    const primaryAdv = advisories.length > 0 ? advisories[0] : null;
    const regionalAdvText = primaryAdv?.regional_text?.[lang] || primaryAdv?.action || 'Maintain standard crop drainage and soil moisture management.';
    const cropName = primaryAdv?.crop ? `${primaryAdv.crop} (${primaryAdv.stage || ''})` : 'Kharif Crops';

    const messageLines = [
      `🌱 *${t.appTitle.toUpperCase()} — ${block.block_name.toUpperCase()} TALUKA* 🌱`,
      `📍 ${block.district} District, Maharashtra • ID: ${block.block_id}`,
      `⚠️ *${t.riskLow.includes('Risk') ? 'RISK LEVEL' : 'धोका पातळी'}:* ${riskTier} RISK`,
      `🌧️ *${t.rainfallAnomaly}:* ${anomaly > 0 ? '+' : ''}${anomaly} mm`,
      `☀️ *${t.breakDays}:* ${breakDays} ${t.days}`,
      `💧 *${t.soilMoisture}:* ${soilMoisture}`,
      isFalseOnset ? `\n🚨 *${t.falseOnsetWarning}*\n👉 ${block.false_onset?.agronomic_directive || ''}` : '',
      `\n📢 *${t.cropAdvisoriesTitle} [${cropName}]:*`,
      `${regionalAdvText}`,
      primaryAdv?.reason ? `\n💡 *${t.rationale}:* ${primaryAdv.reason}` : '',
      `\n🌐 _${t.methodologyTitle}: ${t.provenanceModel} + ${t.provenanceDerived}_`
    ].filter(Boolean).join('\n');

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodeURIComponent(messageLines)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(messageLines)}`;

    window.open(url, '_blank', 'noopener,noreferrer');
    setToastMsg(t.shareWhatsAppSub + ' ✓');
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Trigger automated backend gateway dispatch
  const handleAutomatedDispatch = async () => {
    setDispatchLoading(true);
    setDispatchResult(null);
    try {
      const payload = {
        customPhone: phone.trim() || undefined,
        customLang: lang,
        selectedCrop: selectedCrop !== 'ALL' ? selectedCrop : undefined,
        horizon: 'cumulative_s2s'
      };

      const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/v1/farmers/trigger-alert/${block.block_id}`, payload);
      setDispatchResult({
        success: true,
        mode: res.data?.mode || 'console_fallback',
        message: `${t.dispatchSuccess}! (${res.data?.dispatched_count || 1} recipient${(res.data?.dispatched_count || 1) > 1 ? 's' : ''})`
      });
    } catch (err) {
      console.warn('[Alert Dispatch Error]:', err.message);
      setDispatchResult({
        success: false,
        mode: 'error',
        message: err.response?.data?.message || 'Gateway connection notice: operating in test mode.'
      });
    } finally {
      setDispatchLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-location-title">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>

        {/* Modal Top Header Bar */}
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="location-pin-icon" aria-hidden="true">📍</span>
            <div>
              <div className="modal-breadcrumb">
                {t.adminLevel} &bull; {t.districtState}
              </div>
              <h2 id="modal-location-title" className="modal-title">
                {block.block_name} {lang === 'mr' ? 'तालुका' : (lang === 'hi' ? 'तालुका' : 'Taluka / Block')}
              </h2>
              <div className="modal-topography-tag">
                {block.topography || 'Semi-Arid Transition Plain'}
              </div>
            </div>
          </div>

          <div className="modal-header-right">
            <span
              className="modal-risk-badge"
              style={{
                backgroundColor: isFalseOnset ? '#dc2626' : color,
                color: '#ffffff'
              }}
            >
              {isFalseOnset ? t.riskCritical : `${riskTier} RISK`}
            </span>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label={t.close}
              title={t.close}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="modal-body">

          {/* CRITICAL FALSE ONSET HAZARD BANNER */}
          {isFalseOnset && (
            <div className="alert-banner-danger" role="alert">
              <div className="alert-banner-header">
                <span className="alert-banner-icon">🚨</span>
                <div>
                  <h3 className="alert-banner-title">{t.falseOnsetWarning}</h3>
                  <div className="alert-banner-subtitle">{t.falseOnsetSub}</div>
                </div>
              </div>
              <p className="alert-banner-text">
                {block.false_onset?.summary}
              </p>
              <div className="alert-directive-box">
                <strong>👉 {t.directive}:</strong> {block.false_onset?.agronomic_directive}
              </div>
              <div className="alert-safe-window">
                <strong>⏱️ {t.safeSowingWindow}:</strong> {block.false_onset?.safe_sowing_window || 'Week 3 (Revival Phase)'}
              </div>
            </div>
          )}

          {/* EMPIRICAL METRICS GRID */}
          <div className="modal-section">
            <div className="section-title-wrap">
              <h4 className="section-title">{t.forecastHorizon}</h4>
              <span className="provenance-chip chip-model">{t.provenanceModel}</span>
            </div>

            <div className="metrics-grid">
              {/* Rainfall Anomaly */}
              <div className="metric-box">
                <div className="metric-label">{t.rainfallAnomaly}</div>
                <div className={`metric-number ${anomaly >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {anomaly > 0 ? `+${anomaly}` : anomaly} <span className="metric-unit">mm</span>
                </div>
                <div className="metric-note">{t.provenanceClimatology}: {block.normal_weekly_mm ? block.normal_weekly_mm.reduce((a, b) => a + b, 0) : '33.5'} mm</div>
              </div>

              {/* Heuristic Dry Spell Risk */}
              <div className="metric-box">
                <div className="metric-label">{t.drySpellRisk}</div>
                <div className="metric-number text-risk-dry">
                  {drySpellRisk} <span className="metric-unit">/ 100</span>
                </div>
                <div className="metric-note">Empirical index (ratio vs normal); not calibrated %</div>
              </div>

              {/* Heuristic Heavy Downpour Risk */}
              <div className="metric-box">
                <div className="metric-label">{t.downpourRisk}</div>
                <div className="metric-number text-risk-downpour">
                  {downpourRisk} <span className="metric-unit">/ 100</span>
                </div>
                <div className="metric-note">Threshold score (&gt;25mm event sensitivity)</div>
              </div>

              {/* Break Days & Soil Moisture */}
              <div className="metric-box">
                <div className="metric-label">{t.breakDays}</div>
                <div className="metric-number text-neutral">
                  {breakDays} <span className="metric-unit">{t.days}</span>
                </div>
                <div className="metric-note">{t.soilMoisture}: <strong>{soilMoisture}</strong></div>
              </div>
            </div>
          </div>

          {/* MULTI-HORIZON SUB-SEASONAL BREAKDOWN (WEEKS 1 TO 4) */}
          {block.horizons && (
            <div className="modal-section">
              <div className="section-title-wrap">
                <h4 className="section-title">Weekly Forecast Horizons Breakdown (Weeks 1–4)</h4>
                <span className="provenance-chip chip-hybrid">Weeks 1-2 Downscaled • Weeks 3-4 Extended</span>
              </div>

              <div className="horizons-grid">
                {Object.entries(block.horizons).map(([wKey, hVal], index) => {
                  const isExtended = index >= 2;
                  const wRisk = hVal.risk_assessments?.dry_spell_risk_pct ?? hVal.probabilities?.continuous_dry_spell_pct ?? 0;
                  const wAnomaly = hVal.expected_rainfall_anomaly_mm ?? 0;

                  return (
                    <div key={wKey} className="horizon-card">
                      <div className="horizon-card-top">
                        <span className="horizon-badge">
                          {wKey === 'week_1' ? 'Week 1 (Days 1–7)' : (wKey === 'week_2' ? 'Week 2 (Days 8–14)' : (wKey === 'week_3' ? 'Week 3 (Days 15–21)' : 'Week 4 (Days 22–30)'))}
                        </span>
                        <span className={`horizon-provenance ${isExtended ? 'prov-extended' : 'prov-neural'}`}>
                          {isExtended ? 'Experimental Extension' : 'ConvLSTM Neural'}
                        </span>
                      </div>
                      <div className="horizon-numbers">
                        <div>
                          <div className="horizon-sublabel">Rainfall / Anomaly</div>
                          <div className="horizon-val">
                            {hVal.predicted_rainfall_mm ?? 0} mm
                            <span className={`horizon-anom ${wAnomaly >= 0 ? 'text-positive' : 'text-negative'}`}>
                              ({wAnomaly > 0 ? '+' : ''}{wAnomaly} mm)
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="horizon-sublabel">Break Risk / Days</div>
                          <div className="horizon-val">
                            {wRisk}/100 &bull; {hVal.metrics?.predicted_break_days ?? 0}d
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PANCHAYAT-ADJUSTED ESTIMATES (TOPOGRAPHIC CLUSTERS) */}
          {block.panchayat_clusters && block.panchayat_clusters.length > 0 && (
            <div className="modal-section">
              <div className="section-title-wrap">
                <h4 className="section-title">{t.panchayatsTitle}</h4>
                <span className="provenance-chip chip-synthetic">{t.provenanceOffset}</span>
              </div>
              <p className="section-disclaimer">
                ℹ️ {t.panchayatsNotice}
              </p>
              <div className="panchayats-table-wrap">
                <table className="panchayats-table">
                  <thead>
                    <tr>
                      <th>Panchayat Cluster</th>
                      <th>Rainfall Offset vs Taluka</th>
                      <th>Soil Moisture</th>
                      <th>Vulnerability Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.panchayat_clusters.map((p) => (
                      <tr key={p.panchayat_id}>
                        <td><strong>📍 {p.panchayat_name}</strong></td>
                        <td className={p.rainfall_anomaly_mm >= 0 ? 'text-positive' : 'text-negative'}>
                          {p.rainfall_anomaly_mm > 0 ? `+${p.rainfall_anomaly_mm}` : p.rainfall_anomaly_mm} mm
                        </td>
                        <td>{p.soil_moisture_index}</td>
                        <td>
                          <span className={`tier-badge ${p.risk_tier === 'HIGH' ? 'tier-high' : (p.risk_tier === 'MODERATE' ? 'tier-moderate' : 'tier-low')}`}>
                            {p.risk_tier}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CROP-SPECIFIC AGRONOMIC ADVISORIES */}
          <div className="modal-section">
            <div className="section-title-wrap">
              <h4 className="section-title">{t.cropAdvisoriesTitle}</h4>
              <span className="provenance-chip chip-rule">MPKV Rahuri / ICAR Rules</span>
            </div>

            {/* Crop Filter Tabs */}
            <div className="crop-pill-bar" role="tablist">
              {['ALL', 'Soybean', 'Cotton', 'Bajra', 'Groundnut', 'Maize', 'Sugarcane'].map((cropKey) => (
                <button
                  key={cropKey}
                  type="button"
                  role="tab"
                  aria-selected={selectedCrop === cropKey}
                  className={`crop-pill-btn ${selectedCrop === cropKey ? 'active' : ''}`}
                  onClick={() => setSelectedCrop(cropKey)}
                >
                  {cropKey === 'ALL' ? t.cropFilterAll : cropKey}
                </button>
              ))}
            </div>

            {/* Advisories Cards List */}
            <div className="advisories-container">
              {filteredAdvisories.length > 0 ? (
                filteredAdvisories.map((adv, idx) => {
                  const regionalVernacular = adv.regional_text?.[lang] || adv.regional_text?.['hi'] || adv.action;

                  return (
                    <div key={idx} className="advisory-item-card">
                      <div className="adv-item-header">
                        <div>
                          <span className="adv-crop-name">{adv.crop}</span>
                          {lang === 'mr' && adv.crop_mr && <span className="adv-crop-vernacular"> ({adv.crop_mr})</span>}
                          {lang === 'hi' && adv.crop_hi && <span className="adv-crop-vernacular"> ({adv.crop_hi})</span>}
                          <span className="adv-condition-tag"> &bull; {adv.risk_condition || 'Active Stage'}</span>
                        </div>
                        <span className="adv-stage-badge">{adv.stage}</span>
                      </div>

                      {/* Primary Action */}
                      <div className="adv-action-row">
                        <strong>{t.action}:</strong> {adv.action}
                      </div>

                      {/* Timing & Scientific Rationale */}
                      {adv.timing && (
                        <div className="adv-timing-row">
                          ⏱️ <strong>{t.timing}:</strong> {adv.timing}
                        </div>
                      )}
                      {adv.reason && (
                        <div className="adv-reason-row">
                          💡 <strong>{t.rationale}:</strong> {adv.reason}
                        </div>
                      )}

                      {/* Regional Indian Language High-Impact Banner */}
                      <div className="adv-vernacular-box">
                        <span className="vernacular-lang-tag">
                          {lang === 'mr' ? '📢 मराठी सल्ला:' : (lang === 'hi' ? '📢 हिन्दी परामर्श:' : '📢 Regional Directive:')}
                        </span>
                        <div className="vernacular-text">{regionalVernacular}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="advisories-empty">
                  No specific advisory alert triggered for {selectedCrop} in this taluka under the active weather pattern. Follow routine cultivation guidelines.
                </div>
              )}
            </div>
          </div>

          {/* FARMER OUTREACH & DISPATCH SECTION */}
          <div className="modal-section dispatch-section">
            <h4 className="section-title">Farmer Advisory Communication & WhatsApp Gateway</h4>

            <div className="dispatch-form-grid">
              <div>
                <label className="dispatch-input-label" htmlFor="farmer-handset-input">
                  Recipient Mobile Handset
                </label>
                <input
                  id="farmer-handset-input"
                  type="tel"
                  placeholder={t.phonePlaceholder}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="dispatch-input"
                />
              </div>

              <div className="dispatch-buttons-row">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="btn-share-whatsapp"
                >
                  <span>📲</span> {t.shareWhatsApp}
                </button>

                <button
                  type="button"
                  onClick={handleAutomatedDispatch}
                  disabled={dispatchLoading}
                  className="btn-auto-dispatch"
                >
                  <span>⚡</span> {dispatchLoading ? 'Dispatching...' : t.autoDispatch}
                </button>
              </div>
            </div>

            {toastMsg && <div className="dispatch-toast">✅ {toastMsg}</div>}

            {dispatchResult && (
              <div className={`dispatch-result-box ${dispatchResult.success ? 'res-success' : 'res-warn'}`}>
                <div className="result-mode">
                  <strong>{t.dispatchMode}:</strong> {dispatchResult.mode === 'twilio_live' ? t.dispatchLive : t.dispatchSimulated}
                </div>
                <div>{dispatchResult.message}</div>
              </div>
            )}

            <div className="dispatch-footer-notice">
              ⚠️ {t.smsNotice}
            </div>
          </div>

          {/* EXPANDABLE METHODOLOGY & PROVENANCE DISCLOSURE */}
          <div className="modal-section technical-accordion">
            <button
              type="button"
              onClick={() => setShowTechDetails(!showTechDetails)}
              className="accordion-toggle-btn"
              aria-expanded={showTechDetails}
            >
              <span>🔬 {t.methodologyTitle}</span>
              <span>{showTechDetails ? '▲ Hide' : '▼ Expand'}</span>
            </button>

            {showTechDetails && (
              <div className="accordion-content">
                <p>
                  <strong>Physical Model:</strong> {t.methodologyBody}
                </p>
                <div className="provenance-legend-list">
                  <div>• <strong>Observed Planetary Indices:</strong> Real-time feeds from NOAA CPC (Niño 3.4 SST) and BoM Australia (IOD DMI, MJO RMM).</div>
                  <div>• <strong>Weeks 1–2 Downscaling:</strong> PyTorch ConvLSTM downscaling 8-channel ERA5 atmospheric state (500 & 850 hPa $q, z, u, v$) to 14x18 spatial grid.</div>
                  <div>• <strong>Weeks 3–4 Extension:</strong> Statistical teleconnection-informed climatological modifiers ($0.95$ & $1.25$ multipliers), not dynamical neural step predictions.</div>
                  <div>• <strong>Risk Scores:</strong> Uncalibrated empirical indicators ($0–100$ scale), representing moisture stress sensitivity rather than frequentist or Bayesian event probabilities.</div>
                  <div>• <strong>Panchayat Clusters:</strong> Topographic offsets derived from local knowledge and elevation gradients, not independently modeled or validated weather stations.</div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <div className="modal-footer-info">
            Ref: IMD Pune District LPA (1991–2020) &bull; Crop Norms: MPKV Rahuri
          </div>
          <button
            type="button"
            className="btn-modal-close-action"
            onClick={onClose}
          >
            {t.close}
          </button>
        </div>

      </div>
    </div>
  );
}
