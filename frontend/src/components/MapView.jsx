import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';

/**
 * Resizes Leaflet map on mount and window resize
 */
function MapResizer() {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

export default function MapView({
  forecasts = [],
  selectedBlock,
  onSelectBlock,
  activeRiskFilter = 'ALL',
  onFilterChange,
  theme = 'light',
  t
}) {
  // Pune District centroid
  const center = [18.5204, 74.0500];

  // Authentic OpenStreetMap tiles: public, zero API-key requirement, crisp geographic detail in both themes
  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  // Calculate real category counts from active dataset
  const lowBlocks = forecasts.filter(f => (f.risk_level || '').toUpperCase() === 'LOW' && !f.false_onset?.detected);
  const modBlocks = forecasts.filter(f => (f.risk_level || '').toUpperCase() === 'MODERATE' && !f.false_onset?.detected);
  const highBlocks = forecasts.filter(f => (f.risk_level || '').toUpperCase() === 'HIGH' || f.false_onset?.detected);

  // Filter markers based on activeRiskFilter
  const displayedForecasts = forecasts.filter(block => {
    if (activeRiskFilter === 'ALL') return true;
    const isFalse = block.false_onset?.detected;
    const rLevel = (block.risk_level || '').toUpperCase();
    if (activeRiskFilter === 'HIGH') return rLevel === 'HIGH' || isFalse;
    if (activeRiskFilter === 'MODERATE') return rLevel === 'MODERATE' && !isFalse;
    if (activeRiskFilter === 'LOW') return rLevel === 'LOW' && !isFalse;
    return true;
  });

  return (
    <div className="map-view-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={center}
        zoom={9}
        scrollWheelZoom={true}
        className="leaflet-map-container"
        style={{ width: '100%', height: '100%' }}
      >
        <MapResizer />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={tileUrl}
          subdomains={['a', 'b', 'c']}
          maxZoom={18}
        />

        {displayedForecasts.map((block) => {
          const isSelected = selectedBlock?.block_id === block.block_id;
          const lat = block.coordinates?.latitude || 18.5204;
          const lng = block.coordinates?.longitude || 73.8567;
          const isFalseOnset = block.false_onset?.detected === true;
          const rLevel = (block.risk_level || 'LOW').toUpperCase();

          const markerColor = isFalseOnset
            ? '#dc2626'
            : (block.color_code || (rLevel === 'HIGH' ? '#dc2626' : (rLevel === 'MODERATE' ? '#d97706' : '#16a34a')));

          const anomaly = block.metrics?.expected_rainfall_anomaly_mm ?? 0;
          const anomalyStr = anomaly > 0 ? `+${anomaly}` : `${anomaly}`;

          return (
            <CircleMarker
              key={`${block.block_id}-${rLevel}-${activeRiskFilter}`}
              center={[lat, lng]}
              radius={isSelected ? 26 : 20}
              pathOptions={{
                color: isSelected ? '#0f172a' : (isFalseOnset ? '#991b1b' : markerColor),
                fillColor: markerColor,
                fillOpacity: isSelected ? 0.95 : 0.82,
                weight: isSelected ? 4 : 2,
              }}
              eventHandlers={{
                click: () => onSelectBlock && onSelectBlock(block),
              }}
            >
              <Tooltip direction="top" offset={[0, -12]} opacity={0.98} permanent={false}>
                <div style={{ textAlign: 'center', padding: '4px 6px', fontFamily: 'inherit' }}>
                  <strong style={{ fontSize: '13px', display: 'block', color: '#0f172a' }}>
                    {block.block_name} {t.adminLevel.includes('Taluka') ? 'Taluka' : ''}
                  </strong>
                  <div style={{ fontSize: '11px', marginTop: '2px', color: markerColor, fontWeight: 700 }}>
                    {isFalseOnset ? '🚨 CRITICAL HAZARD' : `${rLevel} RISK`}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    Rain Anomaly: {anomalyStr} mm
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Interactive Map Legend & Category Filter Panel */}
      <div className="interactive-legend-panel">
        <div className="legend-header-row">
          <span className="legend-title">Vulnerability Tiers</span>
          {activeRiskFilter !== 'ALL' && (
            <button
              type="button"
              className="legend-clear-btn"
              onClick={() => onFilterChange && onFilterChange('ALL')}
            >
              ✕ {t.clearFilter}
            </button>
          )}
        </div>

        <div className="legend-categories-list">
          {/* Low Risk Category */}
          <button
            type="button"
            className={`legend-cat-btn ${activeRiskFilter === 'LOW' ? 'active-filter' : ''}`}
            onClick={() => onFilterChange && onFilterChange(activeRiskFilter === 'LOW' ? 'ALL' : 'LOW')}
            title="Click to filter low risk blocks"
          >
            <span className="legend-dot dot-low" />
            <span className="legend-cat-name">{t.riskLow} (&lt;40)</span>
            <span className="legend-cat-count">{lowBlocks.length}</span>
          </button>

          {/* Moderate Risk Category */}
          <button
            type="button"
            className={`legend-cat-btn ${activeRiskFilter === 'MODERATE' ? 'active-filter' : ''}`}
            onClick={() => onFilterChange && onFilterChange(activeRiskFilter === 'MODERATE' ? 'ALL' : 'MODERATE')}
            title="Click to filter moderate risk blocks"
          >
            <span className="legend-dot dot-mod" />
            <span className="legend-cat-name">{t.riskModerate} (40–69)</span>
            <span className="legend-cat-count">{modBlocks.length}</span>
          </button>

          {/* High Risk / Break Category */}
          <button
            type="button"
            className={`legend-cat-btn ${activeRiskFilter === 'HIGH' ? 'active-filter' : ''}`}
            onClick={() => onFilterChange && onFilterChange(activeRiskFilter === 'HIGH' ? 'ALL' : 'HIGH')}
            title="Click to filter high risk blocks"
          >
            <span className="legend-dot dot-high" />
            <span className="legend-cat-name">{t.riskHigh} (≥70)</span>
            <span className="legend-cat-count">{highBlocks.length}</span>
          </button>
        </div>

        {activeRiskFilter !== 'ALL' && (
          <div className="legend-filter-indicator">
            {t.filterActive}: <strong>{activeRiskFilter}</strong> ({displayedForecasts.length}/{forecasts.length} {t.blocksMatching})
          </div>
        )}

        <div className="legend-hint">
          {t.clickMarkerTip}
        </div>
      </div>
    </div>
  );
}