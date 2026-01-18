import { Outlet } from "react-router-dom";

interface PublicLayoutProps {
  children?: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background" data-testid="public-layout">
      <header className="border-b border-border bg-card" data-testid="public-header">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-lg font-semibold" data-testid="text-public-title">
              Reservations
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6" data-testid="public-main">
        {children || <Outlet />}
      </main>

      <footer className="border-t border-border bg-card mt-auto" data-testid="public-footer">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          Powered by Community Canvas
        </div>
      </footer>
    </div>
  );
}
