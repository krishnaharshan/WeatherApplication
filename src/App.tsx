import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Cloud, CloudLightning, CloudRain, CloudSnow, Droplets, LocateFixed, MapPin, Search, Sun, Sunrise, Sunset, Wind, Eye, Gauge, LoaderCircle, X, RefreshCw } from 'lucide-react';
import { fetchAirQuality, fetchWeather, reverseGeocode, searchPlaces } from './weather-api';
import type { AirQuality, Place, WeatherData } from './weather-types';
import { describeWeather, weatherGlyph } from './weather-types';
import WeatherBackground from './components/WeatherBackground';
import { placeLabel } from './weather-background';

function WeatherIcon({ code, size = 18 }: { code: number; size?: number }) {
  const glyph = weatherGlyph(code);
  const Icon = glyph === 'storm' ? CloudLightning : glyph === 'rain' ? CloudRain : glyph === 'snow' ? CloudSnow : glyph === 'cloud' ? Cloud : Sun;
  return <Icon size={size} strokeWidth={1.65} />;
}
function formatClock(value?: string) {
  if (!value) return '—';
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) return '—';
  const date = new Date(Date.UTC(2000, 0, 1, Number(match[1]), Number(match[2])));
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}
function dayName(value: string, index: number) {
  if (index === 0) return 'Today';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(date);
}
function aqiLabel(value?: number) {
  if (value == null) return null;
  if (value <= 50) return 'Good';
  if (value <= 100) return 'Moderate';
  if (value <= 150) return 'Sensitive';
  if (value <= 200) return 'Unhealthy';
  if (value <= 300) return 'Very unhealthy';
  return 'Hazardous';
}
function getSunPosition(sunrise?: string, sunset?: string, timezone = 'UTC', now = Date.now()) {
  if (!sunrise || !sunset) return 0;
  const minutesAfterMidnight = (value: string) => {
    const match = value.match(/T(\d{2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const start = minutesAfterMidnight(sunrise);
  const end = minutesAfterMidnight(sunset);
  if (start === null || end === null) return 0;
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0);
  const current = hour * 60 + minute;
  if (end <= start) return 0;
  return Math.max(0, Math.min(100, ((current - start) / (end - start)) * 100));
}

function App() {
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [air, setAir] = useState<AirQuality | null>(null);
  const [airError, setAirError] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Place[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [clockNow, setClockNow] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const coordsKey = place ? `${place.latitude},${place.longitude}` : '';
  const current = weather?.current;
  const dailySunrise = weather?.daily.sunrise[0];
  const dailySunset = weather?.daily.sunset[0];
  const backgroundCode = current?.weather_code ?? null;
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) { setMatches([]); setSearchLoading(false); setSearchError(''); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true); setSearchError('');
      try { setMatches(await searchPlaces(trimmed, controller.signal)); }
      catch (error) { if (!controller.signal.aborted) { setMatches([]); setSearchError('Search is unavailable right now. Try again.'); } }
      finally { if (!controller.signal.aborted) setSearchLoading(false); }
    }, 320);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  useEffect(() => {
    if (!place) { setWeather(null); setAir(null); return; }
    const controller = new AbortController();
    setWeatherLoading(true); setWeatherError(''); setAir(null); setAirError(false);
    fetchWeather(place, controller.signal).then(data => {
      setWeather(data); setUpdatedAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    }).catch(() => { if (!controller.signal.aborted) setWeatherError('Weather data could not be loaded. Check your connection and retry.'); })
      .finally(() => { if (!controller.signal.aborted) setWeatherLoading(false); });
    fetchAirQuality(place, controller.signal).then(setAir).catch(() => { if (!controller.signal.aborted) setAirError(true); });
    return () => controller.abort();
  }, [coordsKey, refreshToken]);

  const hourlyItems = useMemo(() => {
    if (!weather) return [];
    const found = weather.hourly.time.findIndex(time => time >= weather.current.time);
    const start = Math.max(0, found);
    const upcoming = weather.hourly.time.slice(start, start + 11).map((time, offset) => {
      const index = start + offset;
      return {
        key: time,
        label: formatClock(time),
        temperature: weather.hourly.temperature_2m[index],
        code: weather.hourly.weather_code[index],
        probability: weather.hourly.precipitation_probability[index],
      };
    });
    return [
      {
        key: 'now',
        label: 'NOW',
        temperature: weather.current.temperature_2m,
        code: weather.current.weather_code,
        probability: null,
      },
      ...upcoming,
    ];
  }, [weather]);

  const selectPlace = (selected: Place) => {
    if (!Number.isFinite(selected.latitude) || !Number.isFinite(selected.longitude)) return;
    setWeather(null); setAir(null); setWeatherError(''); setPlace(selected); setQuery(''); setMatches([]); setSearchOpen(false); setLocationError('');
  };
  const useLocation = () => {
    setLocationError('');
    if (!('geolocation' in navigator)) { setLocationError('Location services are not supported by this browser.'); return; }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(async position => {
      const { latitude, longitude } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        setLocationError('Your device returned invalid coordinates.'); setLocationLoading(false); return;
      }
      try { selectPlace(await reverseGeocode(latitude, longitude)); }
      catch { selectPlace({ name: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`, latitude, longitude }); }
      setLocationLoading(false);
    }, error => {
      setLocationLoading(false);
      setLocationError(error.code === error.PERMISSION_DENIED ? 'Location permission was denied. You can search for a place instead.' :
        error.code === error.TIMEOUT ? 'Location request timed out. Please try again.' : 'Could not determine your location. Please try again.');
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  };

  const uvLabel = (value?: number) => value == null ? '—' : value < 3 ? 'Low' : value < 6 ? 'Moderate' : value < 8 ? 'High' : value < 11 ? 'Very high' : 'Extreme';
  const nowSunPos = getSunPosition(dailySunrise, dailySunset, weather?.timezone, clockNow);

  return (
    <main className="weather-shell">
      <WeatherBackground place={place} condition={backgroundCode} isDay={!!current?.is_day} sunrise={dailySunrise} sunset={dailySunset} timezone={weather?.timezone} now={clockNow} />
      <div className="weather-content min-h-[100dvh]">
        <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 pt-6 sm:px-10 lg:px-16">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/20 text-[#ff6a00]"><Sun size={18} strokeWidth={1.7} /></span>
            <div><div className="text-[13px] font-extrabold tracking-[.22em]">WEATHER WINDOW</div><div className="mono mt-0.5 text-[9px] tracking-[.19em] text-white/55">GLOBAL CONDITIONS / LIVE</div></div>
          </div>
          <div className="mono hidden items-center gap-2 text-[10px] tracking-[.14em] text-white/65 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#ff6a00] shadow-[0_0_10px_rgba(255,106,0,.8)]" /> OPEN-METEO LIVE</div>
        </header>

        <section className={`mx-auto w-full max-w-[1440px] px-5 pb-12 pt-10 sm:px-10 lg:px-16 ${place ? '' : 'min-h-[78vh] flex flex-col justify-center'}`}>
          <div className="mx-auto w-full max-w-[1220px]">
            <div className="relative z-20 mx-auto mb-9 max-w-[520px]">
              <div className={`glass flex h-[54px] items-center gap-3 rounded-full px-5 transition ${searchOpen ? 'border-white/40' : ''}`}>
                <Search size={17} className="shrink-0 text-[#ff6a00]" />
                <input ref={inputRef} value={query} onFocus={() => setSearchOpen(true)} onChange={event => { setQuery(event.target.value); setSearchOpen(true); }} onKeyDown={event => { if (event.key === 'Escape') setSearchOpen(false); if (event.key === 'Enter' && matches[0]) selectPlace(matches[0]); }} placeholder="Search any city..." className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/55" aria-label="Search global locations" aria-autocomplete="list" aria-expanded={searchOpen && query.trim().length >= 2} aria-controls="location-results" role="combobox" data-testid="input-location-search" />
                {query && <button type="button" onClick={() => { setQuery(''); setMatches([]); inputRef.current?.focus(); }} className="rounded-full p-1 text-white/60 hover:text-white" aria-label="Clear search" data-testid="button-clear-search"><X size={15} /></button>}
                <span className="h-5 w-px bg-white/20" />
                <button type="button" title="Use my current location" aria-label="Use my current location" onClick={useLocation} disabled={locationLoading} className="flex items-center gap-2 whitespace-nowrap text-[11px] font-semibold text-white/85 transition hover:text-[#ff6a00] disabled:opacity-60" data-testid="button-use-location">
                  {locationLoading ? <LoaderCircle size={16} className="animate-spin" /> : <LocateFixed size={16} />}
                  <span className="hidden sm:inline">Use my current location</span>
                </button>
              </div>
              {searchOpen && query.trim().length >= 2 && (
                <div id="location-results" role="listbox" aria-label="Matching locations" className="search-menu glass absolute left-0 right-0 top-[62px] overflow-hidden rounded-2xl border-white/20">
                  {searchLoading && <div className="flex items-center gap-3 px-5 py-4 text-sm text-white/65"><LoaderCircle className="animate-spin text-[#ff6a00]" size={17} /> Searching the world…</div>}
                  {!searchLoading && searchError && <div className="px-5 py-4 text-sm text-[#ffc2a0]" role="alert">{searchError}</div>}
                  {!searchLoading && !searchError && !matches.length && <div className="px-5 py-4 text-sm text-white/65">No places found. Try a different spelling.</div>}
                  {!searchLoading && matches.map((match, index) => <button type="button" key={`${match.latitude}-${match.longitude}-${index}`} onClick={() => selectPlace(match)} className="flex w-full items-center gap-3 border-b border-white/[.08] px-5 py-3 text-left transition last:border-0 hover:bg-white/[.09]" data-testid={`result-location-${index}`}>
                    <MapPin size={16} className="shrink-0 text-[#ff6a00]" /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{match.name}</span><span className="mt-0.5 block truncate text-[11px] text-white/55">{placeLabel(match) || 'Location'}</span></span><span className="mono text-[9px] text-white/40">{match.latitude.toFixed(2)}°</span>
                  </button>)}
                </div>
              )}
              {locationError && <p role="alert" className="mt-2 px-5 text-[11px] text-[#ffd4be]">{locationError}</p>}
            </div>

            {!place && (
              <div className="fade-up mx-auto max-w-[780px] pb-10 text-center">
                <div className="mono mb-5 text-[10px] tracking-[.28em] text-white/65">A CLEARER VIEW OF EVERYWHERE</div>
                <h1 className="text-balance text-5xl font-light leading-[1.02] tracking-[-.065em] sm:text-7xl lg:text-[96px]">Weather,<br /><span className="font-semibold">without borders.</span></h1>
                <p className="mx-auto mt-6 max-w-[440px] text-sm leading-6 text-white/70">Search a place on the map of the world, or let us find where you are. The atmosphere changes with the forecast.</p>
                <button type="button" onClick={() => { inputRef.current?.focus(); setSearchOpen(true); }} className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3 text-xs font-semibold transition hover:border-[#ff6a00] hover:bg-[#ff6a00]/10" data-testid="button-start-search"><Search size={15} className="text-[#ff6a00]" /> Find a place</button>
              </div>
            )}

            {place && (
              <div className="fade-up">
                <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div>
                    <div className="mono mb-2 flex items-center gap-2 text-[10px] tracking-[.22em] text-white/65"><MapPin size={12} className="text-[#ff6a00]" /> LIVE CONDITIONS <span className="text-white/25">/</span> {place.latitude.toFixed(2)}°, {place.longitude.toFixed(2)}°</div>
                    <h1 className="text-4xl font-semibold leading-none tracking-[-.055em] sm:text-6xl">{place.name}</h1>
                    <p className="mt-2 text-[13px] text-white/70">{placeLabel(place) || 'Coordinates selected'}{(place.timezone || weather?.timezone) ? ` · ${(place.timezone || weather?.timezone)?.replaceAll('_', ' ')}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/60"><span className="h-1.5 w-1.5 rounded-full bg-[#ff6a00]" /> {weatherLoading ? 'Updating conditions' : updatedAt ? `Updated ${updatedAt}` : 'Live conditions'} <button onClick={() => setRefreshToken(value => value + 1)} title="Refresh weather" aria-label="Refresh weather" className="ml-1 rounded-full p-1.5 hover:bg-white/10" data-testid="button-refresh-weather"><RefreshCw size={13} /></button></div>
                </div>

                {weatherError && <div className="glass mb-5 flex items-center justify-between rounded-xl p-4 text-sm text-[#ffd4be]" role="alert"><span>{weatherError}</span><button onClick={() => setRefreshToken(value => value + 1)} className="underline underline-offset-4">Retry</button></div>}
                {weatherLoading && !weather && <div className="glass rounded-2xl p-8"><div className="h-2 w-32 animate-pulse rounded bg-white/15" /><div className="mt-5 h-20 w-48 animate-pulse rounded bg-white/15" /><div className="mt-6 h-3 w-64 animate-pulse rounded bg-white/10" /></div>}
                {weather && (
                  <>
                    <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
                      <section className="glass relative overflow-hidden rounded-[26px] px-6 py-6 sm:px-9 sm:py-8">
                        <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-[#ff6a00]/[.045] blur-3xl" />
                        <div className="relative flex flex-wrap items-start justify-between gap-5">
                          <div>
                            <div className="mono text-[10px] tracking-[.2em] text-white/60">RIGHT NOW <span className="text-white/35">· °C</span></div>
                            <div className="mt-4 flex items-start gap-1"><span className="text-[90px] font-light leading-[.9] tracking-[-.085em] sm:text-[112px]">{Math.round(current!.temperature_2m)}°</span><span className="mt-3 text-[25px] text-[#ff6a00]"><WeatherIcon code={current!.weather_code} size={25} /></span></div>
                            <div className="mt-3 text-lg font-medium">{describeWeather(current!.weather_code)}</div>
                            <div className="mt-1 text-[12px] text-white/60">Feels like {Math.round(current!.apparent_temperature)}° <span className="mx-1 text-white/25">·</span> {current!.is_day ? 'Daytime' : 'Night'}</div>
                          </div>
                          <div className="grid min-w-[142px] grid-cols-2 gap-x-6 gap-y-5 pt-3">
                            <Metric icon={<Droplets size={15} />} label="Humidity" value={`${current!.relative_humidity_2m}%`} />
                            <Metric icon={<Wind size={15} />} label="Wind" value={`${Math.round(current!.wind_speed_10m)} km/h`} />
                            <Metric icon={<Eye size={15} />} label="Visibility" value={`${(current!.visibility / 1000).toFixed(1)} km`} />
                            <Metric icon={<Gauge size={15} />} label="Pressure" value={`${Math.round(current!.surface_pressure)} hPa`} />
                            <Metric icon={<Sun size={15} />} label="UV index" value={`${current!.uv_index} · ${uvLabel(current!.uv_index)}`} />
                            <Metric icon={<Cloud size={15} />} label="Cloud cover" value={`${current!.cloud_cover}%`} />
                          </div>
                        </div>
                      </section>
                      <section className="glass flex flex-col justify-between rounded-[26px] px-6 py-6 sm:px-7 sm:py-8">
                        <div className="flex items-center justify-between"><div className="mono text-[10px] tracking-[.2em] text-white/60">DAYLIGHT</div><Sunrise size={17} className="text-[#ff6a00]" /></div>
                        <div className="mt-6 flex items-center justify-between">
                          <div><div className="flex items-center gap-2 text-[11px] text-white/55"><Sunrise size={14} /> SUNRISE</div><div className="mono mt-2 text-[19px]">{formatClock(dailySunrise)}</div></div>
                          <div className="text-right"><div className="flex items-center justify-end gap-2 text-[11px] text-white/55"><Sunset size={14} /> SUNSET</div><div className="mono mt-2 text-[19px]">{formatClock(dailySunset)}</div></div>
                        </div>
                        <div className="relative mt-7 h-[2px] rounded-full bg-white/20"><div className="sun-track absolute inset-y-0 left-0 rounded-full" style={{ width: `${nowSunPos}%` }} /><span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#ff6a00] bg-[#090909] shadow-[0_0_12px_rgba(255,106,0,.6)]" style={{ left: `${nowSunPos}%` }} /></div>
                        <div className="mt-3 flex justify-between text-[10px] text-white/45"><span>Daylight</span><span>{current!.is_day ? 'Sun is above the horizon' : 'Sun is below the horizon'}</span></div>
                      </section>
                    </div>

                    <section className="glass mt-5 rounded-[24px] px-5 py-5 sm:px-7">
                      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-[13px] font-bold tracking-wide">The hours ahead</h2><p className="mt-1 text-[10px] text-white/55">Temperature in °C & chance of precipitation</p></div><span className="mono text-[9px] tracking-[.16em] text-white/45">12 HOURS</span></div>
                      <div className="forecast-scroll flex gap-0 overflow-x-auto pb-1">
                        {hourlyItems.map(item => <div key={item.key} className="flex min-w-[69px] flex-1 flex-col items-center border-r border-white/[.09] px-2 last:border-0">
                          <span className="mono text-[10px] text-white/60">{item.label}</span>
                          <span className="my-3 text-[#ff6a00]"><WeatherIcon code={item.code} size={17} /></span>
                          <span className="text-[14px] font-semibold">{Math.round(item.temperature)}°</span>
                          <span className="mt-2 text-[9px] text-white/50">{item.probability == null ? 'Now' : `${item.probability}%`}</span>
                        </div>)}
                      </div>
                    </section>

                    <section className="glass mt-5 rounded-[24px] px-5 py-5 sm:px-7">
                      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-[13px] font-bold tracking-wide">Seven-day outlook</h2><p className="mt-1 text-[10px] text-white/55">Daily high / low in °C</p></div><span className="mono text-[9px] tracking-[.16em] text-white/45">7 DAY</span></div>
                      <div className="forecast-scroll flex overflow-x-auto">
                        {weather.daily.time.map((date, index) => <div key={date} className="flex min-w-[92px] flex-1 flex-col items-center border-r border-white/[.09] py-2 last:border-0">
                          <span className="text-[11px] font-semibold">{dayName(date, index)}</span><span className="my-3 text-[#ff6a00]"><WeatherIcon code={weather.daily.weather_code[index]} size={18} /></span>
                          <div className="flex items-center gap-2"><span className="text-[12px] font-semibold">{Math.round(weather.daily.temperature_2m_max[index])}°</span><span className="text-[11px] text-white/50">{Math.round(weather.daily.temperature_2m_min[index])}°</span></div>
                          <span className="mt-2 text-[9px] text-white/50">{weather.daily.precipitation_probability_max[index]}% precip</span>
                        </div>)}
                      </div>
                    </section>

                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                      <section className="glass flex items-center justify-between rounded-[22px] px-6 py-5">
                        <div><div className="mono text-[9px] tracking-[.2em] text-white/55">AIR QUALITY</div>{air ? <><div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-semibold tracking-tight">{air.current.us_aqi ?? air.current.european_aqi ?? '—'}</span><span className="text-xs text-[#ff6a00]">{aqiLabel(air.current.us_aqi ?? air.current.european_aqi)}</span></div><div className="mt-1 text-[10px] text-white/55">US AQI {air.current.us_aqi ?? '—'} <span className="mx-1 text-white/30">·</span> PM2.5 {air.current.pm2_5 ?? '—'} μg/m³</div></> : <div className="mt-3 text-[12px] text-white/60">{airError ? 'Air quality data unavailable' : 'Loading air quality…'}</div>}</div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ff6a00]/40 text-[#ff6a00]"><Wind size={20} /></div>
                      </section>
                      <section className="glass flex items-center justify-between rounded-[22px] px-6 py-5">
                        <div><div className="mono text-[9px] tracking-[.2em] text-white/55">PRECIPITATION NOW</div><div className="mt-2 text-3xl font-semibold tracking-tight">{current!.precipitation}<span className="ml-1 text-base font-normal text-white/65">mm</span></div><div className="mt-1 text-[10px] text-white/55">Observed at your selected location</div></div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white/80"><Droplets size={20} /></div>
                      </section>
                    </div>
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[9px] text-white/40">
                      <span>Weather data by Open-Meteo</span>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><a href="https://www.flickr.com/photos/72396314@N00/648813429" target="_blank" rel="noreferrer" className="underline decoration-white/25 underline-offset-2 hover:text-white/75">Night rain photo: OiMax</a><a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noreferrer" className="underline decoration-white/25 underline-offset-2 hover:text-white/75">CC BY 2.0</a><a href="https://www.flickr.com/photos/87007001@N04/15161175750" target="_blank" rel="noreferrer" className="underline decoration-white/25 underline-offset-2 hover:text-white/75">Night storm photo: O.S. Fisher</a></div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
        <footer className="weather-content mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 pb-5 text-[9px] tracking-[.1em] text-white/35 sm:px-10 lg:px-16"><span>WEATHER WINDOW</span><span>OBSERVE THE ATMOSPHERE</span></footer>
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div><div className="flex items-center gap-1.5 text-[10px] text-white/55">{icon}{label}</div><div className="mono mt-1.5 text-[13px] font-medium">{value}</div></div>;
}

export default App;
