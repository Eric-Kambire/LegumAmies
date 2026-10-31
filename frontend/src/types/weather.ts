/**
 * Weather data structures from Open-Meteo & RainViewer
 */

export type WeatherLayerType = 'radar' | 'clouds' | 'temperature' | 'wind';

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  relativeHumidity: number;
  precipitation: number;
  weatherCode: number;
  cloudCover: number;
  pressureMsl: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  time: string;
  isDay: boolean;
}

export interface HourlyForecastPoint {
  time: string;
  temperature: number;
  relativeHumidity: number;
  precipitationProbability: number;
  precipitation: number;
  weatherCode: number;
  cloudCover: number;
  windSpeed: number;
  windDirection: number;
}

export interface DailyForecastPoint {
  date: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
}

export interface LocationWeatherData {
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone: string;
  current: CurrentWeather;
  hourly: HourlyForecastPoint[];
  daily: DailyForecastPoint[];
  dataSource: string;
  retrievedAt: string;
  isCached: boolean;
}

export interface RadarFrame {
  time: number; // Unix timestamp
  path: string; // RainViewer tile path segment
  type: 'past' | 'nowcast';
}

export interface RadarData {
  host: string;
  past: RadarFrame[];
  nowcast: RadarFrame[];
  generatedAt: number;
}
