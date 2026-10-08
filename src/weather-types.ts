export type Place = {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  admin2?: string;
  timezone?: string;
};

export type WeatherData = {
  current: {
    time: string; temperature_2m: number; relative_humidity_2m: number;
    apparent_temperature: number; is_day: number; precipitation: number;
    weather_code: number; cloud_cover: number; surface_pressure: number;
    wind_speed_10m: number; uv_index: number; visibility: number;
  };
  hourly: {
    time: string[]; temperature_2m: number[]; apparent_temperature: number[];
    precipitation_probability: number[]; weather_code: number[]; is_day: number[];
  };
  daily: {
    time: string[]; weather_code: number[]; temperature_2m_max: number[];
    temperature_2m_min: number[]; sunrise: string[]; sunset: string[];
    uv_index_max: number[]; precipitation_probability_max: number[];
  };
  timezone: string;
}
export type AirQuality = { current: { us_aqi?: number; european_aqi?: number; pm2_5?: number; pm10?: number } };

export function describeWeather(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Conditions';
}

export function weatherGlyph(code: number): string {
  if (code === 0 || code === 1) return 'sun';
  if ([2, 3, 45, 48].includes(code)) return 'cloud';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return 'rain';
  return 'sun';
}
