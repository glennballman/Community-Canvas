import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Eye, FileText, Image, Lock, MapPin, Wrench, Package, Clock, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

interface DisclosedItem {
  item_type: string;
  item_id: string | null;
  work_area_title?: string;
  work_area_description?: string;
  work_area_tags?: string[];
  work_media_title?: string;
  work_media_notes?: string;
  work_media_tags?: string[];
  work_media_url?: string;
  access_constraints?: string;
  subsystem_title?: string;
  subsystem_description?: string;
  subsystem_tags?: string[];
  resource_name?: string;
  resource_description?: string;
  resource_type?: string;
  storage_location?: string;
  share_policy?: string;
}

interface PreviewResponse {
  ok: boolean;
  disclosedItems: Record<string, DisclosedItem[]>;
  previewFor?: {
    contractorPersonId: string;
    workRequestId: string;
  };
  error?: string;
}

export default function ContractorWorkRequestPreview() {
  const { workRequestId } = useParams<{ workRequestId: string }>();
  const [searchParams] = useSearchParams();
  const previewToken = searchParams.get('previewToken');

  const { data, isLoading, error } = useQuery<PreviewResponse>({
    queryKey: ['/api/p2/app/work-disclosures/contractor', workRequestId, previewToken],
    queryFn: async () => {
      if (!previewToken) {
        return { ok: false, disclosedItems: {}, error: 'No preview token provided' };
      }
      
      const res = await fetch(
        `/api/p2/app/work-disclosures/contractor/${workRequestId}?previewToken=${encodeURIComponent(previewToken)}`
      );
      
      return res.json();
    },
    enabled: !!workRequestId && !!previewToken,
    retry: false,
  });

  if (!previewToken) {
    return (
      <div className="flex-1 p-8" data-testid="page-contractor-preview-no-token">
        <Alert variant="destructive" data-testid="alert-no-token">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle data-testid="text-alert-title">Access Denied</AlertTitle>
          <AlertDescription data-testid="text-alert-description">
            No preview token provided. This page requires a valid preview token.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-8 text-center text-muted-foreground" data-testid="page-contractor-preview-loading">
        Loading contractor preview...
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="flex-1 p-8" data-testid="page-contractor-preview-error">
        <Alert variant="destructive" data-testid="alert-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle data-testid="text-error-title">Preview Error</AlertTitle>
          <AlertDescription data-testid="text-error-description">
            {data?.error || 'Failed to load contractor preview. The token may be expired, already used, or invalid.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const disclosedItems = data.disclosedItems || {};
  const workAreas = disclosedItems['work_area'] || [];
  const workMedia = disclosedItems['work_media'] || [];
  const accessConstraints = disclosedItems['access_constraints'] || [];
  const subsystems = disclosedItems['subsystem'] || [];
  const onSiteResources = disclosedItems['on_site_resource'] || [];

  const hasAnyContent = workAreas.length > 0 || workMedia.length > 0 || 
    accessConstraints.length > 0 || subsystems.length > 0 || onSiteResources.length > 0;

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto space-y-6" data-testid="page-contractor-preview">
      <Alert className="bg-amber-500/10 border-amber-500/30" data-testid="alert-preview-banner">
        <Eye className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-600 dark:text-amber-400" data-testid="text-banner-title">
          Preview Mode (Single-Use Token)
        </AlertTitle>
        <AlertDescription className="text-amber-600/80 dark:text-amber-400/80" data-testid="text-banner-description">
          You are viewing exactly what this contractor would see for Work Request {workRequestId?.slice(0, 8).toUpperCase()}.
          This preview token is single-use and expires in 15 minutes.
          <div className="mt-1 text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Token consumed - page will not reload with new data.
          </div>
        </AlertDescription>
      </Alert>

      <div className="flex items-center gap-3 flex-wrap">
        <Lock className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-bold" data-testid="text-preview-title">
          Contractor View - Work Request
        </h1>
        <Badge variant="secondary" data-testid="badge-work-request-id">
          WR-{workRequestId?.slice(0, 8).toUpperCase()}
        </Badge>
      </div>

      {!hasAnyContent ? (
        <Card data-testid="card-no-content">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p data-testid="text-no-content">No items have been disclosed to this contractor yet.</p>
            <p className="text-sm mt-1">Use "Manage Access" to share work catalog items.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" data-testid="container-disclosed-items">
          {accessConstraints.length > 0 && (
            <Card data-testid="card-access-constraints">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Access Constraints
                </CardTitle>
              </CardHeader>
              <CardContent>
                {accessConstraints.map((item, idx) => (
                  <div key={idx} className="text-sm whitespace-pre-wrap" data-testid={`text-access-constraint-${idx}`}>
                    {item.access_constraints || 'No specific constraints listed.'}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {workAreas.length > 0 && (
            <Card data-testid="card-work-areas">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span data-testid="text-work-areas-count">Work Areas ({workAreas.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {workAreas.map((area, idx) => (
                  <div key={idx} className="p-3 bg-muted/50 rounded-md" data-testid={`item-work-area-${idx}`}>
                    <div className="font-medium text-sm" data-testid={`text-work-area-title-${idx}`}>
                      {area.work_area_title || 'Untitled Area'}
                    </div>
                    {area.work_area_description && (
                      <p className="text-sm text-muted-foreground mt-1" data-testid={`text-work-area-desc-${idx}`}>
                        {area.work_area_description}
                      </p>
                    )}
                    {area.work_area_tags && area.work_area_tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {area.work_area_tags.map((tag, ti) => (
                          <Badge key={ti} variant="outline" className="text-xs" data-testid={`badge-work-area-tag-${idx}-${ti}`}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {workMedia.length > 0 && (
            <Card data-testid="card-work-media">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  <span data-testid="text-work-media-count">Work Media ({workMedia.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {workMedia.map((media, idx) => (
                  <div key={idx} className="p-3 bg-muted/50 rounded-md" data-testid={`item-work-media-${idx}`}>
                    <div className="font-medium text-sm" data-testid={`text-work-media-title-${idx}`}>
                      {media.work_media_title || 'Untitled Media'}
                    </div>
                    {media.work_media_notes && (
                      <p className="text-sm text-muted-foreground mt-1" data-testid={`text-work-media-notes-${idx}`}>
                        {media.work_media_notes}
                      </p>
                    )}
                    {media.work_media_url && (
                      <a 
                        href={media.work_media_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm hover:underline mt-1 flex items-center gap-1"
                        data-testid={`link-work-media-${idx}`}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Media
                      </a>
                    )}
                    {media.work_media_tags && media.work_media_tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {media.work_media_tags.map((tag, ti) => (
                          <Badge key={ti} variant="outline" className="text-xs" data-testid={`badge-work-media-tag-${idx}-${ti}`}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {subsystems.length > 0 && (
            <Card data-testid="card-subsystems">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  <span data-testid="text-subsystems-count">Property Subsystems ({subsystems.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {subsystems.map((sub, idx) => (
                  <div key={idx} className="p-3 bg-muted/50 rounded-md" data-testid={`item-subsystem-${idx}`}>
                    <div className="font-medium text-sm" data-testid={`text-subsystem-title-${idx}`}>
                      {sub.subsystem_title || 'Untitled Subsystem'}
                    </div>
                    {sub.subsystem_description && (
                      <p className="text-sm text-muted-foreground mt-1" data-testid={`text-subsystem-desc-${idx}`}>
                        {sub.subsystem_description}
                      </p>
                    )}
                    {sub.subsystem_tags && sub.subsystem_tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {sub.subsystem_tags.map((tag, ti) => (
                          <Badge key={ti} variant="outline" className="text-xs" data-testid={`badge-subsystem-tag-${idx}-${ti}`}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {onSiteResources.length > 0 && (
            <Card data-testid="card-on-site-resources">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span data-testid="text-resources-count">On-Site Resources ({onSiteResources.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {onSiteResources.map((res, idx) => (
                  <div key={idx} className="p-3 bg-muted/50 rounded-md" data-testid={`item-resource-${idx}`}>
                    <div className="font-medium text-sm" data-testid={`text-resource-name-${idx}`}>
                      {res.resource_name || 'Untitled Resource'}
                    </div>
                    {res.resource_description && (
                      <p className="text-sm text-muted-foreground mt-1" data-testid={`text-resource-desc-${idx}`}>
                        {res.resource_description}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2 flex-wrap text-xs text-muted-foreground">
                      {res.resource_type && <span data-testid={`text-resource-type-${idx}`}>Type: {res.resource_type}</span>}
                      {res.storage_location && <span data-testid={`text-resource-location-${idx}`}>Location: {res.storage_location}</span>}
                      {res.share_policy && <span data-testid={`text-resource-policy-${idx}`}>Policy: {res.share_policy}</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Separator />
      
      <div className="text-center text-sm text-muted-foreground py-4" data-testid="text-read-only-notice">
        This is a read-only preview. Contractors cannot modify any content.
      </div>
    </div>
  );
}
