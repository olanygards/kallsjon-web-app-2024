export interface WindData {
    id?: string;
    time: Date;
    windSpeed: number;
    windDirection: number;
    windGust: number;
    isForecast: boolean;
}