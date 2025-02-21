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