import { Zap } from 'lucide-react';
import { StatusCard, StatusItem } from '../StatusCard';
import { StatusBadge } from '../StatusBadge';
import { SnapshotData } from '@shared/schema';

interface HydroWidgetProps {
  data: SnapshotData['real_time_status_updates']['bc_hydro_outages'];
}

export function HydroWidget({ data }: HydroWidgetProps) {
  // Determine if there are any active outages to set card status
  const hasOutages = data.some(item => 
    item.value.toLowerCase().includes('outage') || 
    item.value.toLowerCase().includes('off')
  );

  return (
    <StatusCard 
      title="Power Status" 
      icon={Zap} 
      status={hasOutages ? 'warning' : 'normal'}
      className="col-span-1 md:col-span-2 lg:col-span-1"
    >
      {data.length === 0 ? (
        <div className="text-muted-foreground text-sm py-2">No active outage reports found.</div>
      ) : (
        <div className="space-y-1">
          {data.map((item, i) => (
            <StatusItem 
              key={i}
              label={i === 0 ? "Current Status" : `Report ${i + 1}`}
              value={item.value}
              citation={item.value_citation}
              badge={<StatusBadge status={item.value.includes('outage') ? 'Outage' : 'Normal'} />}
            />
          ))}
        </div>
      )}
    </StatusCard>
  );
}
