import React, { useEffect, useState } from 'react';
import axios from 'axios';
import MapView from './components/MapView';
import AdvisoryCard from './components/AdvisoryCard';
import './App.css';

/**
 * Root Application Component
 * Integrates MapView and AdvisoryCard with real-time teleconnection telemetry
 */
export default function App() {
  const [forecasts, setForecasts] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get('http://localhost:5000/api/v1/forecasts')
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setForecasts(data);
        if (data.length > 0) {
          setSelectedBlock(data[0]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch forecasts from backend:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="dashboard-root">
      {/* Top Navbar with Branding and Global Climate Telemetry Strip */}
      <nav className="navbar">
        <div className="brand-section">
          <span className="brand-icon">🌦️</span>
          <span className="brand-title">Sub-Seasonal Monsoon Advisory Platform</span>
          <span className="brand-badge">Panchayat Scale</span>
        </div>

        <div className="telemetry-strip">
          <div className="telemetry-pill">
            <span className="telemetry-indicator"></span>
            <span>ENSO:</span>
            <strong>{selectedBlock?.teleconnection_signals?.enso_phase || 'Neutral'}</strong>
          </div>
          <div className="telemetry-pill">
            <span className="telemetry-indicator"></span>
            <span>IOD:</span>
            <strong>{selectedBlock?.teleconnection_signals?.iod_status || 'Neutral'}</strong>
          </div>
          <div className="telemetry-pill">
            <span className="telemetry-indicator"></span>
            <span>MJO Phase:</span>
            <strong>{selectedBlock?.teleconnection_signals?.mjo_phase ?? 'N/A'}</strong>
          </div>
        </div>
      </nav>

      {/* Main Viewport: Map View & Advisory Sidebar */}
      {loading ? (
        <div
          className="main-viewport"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)'
          }}
        >
          <p>Loading downscaled meteorological data...</p>
        </div>
      ) : (
        <main className="main-viewport">
          <MapView
            forecasts={forecasts}
            selectedBlock={selectedBlock}
            onSelectBlock={setSelectedBlock}
          />
          <AdvisoryCard block={selectedBlock} />
        </main>
      )}
    </div>
  );
}