// Skapa en constants-fil för konfigurationsvärden
export const CONFIG = {
  REFRESH_INTERVAL: 300000, // 5 minuter
  DEFAULT_TIME_RANGE: 1,
  WIND_THRESHOLDS: {
    GOOD: 10,
    STRONG: 15,
    WIND_RATINGS: {
      EXCELLENT: { min: 12, max: 14 },
      GOOD: { min: 10, max: 12 },
      MODERATE: { min: 8, max: 10 },
      WEAK: { min: 5, max: 8 },
      TOO_STRONG: { min: 14, max: Infinity }
    }
  }
};

// Trunkerade koordinater (4 decimaler) enligt MET Norway rekommendationer
export const KALLSJON = {
  lat: 63.6275,    // Uppdaterad från 63.3 för högre precision
  lon: 13.0565,    // Uppdaterad från 13.8 för högre precision
  altitude: 382    // meter över havet, för MET Norway
} as const;

export const FORECAST_MODELS = {
  SMHI: {
    id: 'smhi' as const,
    name: 'SMHI',
    color: '#0b7c46',
    url: 'https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point',
    attribution: '© SMHI',
    license: 'CC BY 4.0'
  },
  MET_NORWAY: {
    id: 'met_norway' as const,
    name: 'MET Norway',
    color: '#ff8c42',
    url: 'https://api.met.no/weatherapi/locationforecast/2.0/compact',
    userAgent: 'KallsjonApp/1.0 (olanygards@gmail.com)',
    attribution: '© MET Norway',
    license: 'CC BY 4.0'
  },
  ECMWF: {
    id: 'ecmwf' as const,
    name: 'ECMWF',
    openMeteoId: 'ecmwf_ifs025',
    attribution: 'Weather data by Open-Meteo.com',
    license: 'CC BY 4.0'
  },
  GFS: {
    id: 'gfs' as const,
    name: 'GFS',
    openMeteoId: 'gfs_seamless',
    attribution: 'Weather data by Open-Meteo.com',
    license: 'CC BY 4.0'
  },
  ICON: {
    id: 'icon' as const,
    name: 'ICON',
    openMeteoId: 'icon_seamless',
    attribution: 'Weather data by Open-Meteo.com',
    license: 'CC BY 4.0'
  },
  CONSENSUS: {
    id: 'consensus' as const,
    name: 'Consensus',
    color: '#6b7280',  // neutral grå
    attribution: 'Beräknad från tillgängliga modeller'
  },
  OBSERVED: {
    id: 'observed' as const,
    name: 'Observerat',
    color: '#1f2937', // mörkgrå
    attribution: 'Observerad data'
  }
} as const;

export const WIND_CALENDAR_COLORS = {
  RANGE_10_11: '#49654c',
  RANGE_12_13: '#0b7c46',
  RANGE_14_15: '#005b2f',
  RANGE_16_PLUS: '#ad3c1f',
  BELOW_10: '#e5e7eb'
} as const;

export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export const FETCH_CONFIG = {
  TIMEOUT_MS: 6000,
  MAX_RETRIES: 1,
  CACHE_DURATION_MS: 15 * 60 * 1000  // 15 min
}; 