import { Ship } from 'lucide-react';
import { StatusCard, StatusItem } from '../StatusCard';
import { StatusBadge } from '../StatusBadge';

interface FerryItem {
  ferry_line: string;
  route: string;
  route_citation?: string;
  status: string;
  status_citation?: string;
}

interface FerryWidgetProps {
  data: FerryItem[];
}

export function FerryWidget({ data }: FerryWidgetProps) {
  return (
    <StatusCard 
      title="Ferry Schedules" 
      icon={Ship}
      className="col-span-1 md:col-span-2 lg:col-span-2 row-span-2"
    >
      {data.length === 0 ? (
        <div className="text-muted-foreground text-sm">No schedule data available.</div>
      ) : (
        <div className="space-y-4">
          {data.map((item, i) => (
            <div key={i} className="bg-secondary/30 rounded-lg p-4 border border-border/50">
              <div className="flex justify-between items-start mb-3">
                <div className="font-mono text-xs text-primary uppercase tracking-wider font-bold">
                  {item.ferry_line}
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="grid grid-cols-1 gap-1">
                <StatusItem 
                  label="Route" 
                  value={item.route} 
                  citation={item.route_citation}
                />
                <StatusItem 
                  label="Status Detail" 
                  value={item.status} 
                  citation={item.status_citation}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </StatusCard>
  );
}
