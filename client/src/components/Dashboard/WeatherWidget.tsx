import { useEffect, useState } from 'react';
import { Cloud, Droplets, Wind, Thermometer, AlertTriangle, ChevronDown, ChevronUp, Sun, CloudRain, Snowflake, CloudLightning, CloudFog } from 'lucide-react';

interface WeatherData {
  location: string;
  temperature: number;
  feelsLike: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  observedAt: string;
  forecast: ForecastDay[];
  warnings: string[];
}

interface ForecastDay {
  day: string;
  high: number;
  low: number;
  condition: string;
  pop: number;
}

interface WeatherWidgetProps {
  regionId?: string;
}

export function WeatherWidget({ regionId }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [regionId]);

  async function fetchWeather() {
    try {
      const response = await fetch(`/api/v1/weather?region=${regionId || 'bc'}`);
      const data = await response.json();
      if (data.temperature !== undefined) {
        setWeather(data);
      } else {
        setWeather(getMockWeather());
      }
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      setWeather(getMockWeather());
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-white/20 rounded w-24 mb-3"></div>
        <div className="h-12 bg-white/20 rounded w-20 mb-2"></div>
        <div className="h-4 bg-white/20 rounded w-32"></div>
      </div>
    );
  }

  if (!weather) return null;

  const WeatherIcon = getWeatherIcon(weather.condition);

  return (
    <div 
      className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl overflow-hidden cursor-pointer"
      onClick={() => setShowDetails(!showDetails)}
      data-testid="weather-widget"
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white/80 text-sm flex items-center gap-1">
            <Cloud className="w-4 h-4" /> Weather
          </span>
          <span className="text-white/60 text-xs">
            {weather.location}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <WeatherIcon className="w-10 h-10 text-white" />
          <div>
            <div className="text-4xl font-bold text-white">
              {weather.temperature}°C
            </div>
            <div className="text-white/80 text-sm">
              {weather.condition}
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-3 text-sm text-white/70">
          <span className="flex items-center gap-1">
            <Droplets className="w-3 h-3" /> {weather.humidity}%
          </span>
          <span className="flex items-center gap-1">
            <Wind className="w-3 h-3" /> {weather.windSpeed} km/h {weather.windDirection}
          </span>
          <span className="flex items-center gap-1">
            <Thermometer className="w-3 h-3" /> Feels {weather.feelsLike}°
          </span>
        </div>

        {weather.warnings && weather.warnings.length > 0 && (
          <div className="mt-3 p-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
            <p className="text-yellow-200 text-sm flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> {weather.warnings[0]}
            </p>
          </div>
        )}
      </div>

      {showDetails && weather.forecast && (
        <div className="px-4 pb-4 border-t border-white/10 pt-3">
          <p className="text-white/60 text-xs uppercase mb-2">5-Day Forecast</p>
          <div className="grid grid-cols-5 gap-1">
            {weather.forecast.slice(0, 5).map((day, i) => {
              const DayIcon = getWeatherIcon(day.condition);
              return (
                <div key={i} className="text-center">
                  <p className="text-white/60 text-xs">{day.day}</p>
                  <DayIcon className="w-5 h-5 mx-auto text-white my-1" />
                  <p className="text-white text-sm font-medium">{day.high}°</p>
                  <p className="text-white/50 text-xs">{day.low}°</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-4 pb-2 text-center">
        <span className="text-white/40 text-xs flex items-center justify-center gap-1">
          {showDetails ? (
            <><ChevronUp className="w-3 h-3" /> Less</>
          ) : (
            <><ChevronDown className="w-3 h-3" /> Forecast</>
          )}
        </span>
      </div>
    </div>
  );
}

function getWeatherIcon(condition?: string): typeof Cloud {
  if (!condition) return Sun;
  const lower = condition.toLowerCase();
  if (lower.includes('snow')) return Snowflake;
  if (lower.includes('rain') || lower.includes('shower')) return CloudRain;
  if (lower.includes('thunder') || lower.includes('storm')) return CloudLightning;
  if (lower.includes('overcast') || lower.includes('cloudy')) return Cloud;
  if (lower.includes('fog') || lower.includes('mist')) return CloudFog;
  if (lower.includes('sun') || lower.includes('clear')) return Sun;
  if (lower.includes('wind')) return Wind;
  return Cloud;
}

function getMockWeather(): WeatherData {
  return {
    location: 'Vancouver',
    temperature: -2,
    feelsLike: -5,
    condition: 'Light Snow',
    humidity: 85,
    windSpeed: 15,
    windDirection: 'NW',
    observedAt: new Date().toISOString(),
    forecast: [
      { day: 'Today', high: 1, low: -3, condition: 'Snow', pop: 80 },
      { day: 'Wed', high: 3, low: -1, condition: 'Cloudy', pop: 30 },
      { day: 'Thu', high: 5, low: 0, condition: 'Partly Cloudy', pop: 10 },
      { day: 'Fri', high: 4, low: -2, condition: 'Rain', pop: 60 },
      { day: 'Sat', high: 6, low: 1, condition: 'Sunny', pop: 0 },
    ],
    warnings: []
  };
}

export default WeatherWidget;
