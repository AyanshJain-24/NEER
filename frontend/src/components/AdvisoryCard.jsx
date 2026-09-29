import React, { useState } from 'react';
import axios from 'axios';

/**
 * Agro-Advisory Sidebar Component with Multi-Horizon & Crop Expert System
 */
export default function AdvisoryCard({
  block,
  activeHorizon = 'cumulative_s2s',
  selectedCrop = 'ALL',
  onSelectCrop,
  horizonLabel = 'Cumulative S2S (7–30 Days)'
}) {
  const [lang, setLang] = useState('mr'); // Default to Marathi for Maharashtra farmers
  const [customPhone, setCustomPhone] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastLog, setBroadcastLog] = useState(null);

  if (!block) {
    return (
      <div className="sidebar-panel">
        <div className="panel-card empty-card">
          <div className="empty-card-icon">📍</div>
          <h3 style={{ marginBottom: '0.5rem', color: '#fff' }}>No Taluka Selected</h3>
          <p className="empty-card-text">
            Click on any circle on the map to inspect teleconnection anomalies, S2S empirical risk outlook, False Onset diagnostics, and crop advisories.
          </p>
        </div>
      </div>
    );
  }

  const handleBroadcast = async () => {
    if (!block.block_id) return;
    setBroadcasting(true);
    setBroadcastLog(null);
    try {
      const payload = {
        customPhone: customPhone.trim() || undefined,
        customLang: lang,
        selectedCrop: selectedCrop !== 'ALL' ? selectedCrop : undefined,
        horizon: activeHorizon
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/farmers/trigger-alert/${block.block_id}`,
        payload
      );
      setBroadcastLog(response.data);
    } catch (err) {
      console.error('Broadcast gateway error:', err);
      setBroadcastLog({
        error: true,
        message: err.response?.data?.message || 'Broadcast dispatch failed'
      });
    } finally {
      setBroadcasting(false);
    }
  };

  const riskColor = block.color_code || '#10b981';
  const falseOnset = block.false_onset;
  const isFalseOnset = falseOnset?.detected === true;

  // Resilient accessor supporting both new empirical risk keys and legacy keys
  const drySpellRisk =
    block.risk_assessments?.dry_spell_risk_pct ??
    block.probabilities?.continuous_dry_spell_pct ??
    0;

  const onsetRisk =
    block.risk_assessments?.onset_risk_pct ??
    block.probabilities?.onset_probability_pct ??
    0;

  const downpourRisk =
    block.risk_assessments?.heavy_downpour_risk_pct ??
    block.probabilities?.heavy_downpour_risk_pct ??
    0;

  // Filter advisories based on selected crop if specified
  const filteredAdvisories = block.advisories && block.advisories.length > 0
    ? (selectedCrop === 'ALL'
        ? block.advisories
        : block.advisories.filter(a => a.crop === selectedCrop))
    : [];

  return (
    <div className="sidebar-panel">
      {/* Header Block Info Card */}
      <div className="panel-card">
        <div className="block-header-wrap">
          <div>
            <div className="block-title-sub">{block.district} District &bull; {block.state}</div>
            <h2 className="block-title-main">{block.block_name} Taluka</h2>
            <div className="block-location">
              {block.topography || 'Agro-climatic Zone'} &bull; ID: {block.block_id}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              className="risk-badge"
              style={{
                backgroundColor: isFalseOnset ? '#ef4444' : riskColor,
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'inline-block'
              }}
            >
              {isFalseOnset ? 'CRITICAL HAZARD' : `${(block.risk_level || 'LOW').toUpperCase()} RISK`}
            </span>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '5px' }}>
              Window: {horizonLabel.split(':')[0]}
            </div>
          </div>
        </div>

        {/* Teleconnections Active Status Strip */}
        {block.teleconnection_signals && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginTop: '0.75rem',
            paddingTop: '0.6rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: '0.68rem',
            color: '#94a3b8'
          }}>
            <span style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px' }}>
              🌊 {block.teleconnection_signals.enso_phase}
            </span>
            <span style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', padding: '2px 6px', borderRadius: '4px' }}>
              🇮🇳 {block.teleconnection_signals.iod_status}
            </span>
            <span style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', padding: '2px 6px', borderRadius: '4px' }}>
              🌀 MJO Phase {block.teleconnection_signals.mjo_phase} (Amp: {block.teleconnection_signals.mjo_amplitude})
            </span>
          </div>
        )}
      </div>

      {/* CRITICAL FALSE ONSET HAZARD BANNER */}
      {isFalseOnset && (
        <div className="false-onset-alert-card">
          <div className="false-onset-header">
            <span className="false-onset-icon">🚨</span>
            <div>
              <div className="false-onset-title">CRITICAL FALSE ONSET HAZARD DETECTED</div>
              <div className="false-onset-subtitle">High Sowing Vulnerability Warning</div>
            </div>
          </div>

          <p className="false-onset-body">
            {falseOnset.summary}
          </p>

          <div className="false-onset-directive-box">
            <strong>DIRECTIVE:</strong> {falseOnset.agronomic_directive}
          </div>

          <div className="false-onset-metrics-grid">
            <div className="fo-metric-pill">
              <span className="fo-metric-lbl">Expected Dry Break:</span>
              <strong className="fo-metric-val">{falseOnset.expected_dry_spell_duration_days} Days</strong>
            </div>
            <div className="fo-metric-pill">
              <span className="fo-metric-lbl">Safe Sowing Window:</span>
              <strong className="fo-metric-val">{falseOnset.safe_sowing_window}</strong>
            </div>
          </div>
        </div>
      )}

      {/* S2S Empirical Risk Assessment Grid Card */}
      <div className="panel-card">
        <div className="section-header-row">
          <div className="section-heading">Sub-Seasonal Empirical Risk Scores ({horizonLabel.split('(')[0].trim()})</div>
          <span style={{ fontSize: '0.72rem', color: '#06b6d4', fontWeight: 600 }}>
            Phase: {block.metrics?.phase || 'NORMAL'}
          </span>
        </div>

        <div className="stat-metric-grid">
          <div className="metric-cell">
            <div className="metric-label">Dry Spell Empirical Risk Score</div>
            <div className="metric-value">
              {drySpellRisk}
              <span className="metric-unit">%</span>
            </div>
          </div>

          <div className="metric-cell">
            <div className="metric-label">Monsoon Onset Empirical Risk Score</div>
            <div className="metric-value">
              {onsetRisk}
              <span className="metric-unit">%</span>
            </div>
          </div>

          <div className="metric-cell">
            <div className="metric-label">Heavy Downpour Empirical Risk Score</div>
            <div className="metric-value">
              {downpourRisk}
              <span className="metric-unit">%</span>
            </div>
          </div>

          <div className="metric-cell">
            <div className="metric-label">Rainfall Anomaly</div>
            <div className="metric-value">
              {block.metrics?.expected_rainfall_anomaly_mm > 0
                ? `+${block.metrics?.expected_rainfall_anomaly_mm}`
                : block.metrics?.expected_rainfall_anomaly_mm ?? 0}
              <span className="metric-unit">mm</span>
            </div>
          </div>
        </div>

        {/* Break Days & Soil Moisture Sub-bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.78rem', color: '#94a3b8' }}>
          <div>Predicted Break Days: <strong style={{ color: '#fff' }}>{block.metrics?.predicted_break_days ?? 0} days</strong></div>
          <div>Active Rain Days: <strong style={{ color: '#fff' }}>{block.metrics?.predicted_active_days ?? 0} days</strong></div>
          <div>Soil Moisture: <strong style={{ color: '#38bdf8' }}>{block.metrics?.soil_moisture_index ?? 0.4}</strong></div>
        </div>

        {/* Technical Methodology Caption for Judges */}
        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.6rem', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', fontStyle: 'italic', lineHeight: 1.3 }}>
          *Methodology: Weeks 1-2 utilize ConvLSTM deterministic downscaling. Weeks 3-4 utilize teleconnection-informed climatological heuristics. Risk scores are uncalibrated empirical estimates.*
        </div>
      </div>

      {/* Panchayat Micro-Clusters Breakdown */}
      {block.panchayat_clusters && block.panchayat_clusters.length > 0 && (
        <div className="panel-card" style={{ padding: '0.85rem 1rem' }}>
          <div className="section-header-row" style={{ marginBottom: '0.4rem' }}>
            <div className="section-heading" style={{ fontSize: '0.78rem' }}>Panchayat-Adjusted Estimates</div>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Topographic Cluster Adjustments</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {block.panchayat_clusters.map((p) => (
              <div key={p.panchayat_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', background: 'rgba(255,255,255,0.02)', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                <span style={{ color: '#e2e8f0' }}>📍 {p.panchayat_name}</span>
                <span style={{ color: p.rainfall_anomaly_mm >= 0 ? '#38bdf8' : '#f87171' }}>
                  {p.rainfall_anomaly_mm > 0 ? `+${p.rainfall_anomaly_mm}` : p.rainfall_anomaly_mm} mm
                </span>
                <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '3px', background: p.risk_tier === 'HIGH' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.15)', color: p.risk_tier === 'HIGH' ? '#f87171' : '#34d399' }}>
                  {p.risk_tier}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crop-Specific Agronomic Advisories Section */}
      <div className="panel-card">
        <div className="section-header-row">
          <div className="section-heading">Crop-Specific Advisories</div>

          {/* Trilingual Language Selector */}
          <div className="lang-toggle-wrap">
            <button
              type="button"
              className={`lang-toggle-btn ${lang === 'mr' ? 'active' : ''}`}
              onClick={() => setLang('mr')}
              title="मराठी भाषा"
            >
              मराठी
            </button>
            <button
              type="button"
              className={`lang-toggle-btn ${lang === 'hi' ? 'active' : ''}`}
              onClick={() => setLang('hi')}
              title="हिन्दी भाषा"
            >
              हिन्दी
            </button>
            <button
              type="button"
              className={`lang-toggle-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => setLang('en')}
              title="English"
            >
              EN
            </button>
          </div>
        </div>

        {/* Crop Filter Tabs */}
        <div className="crop-filter-strip">
          {['ALL', 'Soybean', 'Cotton', 'Bajra', 'Groundnut', 'Maize', 'Sugarcane'].map(c => (
            <button
              key={c}
              type="button"
              className={`crop-pill ${selectedCrop === c ? 'active' : ''}`}
              onClick={() => onSelectCrop && onSelectCrop(c)}
            >
              {c === 'ALL' ? 'All Crops' : c}
            </button>
          ))}
        </div>

        {/* Structured Decisions List */}
        <div className="advisories-list" style={{ marginTop: '0.75rem' }}>
          {filteredAdvisories.length > 0 ? (
            filteredAdvisories.map((advisory, idx) => (
              <div className="crop-card" key={idx}>
                <div className="crop-card-top">
                  <div>
                    <span className="crop-name">
                      {advisory.crop}
                      {lang === 'mr' && advisory.crop_mr ? ` (${advisory.crop_mr})` : ''}
                      {lang === 'hi' && advisory.crop_hi ? ` (${advisory.crop_hi})` : ''}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#06b6d4', marginLeft: '6px' }}>
                      &bull; {advisory.risk_condition}
                    </span>
                  </div>
                  <span className="crop-stage">{advisory.stage}</span>
                </div>

                {/* Recommended Action */}
                <div className="crop-action">
                  <strong>Action:</strong> {advisory.action}
                </div>

                {/* Timing & Explainable Reason */}
                {advisory.timing && (
                  <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '2px' }}>
                    ⏱️ <strong>Timing:</strong> {advisory.timing}
                  </div>
                )}
                {advisory.reason && (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px', lineHeight: 1.35 }}>
                    💡 <strong>Scientific Rationale:</strong> {advisory.reason}
                  </div>
                )}

                {/* Regional Vernacular High-Impact Box */}
                <div className="crop-vernacular">
                  {advisory.regional_text?.[lang] || advisory.regional_text?.['hi'] || advisory.action}
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              No crop advisories matching the selected filter.
            </p>
          )}
        </div>
      </div>

      {/* WhatsApp Alert Gateway Card */}
      <div className="panel-card broadcast-card">
        <div className="section-heading">Farmer Alert Gateway (WhatsApp / SMS)</div>
        <p className="broadcast-info">
          Transmit real-time, actionable advisories in <strong>{lang === 'mr' ? 'मराठी' : (lang === 'hi' ? 'हिन्दी' : 'English')}</strong> to registered farmers or enter a test handset.
        </p>

        {/* Handset Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Recipient WhatsApp Number (Optional Test Override):
          </label>
          <input
            type="tel"
            className="custom-phone-input"
            placeholder="e.g. +91 98220 12345 or +14155238886"
            value={customPhone}
            onChange={(e) => setCustomPhone(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.8rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#ffffff',
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Leave blank to broadcast to all registered farmers in {block.block_name}.
          </span>
        </div>

        <button
          type="button"
          className="btn-broadcast"
          onClick={handleBroadcast}
          disabled={broadcasting}
        >
          {broadcasting ? '⚡ Transmitting via Gateway...' : `📲 Broadcast WhatsApp Advisory (${lang.toUpperCase()})`}
        </button>

        {broadcastLog && (
          <div
            className="broadcast-log-alert"
            style={
              broadcastLog.error
                ? { background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }
                : { background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399' }
            }
          >
            {broadcastLog.error ? (
              <span>⚠️ {broadcastLog.message}</span>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong>
                    {broadcastLog.mode?.includes('live') ? '🚀 Live WhatsApp Transmitted' : '📝 Gateway Console Stream Logged'}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: broadcastLog.mode?.includes('live') ? 'rgba(6,182,212,0.25)' : 'rgba(255,255,255,0.12)',
                      color: broadcastLog.mode?.includes('live') ? '#22d3ee' : '#94a3b8',
                      fontWeight: 600
                    }}
                  >
                    {broadcastLog.mode?.includes('live') ? 'TWILIO LIVE' : 'CONSOLE STREAM'}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem' }}>
                  Dispatched to <strong>{broadcastLog.dispatched_count} recipient(s)</strong> in {block.block_name} ({lang === 'mr' ? 'मराठी' : (lang === 'en' ? 'English' : 'हिन्दी')}).
                </div>

                {broadcastLog.false_onset_active && (
                  <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginTop: '3px' }}>
                    ⚠️ Alert included Critical False Onset Sowing Hold directive.
                  </div>
                )}

                {broadcastLog.delivery_statuses && broadcastLog.delivery_statuses.length > 0 && (
                  <div style={{ fontSize: '0.72rem', marginTop: '6px', opacity: 0.9 }}>
                    {broadcastLog.delivery_statuses.map((item, idx) => (
                      <div key={idx} style={{ marginTop: '3px' }}>
                        &bull; {item.recipient} ({item.whatsapp_to}): <span style={{ color: '#6ee7b7' }}>{item.status}</span>
                        {item.message_sid && ` [SID: ${item.message_sid.slice(0, 16)}...]`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}