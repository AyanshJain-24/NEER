import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';

/**
 * Interactive Map Component with CartoDB Voyager tiles and dynamic risk indicators
 */
export default function MapView({ forecasts = [], selectedBlock, onSelectBlock }) {
  const puneCenter = [18.4500, 74.2000];

  return (
    <div className="map-container-wrap">
      <MapContainer
        center={puneCenter}
        zoom={9}
        scrollWheelZoom={true}
        className="leaflet-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {forecasts.map((block) => {
          const isSelected = selectedBlock && selectedBlock.block_id === block.block_id;
          const lat = block.coordinates?.latitude || 18.5204;
          const lng = block.coordinates?.longitude || 73.8567;
          const color = block.color_code || '#10b981';

          return (
            <CircleMarker
              key={block.block_id}
              center={[lat, lng]}
              radius={isSelected ? 24 : 18}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: isSelected ? 0.85 : 0.65,
                weight: isSelected ? 3 : 2
              }}
              eventHandlers={{
                click: () => onSelectBlock && onSelectBlock(block)
              }}
            >
              <Popup>
                <div className="map-popup-card">
                  <div className="map-popup-title">{block.block_name} Block</div>
                  <div>
                    <span
                      className="map-popup-badge"
                      style={{
                        backgroundColor: color,
                        color: block.risk_level === 'MODERATE' ? '#1f2937' : '#ffffff'
                      }}
                    >
                      {block.risk_level || 'RISK'} RISK
                    </span>
                  </div>
                  <button
                    type="button"
                    className="map-popup-btn"
                    onClick={() => onSelectBlock && onSelectBlock(block)}
                  >
                    Select &amp; View Advisory
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Floating Risk Legend Box */}
      <div className="map-legend">
        <div className="legend-title">Risk Assessment</div>
        <div className="legend-item">
          <span className="legend-dot low"></span>
          <span>Low Risk (&lt;40%)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot moderate"></span>
          <span>Moderate Risk (40–69%)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot high"></span>
          <span>High Risk (≥70%)</span>
        </div>
      </div>
    </div>
  );
}