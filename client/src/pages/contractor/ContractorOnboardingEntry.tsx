/**
 * Contractor Onboarding Entry Point - Prompt A1
 * 
 * Camera-first onboarding experience that:
 * - Requires zero forms
 * - Delivers immediate operational value
 * - Feels easier than a sticky note
 * 
 * Three giant action cards, each tappable, each camera-first:
 * 1. "Add My Truck & Trailer" → vehicle capture
 * 2. "Add My Tools" → tool capture
 * 3. "Add a Job From a Sticky Note" → sticky note capture (WOW path)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Truck, 
  Wrench, 
  StickyNote, 
  Camera, 
  ChevronRight,
  Sparkles,
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ContractorProfile {
  id: string;
  userId: string;
  portalId: string;
  onboardingComplete: boolean;
  onboardingStartedAt: string | null;
  vehicleStarted: boolean;
  toolsStarted: boolean;
  stickyNoteStarted: boolean;
}

type OnboardingAction = 'vehicle' | 'tools' | 'sticky-note';

export default function ContractorOnboardingEntry() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  
  const [cameraOpen, setCameraOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<OnboardingAction | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch contractor profile
  const { data: profileData, isLoading } = useQuery<{ success: boolean; profile?: ContractorProfile }>({
    queryKey: ['/api/contractor/profile'],
    enabled: !!user && !!currentTenant,
  });

  // Start onboarding mutation
  const startOnboardingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/contractor/profile/start-onboarding');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/profile'] });
    },
  });

  // Update onboarding progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: async (updates: Partial<{ vehicleStarted: boolean; toolsStarted: boolean; stickyNoteStarted: boolean }>) => {
      const res = await apiRequest('PATCH', '/api/contractor/profile/onboarding', updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/profile'] });
    },
  });

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/contractor/profile/complete-onboarding');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/profile'] });
      navigate('/app/dashboard');
    },
  });

  // Initialize onboarding on first visit
  useEffect(() => {
    if (user && currentTenant && profileData?.success === false) {
      startOnboardingMutation.mutate();
    }
  }, [user, currentTenant, profileData]);

  const profile = profileData?.profile;

  // Redirect if already completed
  useEffect(() => {
    if (profile?.onboardingComplete) {
      navigate('/app/dashboard');
    }
  }, [profile, navigate]);

  // Open camera for photo capture
  const openCamera = useCallback(async (action: OnboardingAction) => {
    setCurrentAction(action);
    
    // Mark the step as started
    const updates: Partial<{ vehicleStarted: boolean; toolsStarted: boolean; stickyNoteStarted: boolean }> = {};
    if (action === 'vehicle') updates.vehicleStarted = true;
    if (action === 'tools') updates.toolsStarted = true;
    if (action === 'sticky-note') updates.stickyNoteStarted = true;
    updateProgressMutation.mutate(updates);

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
      // Fall back to file picker
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  }, [updateProgressMutation]);

  // Close camera
  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setCurrentAction(null);
    setCapturedImage(null);
  }, []);

  // Capture photo from camera
  const capturePhoto = useCallback(() => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        
        // For now, just close and navigate to appropriate capture page
        // (Asset creation happens in later prompts)
        closeCamera();
        navigateToCapture(currentAction!);
      }
    }
  }, [currentAction]);

  // Handle file input
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentAction) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target?.result as string);
        // Navigate to capture page
        navigateToCapture(currentAction);
      };
      reader.readAsDataURL(file);
    }
  }, [currentAction]);

  // Navigate to capture pages (stub for now - full implementation in later prompts)
  const navigateToCapture = (action: OnboardingAction) => {
    switch (action) {
      case 'vehicle':
        // Will be /contractor/onboard/vehicle-capture in later prompts
        console.log('[ONBOARDING] Vehicle capture started');
        break;
      case 'tools':
        // Will be /contractor/onboard/tool-capture in later prompts
        console.log('[ONBOARDING] Tool capture started');
        break;
      case 'sticky-note':
        // Will be /contractor/onboard/sticky-note-capture in later prompts
        console.log('[ONBOARDING] Sticky note capture started');
        break;
    }
  };

  // Skip onboarding
  const handleSkip = () => {
    completeOnboardingMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Camera overlay
  if (cameraOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="absolute top-4 right-4 z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={closeCamera}
            className="text-white hover:bg-white/20"
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
          <Button 
            size="lg"
            onClick={capturePhoto}
            className="w-20 h-20 rounded-full bg-white hover:bg-gray-200"
            data-testid="button-capture-photo"
          >
            <Camera className="h-8 w-8 text-black" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hidden file input for fallback */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileInput}
        className="hidden"
        data-testid="input-file-capture"
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-3" data-testid="text-onboarding-title">
            Let's get you working.
          </h1>
          <p className="text-muted-foreground text-lg" data-testid="text-onboarding-subtitle">
            This takes less time than writing a sticky note.
          </p>
        </div>

        {/* Action Cards */}
        <div className="w-full space-y-4 mb-8">
          {/* Action 1: Add My Truck & Trailer */}
          <Card 
            className="cursor-pointer hover-elevate active-elevate-2 border-2 transition-all"
            onClick={() => openCamera('vehicle')}
            data-testid="card-action-vehicle"
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Truck className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold mb-1">Add My Truck & Trailer</h3>
                <p className="text-sm text-muted-foreground">
                  Take a photo. We'll figure out the rest.
                </p>
              </div>
              <Camera className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </CardContent>
          </Card>

          {/* Action 2: Add My Tools */}
          <Card 
            className="cursor-pointer hover-elevate active-elevate-2 border-2 transition-all"
            onClick={() => openCamera('tools')}
            data-testid="card-action-tools"
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <Wrench className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold mb-1">Add My Tools</h3>
                <p className="text-sm text-muted-foreground">
                  No lists. Just photos.
                </p>
              </div>
              <Camera className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </CardContent>
          </Card>

          {/* Action 3: Add a Job From a Sticky Note (WOW path) */}
          <Card 
            className="cursor-pointer hover-elevate active-elevate-2 border-2 border-amber-300 dark:border-amber-600 transition-all relative overflow-visible"
            onClick={() => openCamera('sticky-note')}
            data-testid="card-action-sticky-note"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 -z-10 bg-amber-200/20 dark:bg-amber-500/10 blur-xl rounded-xl" />
            
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 relative">
                <StickyNote className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                <Sparkles className="h-4 w-4 text-amber-500 absolute -top-1 -right-1" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold mb-1">Add a Job From a Sticky Note</h3>
                <p className="text-sm text-muted-foreground">
                  Snap a photo. We'll turn it into a real job.
                </p>
              </div>
              <Camera className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </CardContent>
          </Card>
        </div>

        {/* Progress indicators (optional - shows which steps have been started) */}
        {(profile?.vehicleStarted || profile?.toolsStarted || profile?.stickyNoteStarted) && (
          <div className="w-full mb-6">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {profile.vehicleStarted && (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <Truck className="h-3 w-3" /> Vehicle
                </span>
              )}
              {profile.toolsStarted && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Wrench className="h-3 w-3" /> Tools
                </span>
              )}
              {profile.stickyNoteStarted && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <StickyNote className="h-3 w-3" /> Note
                </span>
              )}
            </div>
          </div>
        )}

        {/* Skip option */}
        <div className="text-center">
          <Button 
            variant="ghost" 
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-skip-onboarding"
          >
            Skip for now
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          
          <p className="text-xs text-muted-foreground mt-3 max-w-xs mx-auto" data-testid="text-skip-hint">
            You can do this anytime. Nothing here is permanent.
          </p>
        </div>
      </div>
    </div>
  );
}
