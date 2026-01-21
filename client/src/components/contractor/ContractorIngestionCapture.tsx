/**
 * ContractorIngestionCapture - Shared capture component for A2
 * 
 * Supports:
 * - Camera capture
 * - File picker fallback
 * - Multi-image selection for tools
 * - Upload progress
 * - Navigation on success
 */

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  X, 
  Upload,
  ImagePlus,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTenant } from '@/contexts/TenantContext';
import { usePortal } from '@/contexts/PortalContext';

interface ContractorIngestionCaptureProps {
  sourceType: 'vehicle_photo' | 'tool_photo' | 'sticky_note';
  title: string;
  helperText: string;
  onCreatedNavigateTo?: string;
  allowMultiple?: boolean;
}

export default function ContractorIngestionCapture({
  sourceType,
  title,
  helperText,
  onCreatedNavigateTo,
  allowMultiple = false,
}: ContractorIngestionCaptureProps) {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { currentPortal } = usePortal();
  
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Create ingestion mutation
  const createIngestionMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      formData.append('source_type', sourceType);
      files.forEach(file => formData.append('media', file));
      
      // Build headers with tenant/portal context
      const headers: Record<string, string> = {};
      if (currentPortal?.id) {
        headers['x-portal-id'] = currentPortal.id;
      }
      if (currentTenant?.tenant_id) {
        headers['x-tenant-id'] = currentTenant.tenant_id;
      }
      
      const res = await fetch('/api/contractor/ingestions', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers,
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Upload failed');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      if (data.ok && data.ingestion) {
        const targetPath = onCreatedNavigateTo || `/app/contractor/onboard/ingestions/${data.ingestion.id}`;
        navigate(targetPath);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Open camera
  const openCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraOpen(true);
    } catch (err) {
      console.error('Camera access denied, falling back to file picker:', err);
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  }, []);

  // Close camera
  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  // Capture photo from camera
  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            if (allowMultiple) {
              setSelectedFiles(prev => [...prev, file]);
              setPreviews(prev => [...prev, URL.createObjectURL(blob)]);
            } else {
              setSelectedFiles([file]);
              setPreviews([URL.createObjectURL(blob)]);
            }
          }
          closeCamera();
        }, 'image/jpeg', 0.9);
      }
    }
  }, [allowMultiple, closeCamera]);

  // Handle file input
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      if (allowMultiple) {
        setSelectedFiles(prev => [...prev, ...files]);
        setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
      } else {
        setSelectedFiles([files[0]]);
        setPreviews([URL.createObjectURL(files[0])]);
      }
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [allowMultiple]);

  // Remove a selected file
  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      const newPreviews = prev.filter((_, i) => i !== index);
      // Revoke the URL to free memory
      URL.revokeObjectURL(prev[index]);
      return newPreviews;
    });
  }, []);

  // Submit files
  const handleSubmit = useCallback(() => {
    if (selectedFiles.length === 0) {
      setError('Please capture or select at least one photo');
      return;
    }
    setError(null);
    createIngestionMutation.mutate(selectedFiles);
  }, [selectedFiles, createIngestionMutation]);

  // Go back
  const handleBack = useCallback(() => {
    navigate('/app/contractor/onboard');
  }, [navigate]);

  // Camera view
  if (cameraOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <canvas ref={canvasRef} className="hidden" />
        
        <div className="absolute top-4 right-4 z-10">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={closeCamera}
            className="bg-black/50 border-white/30 text-white"
            data-testid="button-close-camera"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
        
        <video 
          ref={videoRef}
          autoPlay 
          playsInline
          className="flex-1 object-cover"
        />
        
        <div className="p-6 flex justify-center">
          <button 
            onClick={capturePhoto}
            className="w-20 h-20 rounded-full bg-white flex items-center justify-center hover-elevate active-elevate-2"
            data-testid="button-capture-photo"
          >
            <Camera className="h-8 w-8 text-black" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        multiple={allowMultiple}
        onChange={handleFileInput}
        className="hidden"
        data-testid="input-file-capture"
      />

      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleBack}
          data-testid="button-back"
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold" data-testid="text-capture-title">{title}</h1>
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-4 max-w-lg mx-auto w-full">
        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Capture buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Button 
            variant="outline" 
            className="h-24 flex-col gap-2"
            onClick={openCamera}
            disabled={createIngestionMutation.isPending}
            data-testid="button-open-camera"
          >
            <Camera className="h-8 w-8" />
            <span>Take Photo</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-24 flex-col gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={createIngestionMutation.isPending}
            data-testid="button-select-file"
          >
            <Upload className="h-8 w-8" />
            <span>Choose File</span>
          </Button>
        </div>

        {/* Selected images preview */}
        {previews.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Selected Photos</span>
              <Badge variant="secondary">{previews.length}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {previews.map((preview, index) => (
                <div key={index} className="relative aspect-square rounded-md overflow-hidden border">
                  <img 
                    src={preview} 
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white"
                    data-testid={`button-remove-photo-${index}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              
              {/* Add more button (for multi-select) */}
              {allowMultiple && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-md border-2 border-dashed flex items-center justify-center text-muted-foreground hover-elevate"
                  disabled={createIngestionMutation.isPending}
                  data-testid="button-add-more-photos"
                >
                  <ImagePlus className="h-8 w-8" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Submit button */}
        <Button
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          disabled={selectedFiles.length === 0 || createIngestionMutation.isPending}
          data-testid="button-submit-capture"
        >
          {createIngestionMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Continue
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
