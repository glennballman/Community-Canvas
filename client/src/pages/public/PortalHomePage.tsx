import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  MapPin, Phone, Mail, Calendar, ArrowRight, Star, 
  Users, Bed, Bath, Clock, ExternalLink 
} from "lucide-react";

interface PortalSiteData {
  success: boolean;
  portal: {
    id: string;
    slug: string;
    name: string;
    legal_dba_name: string | null;
    portal_type: string;
    base_url: string | null;
  };
  site: {
    brand_name: string;
    tagline: string;
    hero?: {
      title: string;
      subtitle: string;
      image_url?: string;
    };
    primary_cta?: {
      label: string;
      action: string;
    };
    sections?: Array<{
      type: string;
      enabled: boolean;
      order: number;
      title?: string;
    }>;
    theme?: {
      primary_color: string;
      secondary_color: string;
      accent_color: string;
    };
    contact?: {
      email?: string;
      telephone?: string;
      address?: string;
    };
    seo?: {
      description?: string;
    };
  };
  theme: Record<string, any>;
  initial_data: {
    assets: Array<{
      id: string;
      name: string;
      description: string | null;
      asset_type: string;
      schema_type: string | null;
      is_available: boolean;
      rate_daily: number | null;
      rate_hourly: number | null;
      thumbnail_url: string | null;
      sleeps_total: number | null;
      bedrooms: number | null;
      bathrooms_full: number | null;
      overall_rating: number | null;
      review_count: number;
      media: {
        hero: { url: string; thumbnail?: string; alt?: string } | null;
        gallery: Array<{ url: string; thumbnail?: string; alt?: string }>;
      };
    }>;
    articles: Array<{
      id: string;
      slug: string;
      title: string;
      subtitle: string | null;
      summary: string | null;
      featured_image_url: string | null;
      published_at: string | null;
    }>;
  };
  json_ld: Record<string, any>;
}

function HeroSection({ 
  title, 
  subtitle, 
  imageUrl, 
  cta, 
  portalSlug,
  theme 
}: { 
  title?: string; 
  subtitle?: string; 
  imageUrl?: string;
  cta?: { label: string; action: string };
  portalSlug: string;
  theme?: { primary_color: string };
}) {
  const ctaHref = cta?.action === 'reserve' 
    ? `/p/${portalSlug}/reserve` 
    : cta?.action === 'quote'
    ? `/p/${portalSlug}/quote`
    : `/p/${portalSlug}`;

  return (
    <section 
      className="relative min-h-[60vh] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      data-testid="section-hero"
    >
      {imageUrl && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <h1 
          className="text-4xl md:text-6xl font-bold text-white mb-4"
          data-testid="text-hero-title"
        >
          {title || 'Welcome'}
        </h1>
        <p 
          className="text-xl md:text-2xl text-white/90 mb-8"
          data-testid="text-hero-subtitle"
        >
          {subtitle}
        </p>
        {cta && (
          <Link to={ctaHref}>
            <Button 
              size="lg" 
              className="text-lg px-8"
              style={{ 
                backgroundColor: theme?.primary_color,
                borderColor: theme?.primary_color 
              }}
              data-testid="button-hero-cta"
            >
              {cta.label}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        )}
      </div>
    </section>
  );
}

function AssetsSection({ 
  title, 
  assets, 
  portalSlug 
}: { 
  title: string; 
  assets: PortalSiteData['initial_data']['assets'];
  portalSlug: string;
}) {
  if (!assets.length) return null;
  
  return (
    <section className="py-16 px-4 bg-background" data-testid="section-assets">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center" data-testid="text-section-title">
          {title}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assets.slice(0, 9).map((asset) => (
            <Card 
              key={asset.id} 
              className="overflow-hidden hover-elevate"
              data-testid={`card-asset-${asset.id}`}
            >
              <div className="aspect-video bg-muted relative">
                {asset.media?.hero?.url || asset.thumbnail_url ? (
                  <img 
                    src={asset.media?.hero?.thumbnail || asset.media?.hero?.url || asset.thumbnail_url || ''}
                    alt={asset.media?.hero?.alt || asset.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <MapPin className="h-12 w-12" />
                  </div>
                )}
                {asset.rate_daily && (
                  <Badge className="absolute top-2 right-2">
                    ${asset.rate_daily}/night
                  </Badge>
                )}
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{asset.name}</CardTitle>
                {asset.description && (
                  <CardDescription className="line-clamp-2">
                    {asset.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-3">
                  {asset.sleeps_total && (
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      Sleeps {asset.sleeps_total}
                    </span>
                  )}
                  {asset.bedrooms && (
                    <span className="flex items-center gap-1">
                      <Bed className="h-4 w-4" />
                      {asset.bedrooms} bed
                    </span>
                  )}
                  {asset.bathrooms_full && asset.bathrooms_full > 0 && (
                    <span className="flex items-center gap-1">
                      <Bath className="h-4 w-4" />
                      {asset.bathrooms_full} bath
                    </span>
                  )}
                </div>
                {asset.overall_rating && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{asset.overall_rating.toFixed(1)}</span>
                    {asset.review_count > 0 && (
                      <span className="text-muted-foreground">
                        ({asset.review_count} reviews)
                      </span>
                    )}
                  </div>
                )}
                <Link to={`/p/${portalSlug}/reserve/${asset.id}`}>
                  <Button variant="outline" className="w-full mt-4" data-testid={`button-reserve-${asset.id}`}>
                    View Details
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
        {assets.length > 9 && (
          <div className="text-center mt-8">
            <Link to={`/p/${portalSlug}/reserve`}>
              <Button variant="outline" data-testid="button-view-all-assets">
                View All {assets.length} Options
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function ArticlesSection({ 
  title, 
  articles, 
  portalSlug 
}: { 
  title: string; 
  articles: PortalSiteData['initial_data']['articles'];
  portalSlug: string;
}) {
  if (!articles.length) return null;
  
  return (
    <section className="py-16 px-4 bg-muted/30" data-testid="section-articles">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <Card 
              key={article.id} 
              className="overflow-hidden hover-elevate"
              data-testid={`card-article-${article.id}`}
            >
              {article.featured_image_url && (
                <div className="aspect-video bg-muted">
                  <img 
                    src={article.featured_image_url}
                    alt={article.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-lg line-clamp-2">{article.title}</CardTitle>
                {article.subtitle && (
                  <CardDescription className="line-clamp-2">
                    {article.subtitle}
                  </CardDescription>
                )}
              </CardHeader>
              {article.summary && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {article.summary}
                  </p>
                  <Link to={`/p/${portalSlug}/articles/${article.slug}`}>
                    <Button variant="ghost" className="px-0 mt-2 text-primary">
                      Read More <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactSection({ 
  contact 
}: { 
  contact?: PortalSiteData['site']['contact'];
}) {
  if (!contact?.email && !contact?.telephone && !contact?.address) return null;
  
  return (
    <section className="py-16 px-4 bg-background" data-testid="section-contact">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-8">Contact Us</h2>
        <div className="space-y-4">
          {contact.telephone && (
            <a 
              href={`tel:${contact.telephone}`}
              className="flex items-center justify-center gap-2 text-lg hover:underline"
              data-testid="link-telephone"
            >
              <Phone className="h-5 w-5" />
              {contact.telephone}
            </a>
          )}
          {contact.email && (
            <a 
              href={`mailto:${contact.email}`}
              className="flex items-center justify-center gap-2 text-lg hover:underline"
              data-testid="link-email"
            >
              <Mail className="h-5 w-5" />
              {contact.email}
            </a>
          )}
          {contact.address && (
            <p className="flex items-center justify-center gap-2 text-muted-foreground">
              <MapPin className="h-5 w-5" />
              {contact.address}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function AvailabilitySection({ 
  portalSlug, 
  assets 
}: { 
  portalSlug: string;
  assets: PortalSiteData['initial_data']['assets'];
}) {
  const availableCount = assets.filter(a => a.is_available).length;
  
  return (
    <section className="py-16 px-4 bg-muted/30" data-testid="section-availability">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">Check Availability</h2>
        <p className="text-muted-foreground mb-6">
          {availableCount} of {assets.length} options currently available
        </p>
        <Link to={`/p/${portalSlug}/reserve`}>
          <Button size="lg" data-testid="button-check-availability">
            <Calendar className="mr-2 h-5 w-5" />
            Check Dates
          </Button>
        </Link>
      </div>
    </section>
  );
}

function SectionRenderer({ 
  section, 
  config, 
  assets, 
  articles, 
  portalSlug 
}: { 
  section: NonNullable<PortalSiteData['site']['sections']>[0];
  config: PortalSiteData['site'];
  assets: PortalSiteData['initial_data']['assets'];
  articles: PortalSiteData['initial_data']['articles'];
  portalSlug: string;
}) {
  switch (section.type) {
    case 'hero':
      return (
        <HeroSection
          title={config.hero?.title}
          subtitle={config.hero?.subtitle}
          imageUrl={config.hero?.image_url}
          cta={config.primary_cta}
          portalSlug={portalSlug}
          theme={config.theme}
        />
      );
    case 'assets':
      return (
        <AssetsSection
          title={section.title || 'Available'}
          assets={assets}
          portalSlug={portalSlug}
        />
      );
    case 'availability':
      return (
        <AvailabilitySection
          portalSlug={portalSlug}
          assets={assets}
        />
      );
    case 'articles':
      return (
        <ArticlesSection
          title={section.title || 'Latest News'}
          articles={articles}
          portalSlug={portalSlug}
        />
      );
    case 'contact':
      return (
        <ContactSection
          contact={config.contact}
        />
      );
    case 'gallery':
    case 'weather':
    case 'travel_info':
    case 'services':
    case 'map':
      return null;
    default:
      return null;
  }
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <Skeleton className="h-[60vh] w-full" />
      <div className="max-w-6xl mx-auto py-16 px-4">
        <Skeleton className="h-10 w-64 mx-auto mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-80 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function PortalNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Portal Not Found</h1>
        <p className="text-muted-foreground mb-8">
          The portal you're looking for doesn't exist or is not available.
        </p>
        <Link to="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    </div>
  );
}

function PortalNavbar({
  brandName,
  portalSlug,
  theme,
}: {
  brandName: string;
  portalSlug: string;
  theme?: { primary_color: string };
}) {
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link 
          to={`/p/${portalSlug}`}
          className="font-semibold text-lg"
          data-testid="link-portal-brand"
        >
          {brandName}
        </Link>
        <div className="flex items-center gap-3">
          <Link to={`/p/${portalSlug}/reserve`}>
            <Button 
              variant="outline" 
              size="sm"
              data-testid="button-reserve-nav"
            >
              Reserve
            </Button>
          </Link>
          <Link to="/app">
            <Button 
              size="sm"
              style={{ backgroundColor: theme?.primary_color }}
              data-testid="button-enter-app"
            >
              Enter App
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function PortalHomePage() {
  const params = useParams();
  const portalSlug = params.portalSlug as string;
  
  const { data, isLoading, error } = useQuery<PortalSiteData>({
    queryKey: [`/api/public/cc_portals/${portalSlug}/site`],
    enabled: !!portalSlug,
  });
  
  if (isLoading) return <LoadingSkeleton />;
  if (error || !data?.success) return <PortalNotFound />;
  
  const { portal, site: config, initial_data } = data;
  const sortedSections = (config.sections || [])
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);
  
  return (
    <div className="min-h-screen bg-background" data-testid="page-portal-home">
      <title>{config.seo?.description ? `${config.brand_name} - ${config.tagline}` : config.brand_name}</title>
      
      <PortalNavbar 
        brandName={config.brand_name || portal.name} 
        portalSlug={portalSlug} 
        theme={config.theme}
      />
      
      {sortedSections.map((section, index) => (
        <SectionRenderer
          key={`${section.type}-${index}`}
          section={section}
          config={config}
          assets={initial_data.assets}
          articles={initial_data.articles}
          portalSlug={portalSlug}
        />
      ))}
      
      <footer className="py-8 px-4 border-t bg-muted/30">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p>{portal.legal_dba_name || portal.name}</p>
          <p className="mt-2">Powered by Community Canvas</p>
        </div>
      </footer>
    </div>
  );
}
