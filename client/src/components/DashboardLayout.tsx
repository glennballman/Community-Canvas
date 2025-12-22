import { ReactNode } from 'react';
import { RefreshCw, MapPin, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface DashboardLayoutProps {
  children: ReactNode;
  lastUpdated?: Date | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  location: string;
}

export function DashboardLayout({ 
  children, 
  lastUpdated, 
  onRefresh, 
  isRefreshing,
  location
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background grid-pattern text-foreground font-sans">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-[0_0_15px_-3px_rgba(var(--primary),0.3)]">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none text-foreground">
                Community Status
              </h1>
              <div className="flex items-center mt-1 space-x-2 text-xs text-muted-foreground font-mono">
                <span className="flex items-center text-primary/80">
                  <MapPin className="w-3 h-3 mr-1" />
                  {location}
                </span>
                <span>•</span>
                <span>
                  UPDATED: {lastUpdated ? format(lastUpdated, "MMM d, HH:mm") : 'NEVER'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh}
              disabled={isRefreshing}
              className="hidden sm:flex bg-card/50 border-border/50 hover:bg-card hover:text-primary transition-all duration-300"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onRefresh}
              className="sm:hidden"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      
      <footer className="border-t border-border/40 bg-card/20 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground font-mono">
          <p>Data aggregates from public sources. For critical emergencies, always contact local authorities.</p>
        </div>
      </footer>
    </div>
  );
}
