import SunCalc from 'suncalc';

export function getSunrise(lat: number, lon: number, date: Date): Date {
  return SunCalc.getTimes(date, lat, lon).sunrise;
}

export function getSunset(lat: number, lon: number, date: Date): Date {
  return SunCalc.getTimes(date, lat, lon).sunset;
}
