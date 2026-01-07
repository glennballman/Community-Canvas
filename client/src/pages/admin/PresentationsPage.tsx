import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Eye, FileText } from 'lucide-react';

interface Presentation {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  entity_type: string;
  presentation_type: string;
  status: string;
  visibility: string;
  tags: string[];
  created_at: string;
  blocks: { block_type: string }[];
  portal: {
    id: string;
    name: string;
    slug: string;
  };
}

interface PortalPresentations {
  portal_slug: string;
  portal_name: string;
  presentations: Presentation[];
}

export default function PresentationsPage() {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: PortalPresentations[] }>({
    queryKey: ['/api/admin/presentations'],
  });

  if (isLoading) {
    return (
      <div style={{ padding: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>
          Entity Presentations
        </h1>
        <div style={{ color: '#9ca3af' }}>Loading presentations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>
          Entity Presentations
        </h1>
        <div style={{ color: '#ef4444' }}>Failed to load presentations</div>
      </div>
    );
  }

  const portalGroups = data?.data || [];
  const totalPresentations = portalGroups.reduce((sum, g) => sum + g.presentations.length, 0);

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
          Entity Presentations
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '14px' }}>
          Portal-owned editorial content presenting entities with unique voice and CTAs.
          {' '}Total: {totalPresentations} presentations across {portalGroups.length} portals.
        </p>
      </div>

      {portalGroups.length === 0 ? (
        <Card>
          <CardContent style={{ padding: '32px', textAlign: 'center' }}>
            <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p style={{ color: '#9ca3af' }}>No presentations found.</p>
            <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '8px' }}>
              Presentations are created by portals to editorially present entities.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {portalGroups.map((group) => (
            <Card key={group.portal_slug}>
              <CardHeader>
                <CardTitle style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {group.portal_name}
                  <Badge variant="outline" className="text-xs">
                    {group.presentations.length} presentations
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {group.presentations.map((p) => (
                    <div 
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        gap: '16px',
                      }}
                      data-testid={`presentation-row-${p.slug}`}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 500 }}>{p.title}</span>
                          <Badge variant={p.status === 'published' ? 'default' : 'secondary'} className="text-xs">
                            {p.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {p.presentation_type}
                          </Badge>
                        </div>
                        <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                          {p.blocks.length} blocks: {p.blocks.map(b => b.block_type).join(', ')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                          data-testid={`btn-view-api-${p.slug}`}
                        >
                          <a 
                            href={`/api/public/portals/${group.portal_slug}/presentations/${p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <FileText size={14} style={{ marginRight: '4px' }} />
                            API
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          data-testid={`btn-view-page-${p.slug}`}
                        >
                          <a 
                            href={`/portal/${group.portal_slug}/p/${p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Eye size={14} style={{ marginRight: '4px' }} />
                            View
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card style={{ marginTop: '24px' }}>
        <CardHeader>
          <CardTitle style={{ fontSize: '14px' }}>Public API Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#9ca3af' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>List:</strong> GET /api/public/portals/:slug/presentations
            </div>
            <div>
              <strong>Detail:</strong> GET /api/public/portals/:slug/presentations/:presentationSlug
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
