import { Truck } from 'lucide-react';
import { StatusCard, StatusItem } from '../StatusCard';
import { StatusBadge } from '../StatusBadge';

interface RoadItem {
  road_name: string;
  status: string;
  status_citation?: string;
}

interface RoadWidgetProps {
  data: RoadItem[];
}

export function RoadWidget({ data }: RoadWidgetProps) {
  return (
    <StatusCard 
      title="Road Conditions" 
      icon={Truck}
      className="col-span-1 md:col-span-1"
    >
      {data.length === 0 ? (
        <div className="text-muted-foreground text-sm">No road reports available.</div>
      ) : (
        <div className="space-y-1">
          {data.map((item, i) => (
            <StatusItem 
              key={i}
              label={item.road_name}
              value={item.status}
              citation={item.status_citation}
              badge={<StatusBadge status={item.status.includes('Closed') ? 'Closed' : 'Open'} />}
            />
          ))}
        </div>
      )}
    </StatusCard>
  );
}
