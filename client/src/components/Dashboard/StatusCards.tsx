import { useEffect, useState } from 'react';
import { AlertTriangle, Ship, Cloud, Car, Sun, CloudRain, CloudSnow, CloudLightning, CloudFog, Wind } from 'lucide-react';

interface StatusData {
  alerts: { critical: number; major: number; warning: number; advisory: number; minor: number; total: number };
  ferries: { status: string; delays: number; onTime: number };
  weather: { temperature: number; condition: string; warnings: number };
  roads: { closures: number; incidents: number; construction: number; total: number };
}

interface StatusCardsProps {
  regionId: string;
  onCardClick?: (card: 'alerts' | 'ferries' | 'weather' | 'roads') => void;
}

export function StatusCards({ regionId, onCardClick }: StatusCardsProps) {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [regionId]);

  async function fetchStatus() {
    try {
      const response = await fetch(`/api/v1/status/summary?region=${regionId}`);
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-muted rounded-xl p-4 animate-pulse h-28" />
        ))}
      </div>
    );
  }

  const alertColor = status?.alerts?.critical && status.alerts.critical > 0 ? 'red' 
    : status?.alerts?.major && status.alerts.major > 0 ? 'orange'
    : status?.alerts?.total && status.alerts.total > 0 ? 'yellow' 
    : 'green';

  const ferryColor = status?.ferries?.delays && status.ferries.delays > 0 ? 'yellow' : 'green';

  const roadColor = status?.roads?.closures && status.roads.closures > 0 ? 'red'
    : status?.roads?.incidents && status.roads.incidents > 0 ? 'orange'
    : 'green';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatusCard
        icon={AlertTriangle}
        title="Alerts"
        value={status?.alerts?.total || 0}
        subtitle={
          status?.alerts?.critical 
            ? `${status.alerts.critical} critical` 
            : status?.alerts?.major 
            ? `${status.alerts.major} major`
            : 'All clear'
        }
        color={alertColor}
        onClick={() => onCardClick?.('alerts')}
        pulse={!!(status?.alerts?.critical && status.alerts.critical > 0)}
      />

      <StatusCard
        icon={Ship}
        title="Ferries"
        value={status?.ferries?.delays ? `${status.ferries.delays} Delays` : 'On Time'}
        subtitle={`${status?.ferries?.onTime || 0} routes normal`}
        color={ferryColor}
        onClick={() => onCardClick?.('ferries')}
      />

      <StatusCard
        icon={getWeatherIcon(status?.weather?.condition)}
        title="Weather"
        value={status?.weather?.temperature !== undefined ? `${status.weather.temperature}°C` : '--'}
        subtitle={status?.weather?.condition || 'Loading...'}
        color={status?.weather?.warnings ? 'yellow' : 'blue'}
        onClick={() => onCardClick?.('weather')}
      />

      <StatusCard
        icon={Car}
        title="Roads"
        value={`${status?.roads?.total || 0} Events`}
        subtitle={
          status?.roads?.closures 
            ? `${status.roads.closures} closures` 
            : status?.roads?.incidents
            ? `${status.roads.incidents} incidents`
            : 'Roads clear'
        }
        color={roadColor}
        onClick={() => onCardClick?.('roads')}
      />
    </div>
  );
}

interface StatusCardProps {
  icon: typeof AlertTriangle;
  title: string;
  value: string | number;
  subtitle: string;
  color: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'gray';
  onClick?: () => void;
  pulse?: boolean;
}

function StatusCard({ icon: Icon, title, value, subtitle, color, onClick, pulse }: StatusCardProps) {
  const colorConfig = {
    red: {
      bg: 'bg-red-500/20 dark:bg-red-500/20',
      border: 'border-red-500/50',
      text: 'text-red-600 dark:text-red-400',
      value: 'text-red-700 dark:text-red-300',
      icon: 'text-red-500',
    },
    orange: {
      bg: 'bg-orange-500/20 dark:bg-orange-500/20',
      border: 'border-orange-500/50',
      text: 'text-orange-600 dark:text-orange-400',
      value: 'text-orange-700 dark:text-orange-300',
      icon: 'text-orange-500',
    },
    yellow: {
      bg: 'bg-yellow-500/20 dark:bg-yellow-500/20',
      border: 'border-yellow-500/50',
      text: 'text-yellow-600 dark:text-yellow-400',
      value: 'text-yellow-700 dark:text-yellow-300',
      icon: 'text-yellow-500',
    },
    green: {
      bg: 'bg-green-500/20 dark:bg-green-500/20',
      border: 'border-green-500/50',
      text: 'text-green-600 dark:text-green-400',
      value: 'text-green-700 dark:text-green-300',
      icon: 'text-green-500',
    },
    blue: {
      bg: 'bg-blue-500/20 dark:bg-blue-500/20',
      border: 'border-blue-500/50',
      text: 'text-blue-600 dark:text-blue-400',
      value: 'text-blue-700 dark:text-blue-300',
      icon: 'text-blue-500',
    },
    gray: {
      bg: 'bg-muted',
      border: 'border-border',
      text: 'text-muted-foreground',
      value: 'text-foreground',
      icon: 'text-muted-foreground',
    },
  };

  const config = colorConfig[color];

  return (
    <div
      className={`
        rounded-xl p-4 border cursor-pointer transition-all duration-200
        ${config.bg} ${config.border}
        hover:scale-[1.02] hover:shadow-lg
        ${pulse ? 'animate-pulse' : ''}
      `}
      onClick={onClick}
      data-testid={`card-status-${title.toLowerCase()}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <Icon className={`w-6 h-6 ${config.icon}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${config.text}`}>
          {title}
        </span>
      </div>
      <div className={`text-2xl font-bold ${config.value}`}>
        {value}
      </div>
      <div className={`text-sm mt-1 ${config.text}`}>
        {subtitle}
      </div>
    </div>
  );
}

function getWeatherIcon(condition?: string): typeof Cloud {
  if (!condition) return Cloud;
  const lower = condition.toLowerCase();
  if (lower.includes('snow')) return CloudSnow;
  if (lower.includes('rain')) return CloudRain;
  if (lower.includes('thunder')) return CloudLightning;
  if (lower.includes('fog')) return CloudFog;
  if (lower.includes('wind')) return Wind;
  if (lower.includes('sun') || lower.includes('clear')) return Sun;
  return Cloud;
}

export default StatusCards;
