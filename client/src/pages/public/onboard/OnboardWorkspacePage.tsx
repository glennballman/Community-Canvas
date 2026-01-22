/**
 * ONB-01: Onboard Workspace Page
 * 
 * Main workspace page for adding items and managing setup.
 * Route: /onboard/w/:token
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Copy, 
  Check, 
  User, 
  StickyNote, 
  Camera, 
  ClipboardList,
  Clock,
  X,
  ImageIcon,
  Upload,
  AlertCircle
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

export default function OnboardWorkspacePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [items, setItems] = useState<OnboardingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [savingName, setSavingName] = useState(false);
  
  const [addingNote, setAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  
  // Photo upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
      setDisplayName(data.workspace.displayName || '');
      setCompanyName(data.workspace.companyName || '');
      setLoading(false);
    } catch (err) {
      setError('Failed to load workspace');
      setLoading(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveName = async () => {
    setSavingName(true);
    try {
      const res = await fetch(`/api/public/onboard/workspaces/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, companyName })
      });
      const data = await res.json();
      if (data.ok) {
        setWorkspace(data.workspace);
        setEditingName(false);
      }
    } catch (err) {
      console.error('Failed to save name:', err);
    }
    setSavingName(false);
  };

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/public/onboard/workspaces/${token}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          itemType: 'typed_note', 
          payload: { text: noteText.trim() } 
        })
      });
      const data = await res.json();
      if (data.ok) {
        setItems([data.item, ...items]);
        setNoteText('');
        setAddingNote(false);
      }
    } catch (err) {
      console.error('Failed to save note:', err);
    }
    setSavingNote(false);
  };

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingPhotos(true);
    setUploadError(null);
    setUploadProgress({ current: 0, total: files.length });
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length });
        
        // Validate file type
        if (!allowedTypes.includes(file.type)) {
          setUploadError(`${file.name}: Only JPEG, PNG, WebP, and HEIC images are allowed`);
          continue;
        }
        
        // Validate file size (25MB)
        if (file.size > 25 * 1024 * 1024) {
          setUploadError(`${file.name}: File too large (max 25MB)`);
          continue;
        }
        
        // Step 1: Get presigned upload URL
        const urlRes = await fetch(`/api/public/onboard/workspaces/${token}/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, mimeType: file.type })
        });
        
        if (urlRes.status === 429) {
          setUploadError('Upload limit reached. Please wait a few minutes.');
          break;
        }
        
        if (urlRes.status === 503) {
          setUploadError('Photo uploads are temporarily unavailable.');
          break;
        }
        
        const urlData = await urlRes.json();
        if (!urlData.ok) {
          setUploadError(urlData.error || 'Failed to get upload URL');
          continue;
        }
        
        // Step 2: Upload to R2 using presigned URL
        const uploadRes = await fetch(urlData.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type }
        });
        
        if (!uploadRes.ok) {
          setUploadError(`Failed to upload ${file.name}`);
          continue;
        }
        
        // Step 3: Complete upload to create records
        const completeRes = await fetch(`/api/public/onboard/workspaces/${token}/complete-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storageKey: urlData.storageKey,
            mimeType: file.type,
            fileSize: file.size
          })
        });
        
        const completeData = await completeRes.json();
        if (completeData.ok) {
          setItems(prev => [completeData.item, ...prev]);
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError('Upload failed. Please try again.');
    }
    
    setUploadingPhotos(false);
    setUploadProgress(null);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [token]);

  // Get media items for display
  const mediaItems = items.filter(item => item.itemType === 'media');
  const noteItems = items.filter(item => item.itemType === 'typed_note');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="loader-workspace">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="error-workspace">
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

  return (
    <div className="min-h-screen bg-background p-4" data-testid="page-workspace">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-xl" data-testid="heading-workspace">
                {workspace?.displayName || 'Your Workspace'}
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyLink}
                className="gap-1"
                data-testid="button-copy-link"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy link'}
              </Button>
            </div>
            <CardDescription className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" />
              Expires {workspace?.expiresAt ? format(new Date(workspace.expiresAt), 'MMM d, yyyy') : 'soon'}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Name Card */}
        <Card data-testid="card-name">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">What should we call you?</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {editingName ? (
              <div className="space-y-3">
                <Input
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  data-testid="input-display-name"
                />
                <Input
                  placeholder="Company name (optional)"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  data-testid="input-company-name"
                />
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={saveName} 
                    disabled={savingName}
                    data-testid="button-save-name"
                  >
                    {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setEditingName(false)}
                    data-testid="button-cancel-name"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                {workspace?.displayName ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{workspace.displayName}</p>
                      {workspace.companyName && (
                        <p className="text-sm text-muted-foreground">{workspace.companyName}</p>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setEditingName(true)}
                      data-testid="button-edit-name"
                    >
                      Edit
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-muted-foreground"
                    onClick={() => setEditingName(true)}
                    data-testid="button-add-name"
                  >
                    + Add your name
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Note Card */}
        <Card data-testid="card-note">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Add a note</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {addingNote ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Type anything..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="min-h-[100px]"
                  data-testid="input-note-text"
                />
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={saveNote} 
                    disabled={savingNote || !noteText.trim()}
                    data-testid="button-save-note"
                  >
                    {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => { setAddingNote(false); setNoteText(''); }}
                    data-testid="button-cancel-note"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                variant="outline" 
                className="w-full justify-start text-muted-foreground"
                onClick={() => setAddingNote(true)}
                data-testid="button-add-note"
              >
                + Write something...
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Photos Card */}
        <Card data-testid="card-photos">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Add photos</CardTitle>
              {mediaItems.length > 0 && (
                <Badge variant="secondary" className="text-xs">{mediaItems.length}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              onChange={handlePhotoSelect}
              className="hidden"
              data-testid="input-photo-file"
            />
            
            {/* Upload error */}
            {uploadError && (
              <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 text-destructive text-sm" data-testid="upload-error">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{uploadError}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 ml-auto"
                  onClick={() => setUploadError(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            {/* Upload progress */}
            {uploadingPhotos && uploadProgress && (
              <div className="flex items-center gap-2 p-2 rounded bg-muted text-sm" data-testid="upload-progress">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading {uploadProgress.current} of {uploadProgress.total}...</span>
              </div>
            )}
            
            {/* Photo thumbnails */}
            {mediaItems.length > 0 && (
              <div className="grid grid-cols-3 gap-2" data-testid="photo-grid">
                {mediaItems.slice(0, 6).map((item) => (
                  <div 
                    key={item.id} 
                    className="aspect-square rounded overflow-hidden bg-muted"
                    data-testid={`photo-thumb-${item.id}`}
                  >
                    {item.payload?.publicUrl ? (
                      <img 
                        src={item.payload.publicUrl} 
                        alt="Uploaded photo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {mediaItems.length > 6 && (
                  <div className="aspect-square rounded bg-muted flex items-center justify-center text-sm text-muted-foreground">
                    +{mediaItems.length - 6}
                  </div>
                )}
              </div>
            )}
            
            {/* Upload button */}
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhotos}
              data-testid="button-add-photos"
            >
              {uploadingPhotos ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {mediaItems.length > 0 ? 'Add more photos' : 'Choose photos'}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Items (notes only - photos shown in grid above) */}
        {noteItems.length > 0 && (
          <Card data-testid="card-recent-items">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {noteItems.slice(0, 3).map((item) => (
                <div key={item.id} className="p-2 rounded bg-muted/50 text-sm" data-testid={`item-${item.id}`}>
                  <p className="line-clamp-2">{item.payload?.text || 'Note'}</p>
                </div>
              ))}
              {noteItems.length > 3 && (
                <p className="text-xs text-muted-foreground">+{noteItems.length - 3} more</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Review Button */}
        <Link to={`/onboard/w/${token}/review`}>
          <Button className="w-full gap-2" size="lg" data-testid="button-review">
            <ClipboardList className="h-5 w-5" />
            Review
          </Button>
        </Link>
      </div>
    </div>
  );
}
