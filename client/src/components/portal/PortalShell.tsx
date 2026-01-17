import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, Briefcase, Calendar, Users, ExternalLink, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavLink {
  label: string;
  url: string;
  isExternal: boolean;
}

interface PortalUISettings {
  logo_url?: string;
  primary_color?: string;
  nav_mode?: 'top' | 'left';
  nav_links?: NavLink[];
  show_powered_by?: boolean;
  external_site_url?: string;
  external_site_name?: string;
}

interface PortalSettingsResponse {
  ok: boolean;
  portal: {
    id: string;
    slug: string;
    name: string;
    ui_settings: PortalUISettings;
  };
}

const DEFAULT_NAV_LINKS: NavLink[] = [
  { label: 'Jobs', url: '/jobs', isExternal: false },
];

function TopNav({ 
  portal, 
  settings, 
  currentPath 
}: { 
  portal: { slug: string; name: string }; 
  settings: PortalUISettings; 
  currentPath: string;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navLinks = settings.nav_links?.length ? settings.nav_links : DEFAULT_NAV_LINKS;

  return (
    <header 
      className="border-b bg-background/95 backdrop-blur sticky top-0 z-50"
      style={settings.primary_color ? { borderColor: settings.primary_color } : {}}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            {settings.logo_url ? (
              <img 
                src={settings.logo_url} 
                alt={portal.name} 
                className="h-8 w-auto"
                data-testid="portal-logo"
              />
            ) : (
              <Link 
                to={`/b/${portal.slug}/jobs`}
                className="font-bold text-lg"
                style={settings.primary_color ? { color: settings.primary_color } : {}}
                data-testid="portal-name"
              >
                {portal.name}
              </Link>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link, i) => {
              const href = link.isExternal ? link.url : `/b/${portal.slug}${link.url}`;
              const isActive = !link.isExternal && currentPath.includes(link.url);
              
              return link.isExternal ? (
                <a
                  key={i}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                  data-testid={`nav-link-${i}`}
                >
                  {link.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <Link
                  key={i}
                  to={href}
                  className={cn(
                    "px-3 py-2 text-sm rounded-md transition-colors",
                    isActive 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  data-testid={`nav-link-${i}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {settings.external_site_url && (
              <a
                href={settings.external_site_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                data-testid="link-external-site"
              >
                Back to {settings.external_site_name || 'main site'}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link, i) => {
                const href = link.isExternal ? link.url : `/b/${portal.slug}${link.url}`;
                const isActive = !link.isExternal && currentPath.includes(link.url);
                
                return link.isExternal ? (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 text-sm text-muted-foreground flex items-center justify-between"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <Link
                    key={i}
                    to={href}
                    className={cn(
                      "px-4 py-3 text-sm flex items-center justify-between",
                      isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                );
              })}
              
              {settings.external_site_url && (
                <a
                  href={settings.external_site_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 text-sm text-primary flex items-center justify-between border-t mt-2 pt-4"
                >
                  Back to {settings.external_site_name || 'main site'}
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

function LeftNav({ 
  portal, 
  settings, 
  currentPath,
  children
}: { 
  portal: { slug: string; name: string }; 
  settings: PortalUISettings; 
  currentPath: string;
  children: React.ReactNode;
}) {
  const navLinks = settings.nav_links?.length ? settings.nav_links : DEFAULT_NAV_LINKS;

  const getIcon = (label: string) => {
    const lower = label.toLowerCase();
    if (lower.includes('job')) return <Briefcase className="h-4 w-4" />;
    if (lower.includes('calendar') || lower.includes('event')) return <Calendar className="h-4 w-4" />;
    if (lower.includes('team') || lower.includes('lead')) return <Users className="h-4 w-4" />;
    return null;
  };

  return (
    <div className="flex min-h-screen">
      <aside 
        className="w-64 border-r bg-muted/30 p-4 hidden md:block"
        style={settings.primary_color ? { borderColor: `${settings.primary_color}20` } : {}}
      >
        <div className="mb-6">
          {settings.logo_url ? (
            <img 
              src={settings.logo_url} 
              alt={portal.name} 
              className="h-10 w-auto"
              data-testid="portal-logo"
            />
          ) : (
            <span 
              className="font-bold text-lg"
              style={settings.primary_color ? { color: settings.primary_color } : {}}
              data-testid="portal-name"
            >
              {portal.name}
            </span>
          )}
        </div>

        <nav className="space-y-1">
          {navLinks.map((link, i) => {
            const href = link.isExternal ? link.url : `/b/${portal.slug}${link.url}`;
            const isActive = !link.isExternal && currentPath.includes(link.url);
            
            return link.isExternal ? (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
                data-testid={`nav-link-${i}`}
              >
                {getIcon(link.label)}
                {link.label}
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
            ) : (
              <Link
                key={i}
                to={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                data-testid={`nav-link-${i}`}
              >
                {getIcon(link.label)}
                {link.label}
              </Link>
            );
          })}
        </nav>

        {settings.external_site_url && (
          <div className="mt-auto pt-6 border-t mt-6">
            <a
              href={settings.external_site_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              data-testid="link-external-site"
            >
              <ExternalLink className="h-4 w-4" />
              Back to {settings.external_site_name || 'main site'}
            </a>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="border-b p-4 md:hidden">
          <div className="flex items-center justify-between">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt={portal.name} className="h-8 w-auto" />
            ) : (
              <span className="font-bold">{portal.name}</span>
            )}
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

function PortalFooter({ settings }: { settings: PortalUISettings }) {
  if (settings.show_powered_by === false) return null;
  
  return (
    <footer className="border-t py-4 mt-8">
      <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
        Powered by Community Canvas
      </div>
    </footer>
  );
}

export default function PortalShell({ children }: { children?: React.ReactNode }) {
  const { portalSlug } = useParams();
  const location = useLocation();

  const { data, isLoading } = useQuery<PortalSettingsResponse>({
    queryKey: ['/api/p2/public/portal-settings', portalSlug],
    queryFn: async () => {
      const res = await fetch(`/b/${portalSlug}/api/public/portal-settings`);
      if (!res.ok) {
        return {
          ok: true,
          portal: {
            id: '',
            slug: portalSlug || '',
            name: portalSlug?.replace(/-/g, ' ') || 'Portal',
            ui_settings: {}
          }
        };
      }
      return res.json();
    },
    enabled: !!portalSlug,
  });

  const portal = data?.portal || { 
    id: '', 
    slug: portalSlug || '', 
    name: portalSlug?.replace(/-/g, ' ') || 'Portal',
    ui_settings: {}
  };
  const settings = portal.ui_settings || {};
  const navMode = settings.nav_mode || 'top';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-16 border-b animate-pulse bg-muted" />
        <div className="container mx-auto px-4 py-8">
          {children}
        </div>
      </div>
    );
  }

  const content = children || <Outlet />;

  if (navMode === 'left') {
    return (
      <div className="min-h-screen bg-background" data-testid="portal-shell-left">
        <LeftNav portal={portal} settings={settings} currentPath={location.pathname}>
          {content}
          <PortalFooter settings={settings} />
        </LeftNav>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="portal-shell-top">
      <TopNav portal={portal} settings={settings} currentPath={location.pathname} />
      {content}
      <PortalFooter settings={settings} />
    </div>
  );
}
