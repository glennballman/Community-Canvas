/**
 * Dev Media Page
 * M-2: Verification surface for MediaUpload and MediaGallery components
 * 
 * Internal dev tool - allows testing media upload/gallery with any entity.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaUpload } from '@/components/media/MediaUpload';
import { MediaGallery } from '@/components/media/MediaGallery';
import { useEntityMedia, useDeleteEntityMedia } from '@/hooks/useEntityMedia';
import { RefreshCw, Image, Upload, AlertCircle } from 'lucide-react';
import type { MediaAsset } from '@/lib/mediaApi';

const COMMON_ENTITY_TYPES = [
  'work_request',
  'procurement_request',
  'project',
  'job',
  'job_application',
  'service_run',
  'vehicle',
  'individual',
  'test',
];

export default function DevMediaPage() {
  const [entityType, setEntityType] = useState('test');
  const [entityId, setEntityId] = useState('00000000-0000-0000-0000-000000000001');
  const [kindTag, setKindTag] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [uploadedAssets, setUploadedAssets] = useState<MediaAsset[]>([]);

  const { data: assets = [], isLoading, isError, refetch } = useEntityMedia(entityType, entityId);
  const deleteMutation = useDeleteEntityMedia(entityType, entityId);

  const handleUploaded = (newAssets: MediaAsset[]) => {
    setUploadedAssets((prev) => [...prev, ...newAssets]);
    refetch();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    setUploadedAssets((prev) => prev.filter((a) => a.id !== id));
  };

  const isValidUuid = (s: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(s);
  };

  const canTest = entityType && isValidUuid(entityId);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Dev Media Tools</h1>
          <p className="text-muted-foreground">
            Test MediaUpload and MediaGallery components with R2 storage
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
          data-testid="button-refresh"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entity Configuration</CardTitle>
          <CardDescription>
            Set the entity type and ID to test media operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entityType">Entity Type</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger data-testid="select-entity-type">
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_ENTITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entityId">Entity ID (UUID)</Label>
              <Input
                id="entityId"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000001"
                data-testid="input-entity-id"
              />
              {entityId && !isValidUuid(entityId) && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Invalid UUID format
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="kindTag">Kind Tag (optional)</Label>
              <Input
                id="kindTag"
                value={kindTag}
                onChange={(e) => setKindTag(e.target.value)}
                placeholder="e.g., before, after, issue"
                data-testid="input-kind-tag"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList>
          <TabsTrigger value="upload" data-testid="tab-upload">
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="gallery" data-testid="tab-gallery">
            <Image className="w-4 h-4 mr-2" />
            Gallery ({assets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Media</CardTitle>
              <CardDescription>
                Test the MediaUpload component with drag-and-drop and progress tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canTest ? (
                <MediaUpload
                  entityType={entityType}
                  entityId={entityId}
                  multiple
                  accept="image/*"
                  maxFiles={5}
                  kindTag={kindTag || undefined}
                  onUploaded={handleUploaded}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Please configure a valid entity type and UUID to test uploads</p>
                </div>
              )}

              {uploadedAssets.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-sm font-medium mb-3">
                    Recently Uploaded ({uploadedAssets.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {uploadedAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className="aspect-square rounded-lg overflow-hidden bg-muted"
                        data-testid={`recent-upload-${asset.id}`}
                      >
                        <img
                          src={asset.thumbnail_url || asset.public_url}
                          alt={asset.filename}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gallery" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Media Gallery</CardTitle>
                <CardDescription>
                  View and manage media for the selected entity
                </CardDescription>
              </div>
              <Select value={layout} onValueChange={(v) => setLayout(v as 'grid' | 'list')}>
                <SelectTrigger className="w-32" data-testid="select-layout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {isError ? (
                <div className="text-center py-8 text-destructive">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2" />
                  <p>Failed to load media</p>
                </div>
              ) : isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="w-10 h-10 mx-auto mb-2 animate-spin" />
                  <p>Loading media...</p>
                </div>
              ) : (
                <MediaGallery
                  assets={assets}
                  layout={layout}
                  onDelete={handleDelete}
                  emptyMessage="No media found for this entity"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>API Reference</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm font-mono">
          <p className="text-muted-foreground">POST /api/cc_media/presign</p>
          <p className="text-muted-foreground">POST /api/cc_media/:id/complete</p>
          <p className="text-muted-foreground">GET /api/cc_media/:id</p>
          <p className="text-muted-foreground">GET /api/cc_media/entity/:type/:id</p>
          <p className="text-muted-foreground">DELETE /api/cc_media/:id</p>
        </CardContent>
      </Card>
    </div>
  );
}
