# Weather Window

A responsive live-weather app with global city search, browser geolocation, current conditions, hourly and seven-day forecasts, sunrise/sunset, air quality, and weather-matched photographic backgrounds.

## Run locally

Requires Node.js 20.19+.

```sh
npm install
npm run dev
```

Build for production with `npm run build`; preview the build with `npm run preview`.

## Data sources

- Weather, geocoding, and air quality: [Open-Meteo](https://open-meteo.com/)
- Reverse geocoding for device location: [BigDataCloud](https://www.bigdatacloud.com/)

The app calls these public services directly and does not require an API key.

## Photo credits

Night rain photo: [OiMax](https://www.flickr.com/photos/72396314@N00/648813429), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).

Night storm photo: [O.S. Fisher](https://www.flickr.com/photos/87007001@N04/15161175750), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).
