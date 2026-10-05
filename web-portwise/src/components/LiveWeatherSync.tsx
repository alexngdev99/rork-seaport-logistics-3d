import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { env, type LiveWeather } from "@/state/environment";

const LAT = 1.2655;
const LON = 103.7633;
const FORECAST_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,precipitation,visibility" +
  "&timezone=Asia%2FSingapore&wind_speed_unit=ms";
const AIR_URL = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=us_aqi&timezone=Asia%2FSingapore`;

interface ForecastResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    wind_direction_10m?: number;
    cloud_cover?: number;
    precipitation?: number;
    visibility?: number;
  };
}

interface AirResponse {
  current?: { us_aqi?: number };
}

async function fetchLiveWeather(): Promise<LiveWeather> {
  const [forecast, air] = await Promise.allSettled([
    fetch(FORECAST_URL).then((r) => {
      if (!r.ok) throw new Error(`forecast ${r.status}`);
      return r.json() as Promise<ForecastResponse>;
    }),
    fetch(AIR_URL).then((r) => {
      if (!r.ok) throw new Error(`air ${r.status}`);
      return r.json() as Promise<AirResponse>;
    }),
  ]);
  if (forecast.status !== "fulfilled" || !forecast.value.current) throw new Error("Weather unavailable");
  const c = forecast.value.current;
  const aqi = air.status === "fulfilled" ? (air.value.current?.us_aqi ?? null) : null;
  return {
    code: c.weather_code ?? 2,
    tempC: c.temperature_2m ?? 29,
    humidity: c.relative_humidity_2m ?? 75,
    windMs: c.wind_speed_10m ?? 3,
    gustMs: c.wind_gusts_10m ?? (c.wind_speed_10m ?? 3) * 1.8,
    windFromDeg: c.wind_direction_10m ?? 160,
    cloudCover: (c.cloud_cover ?? 40) / 100,
    precipMm: c.precipitation ?? 0,
    visibilityM: c.visibility ?? 20000,
    aqi,
    observedAt: c.time?.slice(11, 16) ?? "",
  };
}

/** Keeps the scene's live weather in sync with Open-Meteo for Pasir Panjang (refreshes every 10 min). */
export function LiveWeatherSync() {
  const { data, isError } = useQuery({
    queryKey: ["live-weather", LAT, LON],
    queryFn: fetchLiveWeather,
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  useEffect(() => {
    if (data) env.setLive(data);
  }, [data]);

  useEffect(() => {
    if (isError && !data) {
      console.warn("[weather] live weather unavailable, using typical conditions");
      env.setLiveStatus("error");
    }
  }, [isError, data]);

  return null;
}
