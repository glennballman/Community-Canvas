import { Radio } from 'lucide-react';
import { Button } from './ui/button';

interface EmptyStateProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function EmptyState({ onRefresh, isRefreshing }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 border-2 border-dashed border-border rounded-3xl bg-card/20">
      <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-6 text-muted-foreground animate-pulse">
        <Radio className="w-10 h-10" />
      </div>
      <h3 className="text-2xl font-bold text-foreground mb-2">No Status Data Available</h3>
      <p className="text-muted-foreground max-w-md mb-8">
        We haven't collected any community status updates for this location yet. Initialize the dashboard by refreshing data.
      </p>
      <Button 
        size="lg" 
        onClick={onRefresh} 
        disabled={isRefreshing}
        className="px-8 font-semibold shadow-lg shadow-primary/25"
      >
        {isRefreshing ? 'Initializing System...' : 'Initialize Dashboard'}
      </Button>
    </div>
  );
}
