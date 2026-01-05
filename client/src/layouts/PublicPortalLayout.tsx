import { Outlet, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Calendar, Home, MapPin, Users, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CommunityInfo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  heroImage?: string;
}

export default function PublicPortalLayout() {
  const { slug } = useParams<{ slug: string }>();

  const { data: community, isLoading } = useQuery<CommunityInfo>({
    queryKey: ['/api/communities/by-slug', slug],
    enabled: !!slug,
  });

  const navItems = [
    { label: 'Overview', path: `/c/${slug}`, icon: Home },
    { label: 'Businesses', path: `/c/${slug}/businesses`, icon: Building2 },
    { label: 'Services', path: `/c/${slug}/services`, icon: Users },
    { label: 'Stay', path: `/c/${slug}/stay`, icon: MapPin },
    { label: 'Events', path: `/c/${slug}/events`, icon: Calendar },
    { label: 'About', path: `/c/${slug}/about`, icon: Info },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading community...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="public-portal-layout">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4">
          <Link 
            to={`/c/${slug}`} 
            className="font-semibold text-lg"
            data-testid="link-community-home"
          >
            {community?.name || slug}
          </Link>
          
          <nav className="flex items-center gap-1 ml-auto">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="gap-2"
                  data-testid={`link-nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </Button>
              </Link>
            ))}
          </nav>
          
          <Link to="/login">
            <Button variant="outline" size="sm" data-testid="button-login">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      <main className="container py-6">
        <Outlet context={{ community, slug }} />
      </main>

      <footer className="border-t py-6 mt-auto">
        <div className="container text-center text-sm text-muted-foreground">
          Powered by Community Canvas
        </div>
      </footer>
    </div>
  );
}
