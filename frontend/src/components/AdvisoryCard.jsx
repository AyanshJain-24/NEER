import React, { useState } from 'react';
import axios from 'axios';

/**
 * Agro-Advisory Sidebar Component with Live WhatsApp Gateway Integration
 * Displays probabilistic outlook, localized crop actions with vernacular translations,
 * and allows triggering regional SMS/WhatsApp broadcasts with custom handset override.
 */
export default function AdvisoryCard({ block }) {
  const [lang, setLang] = useState('hi');
  const [customPhone, setCustomPhone] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastLog, setBroadcastLog] = useState(null);

  if (!block) {
    return (
      <div className="sidebar-panel">
        <div className="panel-card empty-card">
          <div className="empty-card-icon">📍</div>
          <h3 style={{ marginBottom: '0.5rem', color: '#fff' }}>No Block Selected</h3>
          <p className="empty-card-text">
            Click on any circle on the map to inspect teleconnection anomalies, probabilistic outlook, and regional crop advisories.
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
        customLang: lang
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

  return (
    <div className="sidebar-panel">
      {/* Header Block Info Card */}
      <div className="panel-card">
        <div className="block-header-wrap">
          <div>
            <div className="block-title-sub">{block.district} District</div>
            <h2 className="block-title-main">{block.block_name} Block</h2>
            <div className="block-location">
              {block.state}, India &bull; Block ID: {block.block_id}
            </div>
          </div>
          <span
            className="risk-badge"
            style={{
              backgroundColor: riskColor,
              color: block.risk_level === 'MODERATE' ? '#1f2937' : '#ffffff'
            }}
          >
            {block.risk_level || 'LOW'} RISK
          </span>
        </div>
      </div>

      {/* Probabilistic Outlook Grid Card */}
      <div className="panel-card">
        <div className="section-heading" style={{ marginBottom: '0.75rem' }}>
          Probabilistic Outlook (7–30 Days)
        </div>
        <div className="stat-metric-grid">
          <div className="metric-cell">
            <div className="metric-label">Dry Spell Probability</div>
            <div className="metric-value">
              {block.probabilities?.continuous_dry_spell_pct ?? 0}
              <span className="metric-unit">%</span>
            </div>
          </div>

          <div className="metric-cell">
            <div className="metric-label">Heavy Downpour Risk</div>
            <div className="metric-value">
              {block.probabilities?.heavy_downpour_risk_pct ?? 0}
              <span className="metric-unit">%</span>
            </div>
          </div>

          <div className="metric-cell">
            <div className="metric-label">Predicted Break Days</div>
            <div className="metric-value">
              {block.metrics?.predicted_break_days ?? 0}
              <span className="metric-unit">days</span>
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
      </div>

      {/* WhatsApp Alert Gateway Card */}
      <div className="panel-card broadcast-card">
        <div className="section-heading">WhatsApp Alert Gateway</div>
        <p className="broadcast-info">
          Transmit localized WhatsApp advisories to farmers in {block.block_name} or enter a test handset number.
        </p>

        {/* Custom Phone Number Input Field */}
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
          {broadcasting ? '⚡ Transmitting via Gateway...' : '📲 Broadcast WhatsApp Advisory'}
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
                    {broadcastLog.mode === 'twilio_live' ? '🚀 WhatsApp Transmitted' : '📝 Gateway Logged (Fallback)'}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: broadcastLog.mode === 'twilio_live' ? 'rgba(6,182,212,0.25)' : 'rgba(255,255,255,0.12)',
                      color: broadcastLog.mode === 'twilio_live' ? '#22d3ee' : '#94a3b8',
                      fontWeight: 600
                    }}
                  >
                    {broadcastLog.mode === 'twilio_live' ? 'TWILIO LIVE' : 'CONSOLE STREAM'}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem' }}>
                  Dispatched to <strong>{broadcastLog.dispatched_count} recipient(s)</strong> in {block.block_name} ({lang === 'mr' ? 'मराठी' : 'हिन्दी'}).
                </div>

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

      {/* Localized Crop Actions with Language Switcher */}
      <div className="panel-card">
        <div className="section-header-row">
          <div className="section-heading">Crop-Specific Advisories</div>
          <div className="lang-toggle-wrap">
            <button
              type="button"
              className={`lang-toggle-btn ${lang === 'hi' ? 'active' : ''}`}
              onClick={() => setLang('hi')}
            >
              हिन्दी (Hindi)
            </button>
            <button
              type="button"
              className={`lang-toggle-btn ${lang === 'mr' ? 'active' : ''}`}
              onClick={() => setLang('mr')}
            >
              मराठी (Marathi)
            </button>
          </div>
        </div>

        <div className="advisories-list">
          {block.advisories && block.advisories.length > 0 ? (
            block.advisories.map((advisory, idx) => (
              <div className="crop-card" key={idx}>
                <div className="crop-card-top">
                  <span className="crop-name">{advisory.crop}</span>
                  <span className="crop-stage">Stage: {advisory.stage}</span>
                </div>
                <p className="crop-action">{advisory.action}</p>
                <div className="crop-vernacular">
                  {advisory.regional_text?.[lang] || advisory.regional_text?.['hi'] || advisory.action}
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              No crop advisories available for this block.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}