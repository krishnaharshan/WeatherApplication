import type { AirQuality, Place, WeatherData } from './weather-types';

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(item => typeof item === 'number' && Number.isFinite(item));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

export async function searchPlaces(name: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ name, count: '10', language: 'en', format: 'json' });
  const data = await getJson<{ results?: Place[] }>(`https://geocoding-api.open-meteo.com/v1/search?${params}`, signal);
  return data.results ?? [];
}

export async function fetchWeather(place: Pick<Place, 'latitude' | 'longitude'>, signal?: AbortSignal): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(place.latitude), longitude: String(place.longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,uv_index,visibility',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max',
    timezone: 'auto', forecast_days: '7', wind_speed_unit: 'kmh', temperature_unit: 'celsius',
  });
  const data = await getJson<unknown>(`https://api.open-meteo.com/v1/forecast?${params}`, signal);
  if (!isRecord(data) || !isRecord(data.current) || !isRecord(data.hourly) || !isRecord(data.daily)) {
    throw new Error('The weather service returned incomplete data.');
  }

  const currentValues = [
    data.current.temperature_2m,
    data.current.relative_humidity_2m,
    data.current.apparent_temperature,
    data.current.is_day,
    data.current.precipitation,
    data.current.weather_code,
    data.current.cloud_cover,
    data.current.surface_pressure,
    data.current.wind_speed_10m,
    data.current.uv_index,
    data.current.visibility,
  ];
  const hourlyArrays = [
    data.hourly.temperature_2m,
    data.hourly.apparent_temperature,
    data.hourly.precipitation_probability,
    data.hourly.weather_code,
    data.hourly.is_day,
  ];
  const dailyArrays = [
    data.daily.weather_code,
    data.daily.temperature_2m_max,
    data.daily.temperature_2m_min,
    data.daily.uv_index_max,
    data.daily.precipitation_probability_max,
  ];
  const hourlyTimeCount = Array.isArray(data.hourly.time) ? data.hourly.time.length : -1;
  const dailyTimeCount = Array.isArray(data.daily.time) ? data.daily.time.length : -1;
  if (
    typeof data.current.time !== 'string' ||
    typeof data.timezone !== 'string' ||
    !currentValues.every(value => typeof value === 'number' && Number.isFinite(value)) ||
    !isStringArray(data.hourly.time) ||
    !hourlyArrays.every(isFiniteNumberArray) ||
    !isStringArray(data.daily.time) ||
    !isStringArray(data.daily.sunrise) ||
    !isStringArray(data.daily.sunset) ||
    !dailyArrays.every(isFiniteNumberArray) ||
    hourlyTimeCount === 0 ||
    dailyTimeCount !== 7 ||
    hourlyArrays.some(values => (values as number[]).length !== hourlyTimeCount) ||
    dailyArrays.some(values => (values as number[]).length !== dailyTimeCount) ||
    data.daily.sunrise.length !== data.daily.time.length ||
    data.daily.sunset.length !== data.daily.time.length
  ) {
    throw new Error('The weather service returned incomplete data.');
  }
  return data as unknown as WeatherData;
}

export async function fetchAirQuality(place: Pick<Place, 'latitude' | 'longitude'>, signal?: AbortSignal): Promise<AirQuality> {
  const params = new URLSearchParams({
    latitude: String(place.latitude), longitude: String(place.longitude),
    current: 'us_aqi,european_aqi,pm2_5,pm10', timezone: 'auto',
  });
  return getJson<AirQuality>(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`, signal);
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<Place> {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), localityLanguage: 'en' });
  const data = await getJson<{ city?: string; locality?: string; principalSubdivision?: string; countryName?: string }>(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`,
  );
  return {
    name: data.city || data.locality || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
    latitude, longitude, admin1: data.principalSubdivision, country: data.countryName,
  };
}
