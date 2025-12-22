import { Droplets } from 'lucide-react';
import { StatusCard, StatusItem } from '../StatusCard';
import { StatusBadge } from '../StatusBadge';
import { SnapshotData } from '@shared/schema';

interface WaterWidgetProps {
  data: SnapshotData['real_time_status_updates']['water_sewer_alerts'];
}

export function WaterWidget({ data }: WaterWidgetProps) {
  const hasAlerts = data.some(item => 
    item.value.toLowerCase().includes('boil') || 
    item.value.toLowerCase().includes('contamination')
  );

  return (
    <StatusCard 
      title="Water & Sewer" 
      icon={Droplets}
      status={hasAlerts ? 'warning' : 'info'}
      className="col-span-1"
    >
      {data.length === 0 ? (
        <div className="text-muted-foreground text-sm">No water alerts at this time.</div>
      ) : (
        <div className="space-y-1">
          {data.map((item, i) => (
            <StatusItem 
              key={i}
              label={`Notice ${i + 1}`}
              value={item.value}
              citation={item.value_citation}
              badge={<StatusBadge status={hasAlerts ? 'Alert' : 'Notice'} />}
            />
          ))}
        </div>
      )}
    </StatusCard>
  );
}
