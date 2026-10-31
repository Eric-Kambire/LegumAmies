import type { LocationWeatherData } from '../types/weather';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CachedWeatherEntry {
  timestamp: number;
  data: LocationWeatherData;
}

/**
 * Fetches real weather data from Open-Meteo using Météo-France seamless model
 */
export async function fetchLocationWeather(
  latitude: number,
  longitude: number
): Promise<LocationWeatherData> {
  const cacheKey = `legum_weather_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;

  // Check cache first
  const cachedJson = localStorage.getItem(cacheKey);
  let cachedEntry: CachedWeatherEntry | null = null;
  if (cachedJson) {
    try {
      cachedEntry = JSON.parse(cachedJson);
    } catch {
      // ignore JSON parse error
    }
  }

  // If cache is still valid and offline, or recent
  const isOnline = navigator.onLine;
  const isCacheFresh = cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS);

  if (!isOnline && cachedEntry) {
    return {
      ...cachedEntry.data,
      isCached: true,
    };
  }

  try {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation',
        'weather_code',
        'cloud_cover',
        'pressure_msl',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'is_day',
      ].join(','),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'precipitation_probability',
        'precipitation',
        'weather_code',
        'cloud_cover',
        'wind_speed_10m',
        'wind_direction_10m',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'wind_speed_10m_max',
      ].join(','),
      timezone: 'Europe/Paris',
      forecast_days: '7',
      models: 'meteofrance_seamless',
    });

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Erreur API Open-Meteo: HTTP ${response.status}`);
    }

    const json = await response.json();

    // Map next 24 hours
    const hourlyTimes: string[] = json.hourly?.time || [];
    const hourlyItems = [];
    const nowIso = new Date().toISOString();
    let startIndex = hourlyTimes.findIndex((t) => t >= nowIso.slice(0, 13));
    if (startIndex === -1) startIndex = 0;

    for (let i = startIndex; i < Math.min(startIndex + 24, hourlyTimes.length); i++) {
      hourlyItems.push({
        time: hourlyTimes[i],
        temperature: Math.round(json.hourly.temperature_2m[i] * 10) / 10,
        relativeHumidity: Math.round(json.hourly.relative_humidity_2m[i]),
        precipitationProbability: json.hourly.precipitation_probability ? json.hourly.precipitation_probability[i] || 0 : 0,
        precipitation: json.hourly.precipitation[i] || 0,
        weatherCode: json.hourly.weather_code[i] || 0,
        cloudCover: json.hourly.cloud_cover[i] || 0,
        windSpeed: Math.round(json.hourly.wind_speed_10m[i]),
        windDirection: json.hourly.wind_direction_10m[i] || 0,
      });
    }

    // Map daily items
    const dailyTimes: string[] = json.daily?.time || [];
    const dailyItems = dailyTimes.map((date, idx) => ({
      date,
      weatherCode: json.daily.weather_code[idx] || 0,
      temperatureMax: Math.round(json.daily.temperature_2m_max[idx] * 10) / 10,
      temperatureMin: Math.round(json.daily.temperature_2m_min[idx] * 10) / 10,
      precipitationSum: Math.round((json.daily.precipitation_sum[idx] || 0) * 10) / 10,
      precipitationProbabilityMax: json.daily.precipitation_probability_max ? json.daily.precipitation_probability_max[idx] || 0 : 0,
      windSpeedMax: Math.round(json.daily.wind_speed_10m_max[idx] || 0),
    }));

    const result: LocationWeatherData = {
      latitude: json.latitude,
      longitude: json.longitude,
      elevation: json.elevation,
      timezone: json.timezone,
      current: {
        temperature: Math.round(json.current.temperature_2m * 10) / 10,
        apparentTemperature: Math.round(json.current.apparent_temperature * 10) / 10,
        relativeHumidity: Math.round(json.current.relative_humidity_2m),
        precipitation: json.current.precipitation || 0,
        weatherCode: json.current.weather_code || 0,
        cloudCover: json.current.cloud_cover || 0,
        pressureMsl: Math.round(json.current.pressure_msl || 1013),
        windSpeed: Math.round(json.current.wind_speed_10m),
        windDirection: json.current.wind_direction_10m || 0,
        windGusts: Math.round(json.current.wind_gusts_10m || 0),
        time: json.current.time,
        isDay: json.current.is_day === 1,
      },
      hourly: hourlyItems,
      daily: dailyItems,
      dataSource: 'Météo-France (AROME/ARPEGE) via Open-Meteo',
      retrievedAt: new Date().toISOString(),
      isCached: false,
    };

    // Store in localStorage
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        timestamp: Date.now(),
        data: result,
      })
    );

    return result;
  } catch (error) {
    if (cachedEntry) {
      console.warn('Network error, returning cached weather (freshness: ' + isCacheFresh + '):', error);
      return {
        ...cachedEntry.data,
        isCached: true,
      };
    }
    throw error;
  }
}

/**
 * Returns WMO weather code descriptions in French tailored to agriculture
 */
export function getWmoWeatherDescription(code: number, isDay: boolean = true): {
  labelFr: string;
  iconName: string;
} {
  switch (code) {
    case 0:
      return { labelFr: isDay ? 'Ciel dégagé' : 'Nuit claire', iconName: isDay ? 'sun' : 'moon' };
    case 1:
      return { labelFr: 'Ensoleillé, quelques voiles', iconName: 'sun-dim' };
    case 2:
      return { labelFr: 'Éclaircies & passages nuageux', iconName: 'cloud-sun' };
    case 3:
      return { labelFr: 'Couvert', iconName: 'cloud' };
    case 45:
    case 48:
      return { labelFr: 'Brouillard / Brume matinale', iconName: 'cloud-fog' };
    case 51:
    case 53:
    case 55:
      return { labelFr: 'Bruine légère', iconName: 'cloud-drizzle' };
    case 61:
      return { labelFr: 'Pluie faible', iconName: 'cloud-rain' };
    case 63:
      return { labelFr: 'Pluie modérée', iconName: 'cloud-rain' };
    case 65:
      return { labelFr: 'Pluie battante', iconName: 'cloud-rain-wind' };
    case 71:
    case 73:
    case 75:
      return { labelFr: 'Chutes de neige', iconName: 'cloud-snow' };
    case 80:
    case 81:
    case 82:
      return { labelFr: 'Averses orageuses', iconName: 'cloud-lightning' };
    case 95:
      return { labelFr: 'Orage', iconName: 'zap' };
    case 96:
    case 99:
      return { labelFr: 'Orage avec risque de grêle', iconName: 'zap' };
    default:
      return { labelFr: 'Conditions variables', iconName: 'cloud' };
  }
}
