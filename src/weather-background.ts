import type { Place } from './weather-types';

export const weatherPhotos: Record<string, string> = {
  'clear-day': '/weather/clear-day.jpg',
  cloudy: '/weather/cloudy.jpg',
  rain: '/weather/rain.jpg',
  'rain-day': '/weather/rain-day.jpg',
  storm: '/weather/storm.jpg',
  sunset: '/weather/sunset.jpg',
  night: '/weather/night.jpg',
  fog: '/weather/fog.jpg',
  snow: '/weather/snow.jpg',
  'snow-day': '/weather/snow-day.jpg',
};

export function getWeatherPhoto(
  place: Place | null,
  code: number,
  isDay: boolean,
  sunrise?: string,
  sunset?: string,
  forecastTimezone?: string,
  now = Date.now(),
): string {
  if ([95, 96, 99].includes(code)) return isDay ? weatherPhotos.cloudy : weatherPhotos.storm;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return isDay ? weatherPhotos['snow-day'] : weatherPhotos.snow;
  if ([45, 48].includes(code)) return isDay ? weatherPhotos.fog : weatherPhotos.night;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return isDay ? weatherPhotos['rain-day'] : weatherPhotos.rain;
  }
  if (!isDay) return weatherPhotos.night;
  const timezone = place?.timezone || forecastTimezone || 'UTC';
  const currentParts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const currentMinute =
    Number(currentParts.find(part => part.type === 'hour')?.value ?? 0) * 60 +
    Number(currentParts.find(part => part.type === 'minute')?.value ?? 0);
  const minuteOfDay = (value?: string) => {
    const match = value?.match(/T(\d{2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const sunriseMinute = minuteOfDay(sunrise);
  const sunsetMinute = minuteOfDay(sunset);
  const nearSunrise = sunriseMinute !== null && Math.abs(sunriseMinute - currentMinute) < 45;
  const nearSunset = sunsetMinute !== null && Math.abs(sunsetMinute - currentMinute) < 70;
  if (nearSunset || nearSunrise) return weatherPhotos.sunset;
  if (code >= 2) return weatherPhotos.cloudy;
  return weatherPhotos['clear-day'];
}
export function placeLabel(place: Place): string {
  return [place.admin2, place.admin1, place.country].filter(Boolean).join(', ');
}
