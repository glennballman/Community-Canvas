import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Alert {
  value: string;
  value_citation?: string;
  severity?: "info" | "warning" | "critical";
}

interface AlertWidgetProps {
  data: Alert[];
}

export function AlertWidget({ data }: AlertWidgetProps) {
  if (data.length === 0) return null;

  return (
    <div className="col-span-1 md:col-span-2 lg:col-span-3 mb-6">
      <div className="space-y-3">
        {data.map((alert, i) => (
          <div 
            key={i}
            className={cn(
              "rounded-xl p-4 flex items-start gap-4 shadow-lg border-l-4",
              "bg-red-500/10 border-red-500 text-red-50 border-t border-r border-b border-white/5"
            )}
          >
            <div className="bg-red-500/20 p-2 rounded-lg shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-grow">
              <h4 className="font-bold text-red-400 mb-1 flex items-center">
                Active Alert
                {alert.value_citation && (
                  <a href={alert.value_citation} target="_blank" rel="noopener noreferrer" className="ml-2 opacity-60 hover:opacity-100">
                    <Info className="w-4 h-4" />
                  </a>
                )}
              </h4>
              <p className="text-foreground/90 font-medium leading-relaxed">
                {alert.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
