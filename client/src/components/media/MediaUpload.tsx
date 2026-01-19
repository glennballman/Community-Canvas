/**
 * MediaUpload Component
 * M-2: Reusable media upload with drag-drop, progress, and R2 integration
 */

import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileImage, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { uploadFileToR2, type MediaAsset } from '@/lib/mediaApi';

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
  asset?: MediaAsset;
}

interface MediaUploadProps {
  entityType: string;
  entityId: string;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  maxSizeMB?: number;
  kindTag?: string;
  onUploaded?: (assets: MediaAsset[]) => void;
  className?: string;
}

export function MediaUpload({
  entityType,
  entityId,
  multiple = false,
  accept = 'image/*',
  maxFiles = 10,
  maxSizeMB = 10,
  kindTag,
  onUploaded,
  className,
}: MediaUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files).slice(0, multiple ? maxFiles : 1);
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    const newUploads: UploadingFile[] = fileArray.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      status: file.size > maxSizeBytes ? 'error' : 'uploading',
      error: file.size > maxSizeBytes ? `File exceeds ${maxSizeMB}MB limit` : undefined,
    }));

    setUploadingFiles((prev) => [...prev, ...newUploads]);

    const completedAssets: MediaAsset[] = [];

    for (const upload of newUploads) {
      if (upload.status === 'error') continue;

      try {
        const asset = await uploadFileToR2(upload.file, {
          entityType,
          entityId,
          role: kindTag,
          onProgress: (progress) => {
            setUploadingFiles((prev) =>
              prev.map((u) =>
                u.id === upload.id ? { ...u, progress } : u
              )
            );
          },
        });

        setUploadingFiles((prev) =>
          prev.map((u) =>
            u.id === upload.id
              ? { ...u, status: 'complete', progress: 100, asset }
              : u
          )
        );

        completedAssets.push(asset);
      } catch (error: any) {
        setUploadingFiles((prev) =>
          prev.map((u) =>
            u.id === upload.id
              ? { ...u, status: 'error', error: error.message || 'Upload failed' }
              : u
          )
        );
      }
    }

    if (completedAssets.length > 0 && onUploaded) {
      onUploaded(completedAssets);
    }
  }, [entityType, entityId, kindTag, maxFiles, maxSizeMB, multiple, onUploaded]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeUpload = (id: string) => {
    setUploadingFiles((prev) => prev.filter((u) => u.id !== id));
  };

  const clearCompleted = () => {
    setUploadingFiles((prev) => prev.filter((u) => u.status !== 'complete'));
  };

  const hasCompletedUploads = uploadingFiles.some((u) => u.status === 'complete');

  return (
    <div className={cn('space-y-4', className)}>
      <div
        data-testid="media-upload-dropzone"
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover-elevate'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          data-testid="media-upload-input"
        />
        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragOver ? (
            'Drop files here'
          ) : (
            <>
              Drag and drop {multiple ? 'files' : 'a file'} here, or{' '}
              <span className="text-primary underline">browse</span>
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Max {maxSizeMB}MB per file
          {kindTag && ` • Tagged as "${kindTag}"`}
        </p>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Uploads ({uploadingFiles.filter((u) => u.status === 'complete').length}/
              {uploadingFiles.length})
            </span>
            {hasCompletedUploads && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCompleted}
                data-testid="button-clear-completed"
              >
                Clear completed
              </Button>
            )}
          </div>

          {uploadingFiles.map((upload) => (
            <div
              key={upload.id}
              data-testid={`upload-item-${upload.id}`}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
            >
              <FileImage className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{upload.file.name}</p>
                
                {upload.status === 'uploading' && (
                  <Progress value={upload.progress} className="h-1 mt-1" />
                )}
                
                {upload.status === 'error' && (
                  <p className="text-xs text-destructive mt-0.5">{upload.error}</p>
                )}
              </div>

              <div className="flex-shrink-0">
                {upload.status === 'uploading' && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
                {upload.status === 'complete' && (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
                {upload.status === 'error' && (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => removeUpload(upload.id)}
                data-testid={`button-remove-upload-${upload.id}`}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
