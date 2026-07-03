// BEHÅLL OFÖRÄNDRAD - för observationer från Firebase
export interface WindData {
    id?: string;
    time: Date;
    windSpeed: number;
    windDirection: number;
    windGust: number;
    isForecast: boolean;
}

// NY - för prognosdata från flera modeller
export interface WindPoint {
    time: string;           // ISO format för enhetlig tidhantering
    wind: number;           // m/s medelvind
    gust: number | null;    // m/s byvind (fallback till wind om saknas)
    dir: number | null;     // 0-360 grader
    source: ForecastModel;
    runTimestamp?: string;  // ISO, när modellkörningen startade
}

export enum ForecastModel {
    SMHI = 'smhi',
    MET_NORWAY = 'met_norway',
    ECMWF = 'ecmwf',
    GFS = 'gfs',
    ICON = 'icon',
    CONSENSUS = 'consensus',
    OBSERVED = 'observed'
}