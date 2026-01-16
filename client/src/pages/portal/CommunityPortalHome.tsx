/**
 * COMMUNITY PORTAL HOME
 * 
 * Route: /c/:slug (index)
 * 
 * Default overview page for community portals.
 * Uses portal context from PublicPortalLayout via usePortalContext.
 */

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortalContext } from "@/layouts/PublicPortalLayout";
import { ArrowRight, Calendar, MapPin, Users, Building2 } from "lucide-react";

export default function CommunityPortalHome() {
  const { portal } = usePortalContext();
  
  const theme = portal.theme || { primary_color: '#3b82f6' };
  const primaryColor = theme.primary_color || '#3b82f6';

  return (
    <div 
      className="min-h-[60vh]"
      data-testid="page-community-portal-home"
    >
      <section 
        className="relative py-20 px-4"
        style={{ 
          background: `linear-gradient(135deg, ${primaryColor}15 0%, transparent 50%)` 
        }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h1 
            className="text-4xl md:text-5xl font-bold mb-4"
            data-testid="text-portal-name"
          >
            Welcome to {portal.name}
          </h1>
          {portal.tagline && (
            <p 
              className="text-xl opacity-80 mb-8"
              data-testid="text-portal-tagline"
            >
              {portal.tagline}
            </p>
          )}
          {portal.description && (
            <p 
              className="text-lg opacity-70 mb-8 max-w-2xl mx-auto"
              data-testid="text-portal-description"
            >
              {portal.description}
            </p>
          )}
          
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/app">
              <Button 
                size="lg"
                style={{ backgroundColor: primaryColor }}
                data-testid="button-enter-app"
              >
                Enter App
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Explore Our Community</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover-elevate" data-testid="card-businesses">
              <CardHeader>
                <Building2 className="h-8 w-8 mb-2" style={{ color: primaryColor }} />
                <CardTitle>Local Businesses</CardTitle>
                <CardDescription>
                  Discover shops, restaurants, and services in the area
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to={`/c/${portal.slug}/businesses`}>
                  <Button variant="ghost" className="px-0">
                    Browse Businesses
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-services">
              <CardHeader>
                <Users className="h-8 w-8 mb-2" style={{ color: primaryColor }} />
                <CardTitle>Community Services</CardTitle>
                <CardDescription>
                  Shared service runs and community programs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to={`/c/${portal.slug}/services`}>
                  <Button variant="ghost" className="px-0">
                    View Services
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-stay">
              <CardHeader>
                <MapPin className="h-8 w-8 mb-2" style={{ color: primaryColor }} />
                <CardTitle>Places to Stay</CardTitle>
                <CardDescription>
                  Find accommodations and lodging options
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to={`/c/${portal.slug}/stay`}>
                  <Button variant="ghost" className="px-0">
                    Find Lodging
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-events">
              <CardHeader>
                <Calendar className="h-8 w-8 mb-2" style={{ color: primaryColor }} />
                <CardTitle>Events</CardTitle>
                <CardDescription>
                  Upcoming community events and happenings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to={`/c/${portal.slug}/events`}>
                  <Button variant="ghost" className="px-0">
                    See Events
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 border-t" style={{ backgroundColor: `${primaryColor}08` }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-6">
            Sign in to access all features and connect with our community.
          </p>
          <Link to="/app">
            <Button 
              size="lg"
              variant="outline"
              data-testid="button-sign-in"
            >
              Sign In
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
