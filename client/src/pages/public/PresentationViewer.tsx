import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Calendar, Info } from 'lucide-react';

interface Block {
  id: string;
  block_type: string;
  block_data: Record<string, unknown>;
  block_order: number;
}

interface Presentation {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  entity_type: string;
  presentation_type: string;
  tags: string[];
  seasonality: { best_months?: number[]; offpeak?: boolean } | null;
  cta: { primary?: { type: string; label: string } } | null;
  blocks: Block[];
  portal: { id: string; name: string; slug: string };
}

function HeroBlock({ data }: { data: Record<string, unknown> }) {
  return (
    <div 
      style={{
        padding: '48px 24px',
        background: 'linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(59,130,246,0.2) 100%)',
        borderRadius: '12px',
        textAlign: 'center',
        marginBottom: '24px',
      }}
      data-testid="block-hero"
    >
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
        {String(data.headline || '')}
      </h1>
      {typeof data.subhead === 'string' && data.subhead && (
        <p style={{ fontSize: '18px', color: '#9ca3af' }}>{data.subhead}</p>
      )}
    </div>
  );
}

function StoryBlock({ data }: { data: Record<string, unknown> }) {
  const paragraphs = data.paragraphs as string[] || [];
  return (
    <div style={{ marginBottom: '24px' }} data-testid="block-story">
      {paragraphs.map((p, i) => (
        <p key={i} style={{ marginBottom: '16px', lineHeight: 1.7, color: '#d1d5db' }}>
          {String(p)}
        </p>
      ))}
    </div>
  );
}

function FactsBlock({ data }: { data: Record<string, unknown> }) {
  const items = data.items as Array<{ label: string; value: string }> || [];
  return (
    <Card style={{ marginBottom: '24px' }} data-testid="block-facts">
      <CardContent style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Info size={16} />
          <span style={{ fontWeight: 500, fontSize: '14px' }}>Quick Facts</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: '#9ca3af' }}>{item.label}</span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MapBlock({ data }: { data: Record<string, unknown> }) {
  const center = data.center as { lat: number; lng: number } | undefined;
  const pins = data.pins as Array<{ label: string; type: string }> || [];
  return (
    <Card style={{ marginBottom: '24px' }} data-testid="block-map">
      <CardContent style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <MapPin size={16} />
          <span style={{ fontWeight: 500, fontSize: '14px' }}>Location</span>
        </div>
        <div style={{ 
          height: '150px', 
          backgroundColor: 'rgba(255,255,255,0.05)', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          fontSize: '13px',
        }}>
          {center ? `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}` : 'Map placeholder'}
          {pins.length > 0 && ` - ${pins.map(p => p.label).join(', ')}`}
        </div>
      </CardContent>
    </Card>
  );
}

function ListBlock({ data }: { data: Record<string, unknown> }) {
  const items = data.items as string[] || [];
  const title = data.title as string | undefined;
  return (
    <Card style={{ marginBottom: '24px' }} data-testid="block-list">
      <CardContent style={{ padding: '16px' }}>
        {title && (
          <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '12px' }}>{title}</div>
        )}
        <ul style={{ paddingLeft: '20px', margin: 0 }}>
          {items.map((item, i) => (
            <li key={i} style={{ marginBottom: '8px', fontSize: '14px', color: '#d1d5db' }}>
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CTABlock({ data }: { data: Record<string, unknown> }) {
  return (
    <div 
      style={{ 
        padding: '24px', 
        backgroundColor: 'rgba(168,85,247,0.15)', 
        borderRadius: '12px',
        textAlign: 'center',
        marginBottom: '24px',
      }}
      data-testid="block-cta"
    >
      {typeof data.description === 'string' && data.description && (
        <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '12px' }}>
          {data.description}
        </p>
      )}
      <Button size="lg">
        {String(data.label || 'Learn More')}
      </Button>
    </div>
  );
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.block_type) {
    case 'hero':
      return <HeroBlock data={block.block_data} />;
    case 'story':
      return <StoryBlock data={block.block_data} />;
    case 'facts':
      return <FactsBlock data={block.block_data} />;
    case 'map':
      return <MapBlock data={block.block_data} />;
    case 'list':
      return <ListBlock data={block.block_data} />;
    case 'cta':
      return <CTABlock data={block.block_data} />;
    default:
      return (
        <Card style={{ marginBottom: '24px' }}>
          <CardContent style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Unknown block type: {block.block_type}
            </div>
            <pre style={{ fontSize: '11px', marginTop: '8px', overflow: 'auto' }}>
              {JSON.stringify(block.block_data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      );
  }
}

export default function PresentationViewer() {
  const { portalSlug, presentationSlug } = useParams<{ portalSlug: string; presentationSlug: string }>();

  const { data, isLoading, error } = useQuery<{ success: boolean; presentation: Presentation }>({
    queryKey: ['/api/public/cc_portals', portalSlug, 'presentations', presentationSlug],
    queryFn: async () => {
      const res = await fetch(`/api/public/cc_portals/${portalSlug}/presentations/${presentationSlug}`);
      if (!res.ok) throw new Error('Failed to fetch presentation');
      return res.json();
    },
    enabled: !!portalSlug && !!presentationSlug,
  });

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#060b15', 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(168, 85, 247, 0.3)',
            borderTopColor: '#a855f7',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#9ca3af' }}>Loading presentation...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !data?.presentation) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#060b15', 
        color: 'white',
        padding: '32px',
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', paddingTop: '100px' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Presentation Not Found</h1>
          <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
            The presentation you're looking for doesn't exist or is not published.
          </p>
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft size={16} style={{ marginRight: '8px' }} />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const presentation = data.presentation;

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#060b15', 
      color: 'white',
    }}>
      <div style={{ 
        maxWidth: '700px', 
        margin: '0 auto', 
        padding: '32px 16px',
      }}>
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to={`/portal/${portalSlug}`}>
            <Button size="sm" variant="ghost">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#9ca3af', fontSize: '14px' }}>{presentation.portal.name}</span>
            <Badge variant="outline" className="text-xs">{presentation.presentation_type}</Badge>
          </div>
        </div>

        {presentation.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {presentation.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {presentation.blocks.map((block) => (
          <BlockRenderer key={block.id} block={block} />
        ))}

        {presentation.seasonality?.best_months && (
          <Card style={{ marginBottom: '24px' }}>
            <CardContent style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Calendar size={16} />
                <span style={{ fontWeight: 500, fontSize: '14px' }}>Best Time to Visit</span>
              </div>
              <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                {presentation.seasonality.best_months.map(m => {
                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  return months[m - 1];
                }).join(', ')}
                {presentation.seasonality.offpeak && ' (off-peak)'}
              </div>
            </CardContent>
          </Card>
        )}

        <div style={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          paddingTop: '24px', 
          marginTop: '24px',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '13px',
        }}>
          Published by {presentation.portal.name}
        </div>
      </div>
    </div>
  );
}
