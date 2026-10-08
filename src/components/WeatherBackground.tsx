import { useEffect, useState } from 'react';
import type { Place } from '../weather-types';
import { getWeatherPhoto } from '../weather-background';

type Props = {
  place: Place | null;
  condition: number | null;
  isDay: boolean;
  sunrise?: string;
  sunset?: string;
  timezone?: string;
  now?: number;
};
export default function WeatherBackground({ place, condition, isDay, sunrise, sunset, timezone, now }: Props) {
  const [active, setActive] = useState('/weather/clear-day.jpg');
  const [incoming, setIncoming] = useState<string | null>(null);
  const [incomingOpacity, setIncomingOpacity] = useState(0);
  const target = condition !== null
    ? getWeatherPhoto(place, condition, isDay, sunrise, sunset, timezone, now)
    : active;
  useEffect(() => {
    if (target === active) return;
    let cancelled = false;
    let timeout: number | undefined;
    const image = new Image();
    image.src = target;
    image.onload = () => {
      if (cancelled) return;
      setIncoming(target);
      setIncomingOpacity(0);
      requestAnimationFrame(() => {
        if (!cancelled) setIncomingOpacity(1);
      });
      timeout = window.setTimeout(() => {
        if (cancelled) return;
        setActive(target);
        setIncoming(null);
        setIncomingOpacity(0);
      }, 1150);
    };
    image.onerror = () => { setIncoming(null); };
    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
    };
  }, [target, active]);
  return (
    <div aria-hidden="true">
      <div className="weather-bg" style={{ backgroundImage: `url("${active}")`, opacity: 1 }} />
      {incoming && <div className="weather-bg" style={{ backgroundImage: `url("${incoming}")`, opacity: incomingOpacity }} />}
    </div>
  );
}
