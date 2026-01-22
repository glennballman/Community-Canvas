/**
 * ONB-01: Onboard Review Page
 * 
 * Review page showing workspace summary and all items.
 * Route: /onboard/w/:token/review
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  ArrowLeft, 
  User, 
  Building2,
  StickyNote,
  Camera,
  Clock,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';

interface Workspace {
  id: string;
  token: string;
  status: string;
  displayName: string | null;
  companyName: string | null;
  modeHints: { intent?: string };
  expiresAt: string;
  lastAccessedAt: string;
}

interface OnboardingItem {
  id: string;
  itemType: string;
  payload: any;
  createdAt: string;
}

const INTENT_LABELS: Record<string, string> = {
  provide: 'Provide services',
  need: 'Need services',
  both: 'Both provide and need',
  unsure: 'Not sure yet'
};

export default function OnboardReviewPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [items, setItems] = useState<OnboardingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkspace();
  }, [token]);

  const loadWorkspace = async () => {
    try {
      const res = await fetch(`/api/public/onboard/workspaces/${token}`);
      const data = await res.json();
      
      if (res.status === 410) {
        setError('This workspace has expired.');
        setLoading(false);
        return;
      }
      
      if (!data.ok) {
        setError(data.error || 'Workspace not found');
        setLoading(false);
        return;
      }
      
      setWorkspace(data.workspace);
      setItems(data.items || []);
      setLoading(false);
    } catch (err) {
      setError('Failed to load workspace');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="loader-review">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="error-review">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => navigate('/onboard')} data-testid="button-start-new">
              Start New Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const noteItems = items.filter(i => i.itemType === 'typed_note');
  const mediaItems = items.filter(i => i.itemType === 'media');

  return (
    <div className="min-h-screen bg-background p-4" data-testid="page-review">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Back Button */}
        <Link to={`/onboard/w/${token}`}>
          <Button variant="ghost" size="sm" className="gap-1" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl" data-testid="heading-review">Review Your Workspace</CardTitle>
            <CardDescription className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" />
              Expires {workspace?.expiresAt ? format(new Date(workspace.expiresAt), 'MMM d, yyyy') : 'soon'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Identity */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">
                  {workspace?.displayName || <span className="text-muted-foreground">Name not set</span>}
                </p>
                {workspace?.companyName && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {workspace.companyName}
                  </p>
                )}
              </div>
            </div>

            {/* Intent */}
            {workspace?.modeHints?.intent && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {INTENT_LABELS[workspace.modeHints.intent] || workspace.modeHints.intent}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes Section */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StickyNote className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Notes</CardTitle>
              </div>
              <Badge variant="outline">{noteItems.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {noteItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes added yet.</p>
            ) : (
              <div className="space-y-2">
                {noteItems.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border" data-testid={`note-${item.id}`}>
                    <p className="text-sm whitespace-pre-wrap">{item.payload?.text}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(item.createdAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Media Section */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Photos</CardTitle>
              </div>
              <Badge variant="outline">{mediaItems.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {mediaItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No photos added yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {mediaItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="aspect-square bg-muted rounded-lg flex items-center justify-center"
                    data-testid={`media-${item.id}`}
                  >
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Keep Going Button */}
        <Link to={`/onboard/w/${token}`}>
          <Button className="w-full" size="lg" data-testid="button-keep-going">
            Keep going
          </Button>
        </Link>
      </div>
    </div>
  );
}
