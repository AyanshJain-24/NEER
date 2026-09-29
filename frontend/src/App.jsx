import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MapView from './components/MapView';
import LocationDetailModal from './components/LocationDetailModal';
import { UI_TRANSLATIONS } from './utils/translations';
import './App.css';

// Benchmark scenarios metadata
const benchmarkScenarios = {
  kharif_onset: {
    key: "kharif_onset",
    date: "12 June 2026",
    enso: "Niño 3.4 (-0.4°C)",
    iod: "Positive (+0.42°C)",
    mjo: "Phase 4 (Amp: 1.20)",
    source: "NOAA CPC / BoM Historical Series",
    statusType: "benchmark"
  },
  late_season: {
    key: "late_season",
    date: "29 Sept 2026",
    enso: "Niño 3.4 (+1.6°C)",
    iod: "Positive (+0.65°C)",
    mjo: "Phase 1 (Amp: 0.85)",
    source: "NOAA CPC / BoM Historical Calibration",
    statusType: "fallback"
  },
  live: {
    key: "live",
    date: "Live Real-Time",
    enso: "Niño 3.4 (Connecting...)",
    iod: "DMI (Connecting...)",
    mjo: "MJO (Connecting...)",
    source: "NOAA CPC & BoM Direct Feeds",
    statusType: "live"
  }
};

// Resilient fallback dataset if backend API is temporarily offline
const fallbackBlocks = [
  {
    block_id: "MH_PUN_006",
    block_name: "Bhor",
    district: "Pune",
    state: "Maharashtra",
    coordinates: { latitude: 18.1481, longitude: 73.8436 },
    topography: "Western Ghats Crest (High Orographic Lift)",
    risk_level: "HIGH",
    color_code: "#dc2626",
    false_onset: { detected: false },
    probabilities: { onset_probability_pct: 20, continuous_dry_spell_pct: 15, heavy_downpour_risk_pct: 82 },
    metrics: { expected_rainfall_anomaly_mm: 24.8, predicted_active_days: 14, predicted_break_days: 3, soil_moisture_index: 0.72 },
    normal_weekly_mm: [22.0, 34.0, 28.0, 25.0],
    panchayat_clusters: [
      { panchayat_id: "PAN_BHR_01", panchayat_name: "Shirwal Cluster", rainfall_anomaly_mm: 29.0, soil_moisture_index: 0.78, risk_tier: "HIGH" },
      { panchayat_id: "PAN_BHR_02", panchayat_name: "Ambavade Valley", rainfall_anomaly_mm: 31.6, soil_moisture_index: 0.82, risk_tier: "HIGH" }
    ],
    advisories: [
      {
        crop: "Soybean",
        crop_mr: "सोयाबीन",
        crop_hi: "सोयाबीन",
        stage: "Mature Pod Stage / Harvest Drainage",
        risk_condition: "Late Rain Pod-Rot Hazard",
        action: "Drain standing water immediately from field furrows. Harvest mature soybean pods during sunny dry breaks to prevent pod shattering and seed mould.",
        timing: "Execute harvesting immediately during dry intervals",
        reason: "Excess moisture at pod maturity induces fungal seed staining and premature pod shattering.",
        regional_text: {
          en: "Drain excess water from mature soybean fields. Harvest promptly during dry breaks to prevent seed mould.",
          hi: "सोयाबीन के खेतों से जल निकासी करें। फली चटकने और बीज में फफूंद लगने से बचाने के लिए सूखे मौसम में तुरंत कटाई करें।",
          mr: "सोयाबीनच्या शेतातून पाण्याचा त्वरित निचरा करा. शेंगा तडकणे आणि बुरशीपासून वाचवण्यासाठी कोरड्या हवामानात तात्काळ काढणी करा."
        }
      }
    ]
  },
  {
    block_id: "MH_PUN_002",
    block_name: "Baramati",
    district: "Pune",
    state: "Maharashtra",
    coordinates: { latitude: 18.1517, longitude: 74.5771 },
    topography: "Eastern Rain-Shadow Plain (Drought-Prone)",
    risk_level: "MODERATE",
    color_code: "#d97706",
    false_onset: {
      detected: false,
      summary: "Monsoon withdrawal phase active in Baramati. No false onset hazard in late-season window.",
      agronomic_directive: "Mature crop harvest window open during dry breaks."
    },
    probabilities: { onset_probability_pct: 15, continuous_dry_spell_pct: 48, heavy_downpour_risk_pct: 22 },
    metrics: { expected_rainfall_anomaly_mm: -3.5, predicted_active_days: 6, predicted_break_days: 8, soil_moisture_index: 0.38 },
    normal_weekly_mm: [6.5, 10.5, 9.0, 7.5],
    panchayat_clusters: [
      { panchayat_id: "PAN_BRM_01", panchayat_name: "Malegaon Khurd", rainfall_anomaly_mm: -4.0, soil_moisture_index: 0.36, risk_tier: "MODERATE" },
      { panchayat_id: "PAN_BRM_02", panchayat_name: "Someshwar Belt", rainfall_anomaly_mm: -2.7, soil_moisture_index: 0.40, risk_tier: "LOW" }
    ],
    advisories: [
      {
        crop: "Soybean",
        crop_mr: "सोयाबीन",
        crop_hi: "सोयाबीन",
        stage: "Maturity & Seedbed Preparation",
        action: "Harvest mature crop; prepare seedbed for upcoming Rabi sorghum (Jowar) using residual soil moisture.",
        timing: "Next 7–10 days",
        reason: "Residual moisture conservation ensures good germination for Rabi crops without supplemental irrigation.",
        regional_text: {
          en: "Harvest mature soybean; prepare seedbed for Rabi sorghum using residual moisture.",
          hi: "सोयाबीन की कटाई करें और बची हुई नमी में रबी ज्वार की बुआई के लिए खेत तैयार करें।",
          mr: "सोयाबीनची काढणी करा आणि जमिनीत उरलेल्या ओलाव्याचा वापर करून रब्बी ज्वारी पेरणीसाठी रान तयार करा."
        }
      }
    ]
  },
  {
    block_id: "MH_PUN_001",
    block_name: "Haveli",
    district: "Pune",
    state: "Maharashtra",
    coordinates: { latitude: 18.5204, longitude: 73.8567 },
    topography: "Central Valley Corridor (Transition Zone)",
    risk_level: "LOW",
    color_code: "#16a34a",
    false_onset: { detected: false },
    probabilities: { onset_probability_pct: 18, continuous_dry_spell_pct: 28, heavy_downpour_risk_pct: 35 },
    metrics: { expected_rainfall_anomaly_mm: 5.4, predicted_active_days: 8, predicted_break_days: 6, soil_moisture_index: 0.58 },
    normal_weekly_mm: [12.0, 18.0, 16.0, 14.0],
    panchayat_clusters: [
      { panchayat_id: "PAN_HVL_01", panchayat_name: "Khed Shivapur Cluster", rainfall_anomaly_mm: 1.8, soil_moisture_index: 0.62, risk_tier: "LOW" },
      { panchayat_id: "PAN_HVL_02", panchayat_name: "Wagholi Agro-Cluster", rainfall_anomaly_mm: -0.8, soil_moisture_index: 0.54, risk_tier: "LOW" },
      { panchayat_id: "PAN_HVL_03", panchayat_name: "Uruli Kanchan Plain", rainfall_anomaly_mm: -1.5, soil_moisture_index: 0.50, risk_tier: "LOW" }
    ],
    advisories: [
      {
        crop: "Soybean",
        crop_mr: "सोयाबीन",
        crop_hi: "सोयाबीन",
        stage: "Pod Maturity / Harvest",
        risk_condition: "Normal Maturity Transition",
        action: "Initiate harvest of mature soybean pods. Sun-dry seeds to 10-12% moisture before storage.",
        timing: "Next 5–7 days",
        reason: "Dry intervals offer optimal seed quality and prevent mould formation.",
        regional_text: {
          en: "Harvest mature soybean. Sun-dry seeds to safe moisture levels before bagging.",
          hi: "पकी हुई सोयाबीन की कटाई करें और भंडारण से पहले धूप में अच्छी तरह सुखाएं।",
          mr: "पक्व सोयाबीनची काढणी करा आणि साठवणुकीपूर्वी बियाणे उन्हात चांगले वाळवा."
        }
      }
    ]
  },
  {
    block_id: "MH_PUN_004",
    block_name: "Junnar",
    district: "Pune",
    state: "Maharashtra",
    coordinates: { latitude: 19.2065, longitude: 73.8767 },
    topography: "Northern Foothills & Escarpment",
    risk_level: "HIGH",
    color_code: "#dc2626",
    false_onset: { detected: false },
    probabilities: { onset_probability_pct: 22, continuous_dry_spell_pct: 20, heavy_downpour_risk_pct: 76 },
    metrics: { expected_rainfall_anomaly_mm: 18.2, predicted_active_days: 12, predicted_break_days: 4, soil_moisture_index: 0.68 },
    normal_weekly_mm: [18.0, 26.0, 22.0, 19.0],
    panchayat_clusters: [
      { panchayat_id: "PAN_JNR_01", panchayat_name: "Otur Cluster", rainfall_anomaly_mm: 20.6, soil_moisture_index: 0.72, risk_tier: "HIGH" },
      { panchayat_id: "PAN_JNR_02", panchayat_name: "Narayangaon Belt", rainfall_anomaly_mm: 17.0, soil_moisture_index: 0.66, risk_tier: "HIGH" },
      { panchayat_id: "PAN_JNR_03", panchayat_name: "Junnar Rural", rainfall_anomaly_mm: 19.0, soil_moisture_index: 0.69, risk_tier: "HIGH" }
    ],
    advisories: [
      {
        crop: "Soybean",
        crop_mr: "सोयाबीन",
        crop_hi: "सोयाबीन",
        stage: "Mature Stage / Drainage Care",
        risk_condition: "Heavy Rain Runoff Hazard",
        action: "Clear drainage channels in low-lying plots to avoid water accumulation around mature roots.",
        timing: "Immediate field inspection",
        reason: "Excess moisture at harvest stage induces root decay and seed discoloration.",
        regional_text: {
          en: "Clear field furrows to prevent waterlogging around mature soybean crops.",
          hi: "खेत की नालियों को साफ करें ताकि पकी सोयाबीन में जलभराव न हो सके।",
          mr: "पक्व सोयाबीन पिकात पाणी साचू नये म्हणून शेतातील पाण्याचे चर मोकळे करा."
        }
      }
    ]
  },
  {
    block_id: "MH_PUN_003",
    block_name: "Shirur",
    district: "Pune",
    state: "Maharashtra",
    coordinates: { latitude: 18.8267, longitude: 74.3789 },
    topography: "Semi-Arid Transition Plain",
    risk_level: "LOW",
    color_code: "#16a34a",
    false_onset: { detected: false },
    probabilities: { onset_probability_pct: 12, continuous_dry_spell_pct: 35, heavy_downpour_risk_pct: 15 },
    metrics: { expected_rainfall_anomaly_mm: -2.0, predicted_active_days: 7, predicted_break_days: 7, soil_moisture_index: 0.42 },
    normal_weekly_mm: [8.0, 13.0, 11.0, 9.5],
    panchayat_clusters: [
      { panchayat_id: "PAN_SHR_01", panchayat_name: "Shikrapur Cluster", rainfall_anomaly_mm: -1.5, soil_moisture_index: 0.44, risk_tier: "LOW" },
      { panchayat_id: "PAN_SHR_02", panchayat_name: "Sanaswadi Farm Belt", rainfall_anomaly_mm: -2.4, soil_moisture_index: 0.40, risk_tier: "LOW" },
      { panchayat_id: "PAN_SHR_03", panchayat_name: "Shirur Town Cluster", rainfall_anomaly_mm: -3.1, soil_moisture_index: 0.38, risk_tier: "LOW" }
    ],
    advisories: [
      {
        crop: "Bajra",
        crop_mr: "बाजरी",
        crop_hi: "बाजरा",
        stage: "Grain Hardening / Maturity",
        risk_condition: "Optimal Dry Window",
        action: "Harvest mature bajra earheads; protect harvested sheaves from dew or sudden showers.",
        timing: "Next 7 days",
        reason: "Ensures seed hardening and preserves fodder quality without moisture damage.",
        regional_text: {
          en: "Harvest mature bajra earheads during dry weather and stack properly.",
          hi: "सूखे मौसम में पके बाजरे के सिट्टों की कटाई करें और सुरक्षित स्थान पर रखें।",
          mr: "कोरड्या हवामानात पक्व बाजरीची कणसे खुडून सुरक्षित जागी रचून ठेवा."
        }
      }
    ]
  },
  {
    block_id: "MH_PUN_005",
    block_name: "Indapur",
    district: "Pune",
    state: "Maharashtra",
    coordinates: { latitude: 18.1147, longitude: 75.0253 },
    topography: "Deep Rain Shadow Basin",
    risk_level: "MODERATE",
    color_code: "#d97706",
    false_onset: { detected: false },
    probabilities: { onset_probability_pct: 10, continuous_dry_spell_pct: 55, heavy_downpour_risk_pct: 14 },
    metrics: { expected_rainfall_anomaly_mm: -6.5, predicted_active_days: 5, predicted_break_days: 9, soil_moisture_index: 0.32 },
    normal_weekly_mm: [5.0, 8.0, 7.0, 6.0],
    panchayat_clusters: [
      { panchayat_id: "PAN_IND_01", panchayat_name: "Bawada Cluster", rainfall_anomaly_mm: -7.3, soil_moisture_index: 0.30, risk_tier: "MODERATE" },
      { panchayat_id: "PAN_IND_02", panchayat_name: "Nimgaon Ketki", rainfall_anomaly_mm: -6.1, soil_moisture_index: 0.34, risk_tier: "MODERATE" },
      { panchayat_id: "PAN_IND_03", panchayat_name: "Indapur Rural", rainfall_anomaly_mm: -7.7, soil_moisture_index: 0.28, risk_tier: "MODERATE" }
    ],
    advisories: [
      {
        crop: "Sugarcane",
        crop_mr: "ऊस",
        crop_hi: "गन्ना",
        stage: "Grand Growth Stage",
        risk_condition: "Moisture Deficit in Rain-Shadow Basin",
        action: "Apply trash mulching between cane rows to reduce evaporation losses during dry spells.",
        timing: "Within 3–5 days",
        reason: "Mulching conserves root-zone soil moisture and reduces irrigation frequency by 30%.",
        regional_text: {
          en: "Apply trash mulch in sugarcane to conserve moisture during rain-shadow dry spells.",
          hi: "गन्ने की पंक्तियों में सूखी पत्तियां (मल्चिंग) बिछाएं ताकि नमी सुरक्षित रहे।",
          mr: "कोरड्या काळात उसाच्या सऱ्यांमध्ये पाचटाचे आच्छादन करा जेणेकरून जमिनीत ओलावा टिकून राहील."
        }
      }
    ]
  }
];

export default function App() {
  // Theme state: defaults strictly to LIGHT
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('neer_theme') || localStorage.getItem('pyaasa_theme') || 'light';
  });

  // Language state: English ('en'), Hindi ('hi'), Marathi ('mr')
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('neer_lang') || localStorage.getItem('pyaasa_lang') || 'en';
  });

  const [scenario, setScenario] = useState('late_season');
  const [activeRiskFilter, setActiveRiskFilter] = useState('ALL');
  const [forecasts, setForecasts] = useState(fallbackBlocks);
  const [selectedBlock, setSelectedBlock] = useState(null); // Modal is closed by default!
  const [liveTelemetry, setLiveTelemetry] = useState(null);
  const [apiStatus, setApiStatus] = useState('syncing');

  const t = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;

  // Persist theme to HTML element attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('neer_theme', theme);
  }, [theme]);

  // Persist language preference
  useEffect(() => {
    localStorage.setItem('neer_lang', lang);
  }, [lang]);

  // Fetch real-time planetary telemetry from backend
  useEffect(() => {
    axios.get('http://localhost:5000/api/v1/telemetry/live', { timeout: 3500 })
      .then((res) => {
        if (res.data && res.data.teleconnections) {
          setLiveTelemetry(res.data);
          if (scenario === 'live') {
            setApiStatus('live');
          }
        }
      })
      .catch((err) => {
        console.warn('[Telemetry Notice]: Live telemetry feed offline, using cached series:', err.message);
      });
  }, [scenario]);

  // Fetch forecast data from backend for active scenario
  useEffect(() => {
    let isMounted = true;
    setApiStatus('syncing');
    const url = `http://localhost:5000/api/v1/forecast/pune?scenario=${scenario}`;

    axios.get(url, { timeout: 5000 })
      .then((res) => {
        if (!isMounted) return;
        const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        if (data && data.length > 0) {
          setForecasts(data);
          setApiStatus(scenario === 'live' ? 'live' : (scenario === 'kharif_onset' ? 'benchmark' : 'fallback'));
        } else {
          setForecasts(fallbackBlocks);
          setApiStatus('fallback');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn(`[Forecast Gateway Notice]: API request notice (${err.message}). Using local benchmark dataset.`);
        setForecasts(fallbackBlocks);
        setApiStatus('fallback');
      });

    return () => {
      isMounted = false;
    };
  }, [scenario]);

  // Synchronize active modal with updated scenario data
  useEffect(() => {
    if (selectedBlock) {
      const refreshed = forecasts.find(f => f.block_id === selectedBlock.block_id);
      if (refreshed) {
        setSelectedBlock(refreshed);
      }
    }
  }, [forecasts]);

  // Active scenario drivers display
  const baseConfig = benchmarkScenarios[scenario] || benchmarkScenarios.late_season;
  const activeScenarioConfig = (scenario === 'live' && liveTelemetry?.teleconnections)
    ? {
        ...baseConfig,
        date: new Date(liveTelemetry.timestamp || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        enso: `Niño 3.4 (${liveTelemetry.teleconnections.enso > 0 ? '+' : ''}${liveTelemetry.teleconnections.enso}°C)`,
        iod: `DMI (${liveTelemetry.teleconnections.iod > 0 ? '+' : ''}${liveTelemetry.teleconnections.iod}°C)`,
        mjo: `Phase ${liveTelemetry.teleconnections.mjo_phase} (Amp: ${liveTelemetry.teleconnections.mjo_amp})`,
        source: liveTelemetry.source || "NOAA CPC / BoM Direct Feeds"
      }
    : baseConfig;

  // Toggle light/dark theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="app-container">

      {/* TOP NAVIGATION BAR */}
      <header className="app-navbar">
        {/* Brand Identity */}
        <div className="navbar-brand-section">
          <span className="brand-leaf-icon" aria-hidden="true">🌱</span>
          <div className="brand-text-block">
            <div className="brand-title-wrap">
              <h1 className="app-brand-title">{t.appTitle}</h1>
              <span className="app-brand-badge">{t.appSubtitle}</span>
            </div>
            <div className="app-brand-subtitle">{t.tagline}</div>
          </div>
        </div>

        {/* Controls & Selectors */}
        <div className="navbar-controls-group">
          {/* Scenario Selector Dropdown */}
          <div className="scenario-selector-wrap">
            <label className="scenario-label" htmlFor="scenario-select-input">{t.scenario}:</label>
            <select
              id="scenario-select-input"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="scenario-select"
            >
              <option value="late_season">{t.scenarioLateSeason}</option>
              <option value="kharif_onset">{t.scenarioKharifOnset}</option>
              <option value="live">{t.scenarioLive}</option>
            </select>
          </div>

          {/* Trilingual Language Selector */}
          <div className="lang-selector-wrap" role="group" aria-label="Language selection">
            <button
              type="button"
              className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => setLang('en')}
              title="English Language"
            >
              EN
            </button>
            <button
              type="button"
              className={`lang-btn ${lang === 'hi' ? 'active' : ''}`}
              onClick={() => setLang('hi')}
              title="हिन्दी भाषा"
            >
              हिन्दी
            </button>
            <button
              type="button"
              className={`lang-btn ${lang === 'mr' ? 'active' : ''}`}
              onClick={() => setLang('mr')}
              title="मराठी भाषा"
            >
              मराठी
            </button>
          </div>

          {/* Theme Switcher Toggle */}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme`}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme`}
          >
            <span>{theme === 'light' ? '🌙' : '☀️'}</span>
            <span>{theme === 'light' ? t.themeDark : t.themeLight}</span>
          </button>

          {/* Truthful Data Status Badge */}
          <div className={`data-status-badge ${apiStatus === 'live' ? 'status-live' : (apiStatus === 'benchmark' ? 'status-benchmark' : 'status-fallback')}`}>
            <span>●</span>
            <span>
              {apiStatus === 'live'
                ? t.statusLiveVerified
                : (apiStatus === 'benchmark'
                  ? t.statusBenchmark
                  : (apiStatus === 'syncing' ? t.statusSyncing : t.statusFallback))}
            </span>
          </div>
        </div>
      </header>

      {/* CLIMATE TELEMETRY SUB-BAR */}
      <div className="telemetry-subbar">
        <div className="telemetry-indices">
          <span><strong>{t.valid}:</strong> {activeScenarioConfig.date}</span>
          <span><strong>ENSO:</strong> {activeScenarioConfig.enso}</span>
          <span><strong>IOD:</strong> {activeScenarioConfig.iod}</span>
          <span><strong>MJO:</strong> {activeScenarioConfig.mjo}</span>
        </div>
        <div>
          <span><strong>{t.source}:</strong> {activeScenarioConfig.source}</span>
        </div>
      </div>

      {/* MAIN WORKSPACE: 100% WIDTH MAP VIEW (SIDEBAR REMOVED) */}
      <main className="main-map-workspace">
        <MapView
          forecasts={forecasts}
          selectedBlock={selectedBlock}
          onSelectBlock={(block) => setSelectedBlock(block)}
          activeRiskFilter={activeRiskFilter}
          onFilterChange={(newFilter) => setActiveRiskFilter(newFilter)}
          theme={theme}
          t={t}
        />
      </main>

      {/* PROMINENT FLOATING DETAIL MODAL (OPENS ON MARKER CLICK) */}
      {selectedBlock && (
        <LocationDetailModal
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
          lang={lang}
          t={t}
          scenario={scenario}
          theme={theme}
        />
      )}

    </div>
  );
}