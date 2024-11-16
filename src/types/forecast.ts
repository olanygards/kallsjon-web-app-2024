// Raw forecast data from API
export interface RawForecastData {
    time: string;
    parameters: {
        name: string;
        values: number[];
    }[];
}

// Processed forecast data for WindChart
export interface ForecastData {
    time: string | Date;
    windSpeed: number;
    windDirection: number;
}