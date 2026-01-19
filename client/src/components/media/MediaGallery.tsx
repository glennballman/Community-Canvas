/**
 * MediaGallery Component
 * M-2: Display media assets with thumbnails, lightbox, and delete
 */

import { useState } from 'react';
import { Trash2, X, ZoomIn, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { cn } from '@/lib/utils';
import type { MediaAsset } from '@/lib/mediaApi';

interface MediaGalleryProps {
  assets: MediaAsset[];
  layout?: 'grid' | 'list';
  onDelete?: (id: string) => void;
  className?: string;
  emptyMessage?: string;
}

export function MediaGallery({
  assets,
  layout = 'grid',
  onDelete,
  className,
  emptyMessage = 'No media files',
}: MediaGalleryProps) {
  const [lightboxAsset, setLightboxAsset] = useState<MediaAsset | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!onDelete) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const isImage = (contentType: string) => contentType?.startsWith('image/');

  if (assets.length === 0) {
    return (
      <div
        data-testid="media-gallery-empty"
        className={cn(
          'flex flex-col items-center justify-center py-12 text-muted-foreground',
          className
        )}
      >
        <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div
        data-testid="media-gallery"
        className={cn(
          layout === 'grid'
            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4'
            : 'space-y-2',
          className
        )}
      >
        {assets.map((asset) => (
          <div
            key={asset.id}
            data-testid={`media-asset-${asset.id}`}
            className={cn(
              'group relative rounded-lg overflow-hidden bg-muted',
              layout === 'grid' ? 'aspect-square' : 'flex items-center gap-3 p-3'
            )}
          >
            {layout === 'grid' ? (
              <>
                {isImage(asset.content_type) ? (
                  <img
                    src={asset.thumbnail_url || asset.public_url}
                    alt={asset.alt_text || asset.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}

                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {isImage(asset.content_type) && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setLightboxAsset(asset)}
                      data-testid={`button-zoom-${asset.id}`}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  )}
                  
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    asChild
                  >
                    <a
                      href={asset.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-open-${asset.id}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>

                  {onDelete && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(asset.id)}
                      disabled={deletingId === asset.id}
                      data-testid={`button-delete-${asset.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {asset.role && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 text-xs bg-black/60 text-white rounded">
                    {asset.role}
                  </span>
                )}
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded bg-muted-foreground/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {isImage(asset.content_type) ? (
                    <img
                      src={asset.thumbnail_url || asset.public_url}
                      alt={asset.alt_text || asset.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{asset.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {asset.content_type}
                    {asset.role && ` • ${asset.role}`}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {isImage(asset.content_type) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setLightboxAsset(asset)}
                      data-testid={`button-zoom-${asset.id}`}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    asChild
                  >
                    <a
                      href={asset.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-open-${asset.id}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>

                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(asset.id)}
                      disabled={deletingId === asset.id}
                      data-testid={`button-delete-${asset.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!lightboxAsset} onOpenChange={() => setLightboxAsset(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>Image Preview</DialogTitle>
          </VisuallyHidden>
          {lightboxAsset && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setLightboxAsset(null)}
                data-testid="button-close-lightbox"
              >
                <X className="w-4 h-4" />
              </Button>
              <img
                src={lightboxAsset.public_url}
                alt={lightboxAsset.alt_text || lightboxAsset.filename}
                className="w-full h-auto max-h-[80vh] object-contain bg-black"
                data-testid="lightbox-image"
              />
              <div className="p-4 bg-background">
                <p className="font-medium">{lightboxAsset.filename}</p>
                {lightboxAsset.alt_text && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {lightboxAsset.alt_text}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
