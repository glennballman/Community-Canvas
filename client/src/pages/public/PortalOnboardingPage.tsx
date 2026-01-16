/**
 * PORTAL ONBOARDING PAGE
 * 
 * Route: /p/:portalSlug/onboarding
 * 
 * Portal-scoped onboarding for new users.
 * Uses portal context for branding/theme.
 */

import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, Loader2, User, Mail, Phone } from "lucide-react";

interface PortalSiteData {
  success: boolean;
  portal: {
    id: string;
    slug: string;
    name: string;
    legal_dba_name: string | null;
    portal_type: string;
  };
  site: {
    brand_name: string;
    tagline: string;
    theme?: {
      primary_color: string;
    };
    contact?: {
      email?: string;
      telephone?: string;
    };
  };
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PortalNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Portal Not Found</h1>
        <p className="text-muted-foreground mb-8">
          The portal you're looking for doesn't exist or is not available.
        </p>
        <Link to="/">
          <Button data-testid="button-go-home">Go Home</Button>
        </Link>
      </div>
    </div>
  );
}

export default function PortalOnboardingPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const portalSlug = params.portalSlug as string;
  
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const { data, isLoading, error } = useQuery<PortalSiteData>({
    queryKey: [`/api/public/cc_portals/${portalSlug}/site`],
    enabled: !!portalSlug,
  });

  if (isLoading) return <LoadingSkeleton />;
  if (error || !data?.success) return <PortalNotFound />;

  const { portal, site } = data;
  const primaryColor = site.theme?.primary_color || '#3b82f6';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({
        title: "Required fields",
        description: "Please enter your name and email.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setStep('success');
    } catch (err) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === 'success') {
    return (
      <div 
        className="min-h-screen bg-background flex items-center justify-center p-4"
        data-testid="page-onboarding-success"
      >
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div 
              className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <Check className="h-8 w-8" style={{ color: primaryColor }} />
            </div>
            <CardTitle className="text-2xl">Welcome!</CardTitle>
            <CardDescription>
              You're all set to explore {site.brand_name || portal.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/app" className="block">
              <Button 
                className="w-full" 
                size="lg"
                style={{ backgroundColor: primaryColor }}
                data-testid="button-enter-app"
              >
                Enter App
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            
            <Link to={`/p/${portalSlug}/reserve`} className="block">
              <Button 
                variant="outline" 
                className="w-full"
                data-testid="button-make-reservation"
              >
                Make a Reservation
              </Button>
            </Link>

            {site.contact?.email && (
              <div className="text-center pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Questions? Contact us at{' '}
                  <a 
                    href={`mailto:${site.contact.email}`}
                    className="text-primary underline"
                    data-testid="link-contact-email"
                  >
                    {site.contact.email}
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-background flex items-center justify-center p-4"
      data-testid="page-onboarding"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link 
            to={`/p/${portalSlug}`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
            data-testid="link-back-to-portal"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to {site.brand_name || portal.name}
          </Link>
          <CardTitle className="text-2xl">Get Started</CardTitle>
          <CardDescription>
            Create your account to access {site.brand_name || portal.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Your full name"
                  className="pl-9"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  data-testid="input-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="pl-9"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  data-testid="input-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  className="pl-9"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  data-testid="input-phone"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={isSubmitting}
              style={{ backgroundColor: primaryColor }}
              data-testid="button-submit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="text-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link 
                  to="/app"
                  className="text-primary underline"
                  data-testid="link-sign-in"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
