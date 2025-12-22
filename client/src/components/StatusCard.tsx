import { ReactNode } from 'react';
import { LucideIcon, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface StatusCardProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  status?: 'normal' | 'warning' | 'critical' | 'info';
}

export function StatusCard({ title, icon: Icon, children, className, status = 'normal' }: StatusCardProps) {
  const statusColors = {
    normal: 'border-border/50 bg-card/50',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    critical: 'border-red-500/30 bg-red-500/5',
    info: 'border-blue-500/30 bg-blue-500/5'
  };

  const iconColors = {
    normal: 'text-muted-foreground bg-secondary',
    warning: 'text-yellow-500 bg-yellow-500/10',
    critical: 'text-red-500 bg-red-500/10',
    info: 'text-blue-500 bg-blue-500/10'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "rounded-xl border backdrop-blur-sm overflow-hidden flex flex-col h-full",
        statusColors[status],
        className
      )}
    >
      <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={cn("p-2 rounded-lg", iconColors[status])}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-foreground tracking-tight">{title}</h3>
        </div>
        {status === 'critical' && (
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        )}
      </div>
      <div className="p-5 flex-grow">
        {children}
      </div>
    </motion.div>
  );
}

interface StatusItemProps {
  label: string;
  value: string;
  citation?: string;
  badge?: ReactNode;
}

export function StatusItem({ label, value, citation, badge }: StatusItemProps) {
  return (
    <div className="py-3 first:pt-0 last:pb-0 border-b border-border/30 last:border-0 group">
      <div className="flex justify-between items-start mb-1">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {citation && (
          <a 
            href={citation} 
            target="_blank" 
            rel="noopener noreferrer"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-primary hover:underline flex items-center"
          >
            Source <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold text-foreground leading-snug">{value}</div>
        {badge}
      </div>
    </div>
  );
}
