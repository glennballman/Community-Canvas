import { useState } from 'react';
import { useLocation } from 'wouter';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  FileText, 
  PenLine, 
  Search, 
  Check, 
  Image,
  Upload,
  ArrowRight,
  Sparkles,
  Eye,
  EyeOff,
  Users,
  Lock,
  Rocket
} from 'lucide-react';

type Step = 'source' | 'scanning' | 'review' | 'availability' | 'sharing' | 'complete';

interface ImportedItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: string;
  photos: string[];
  confidence: number;
  needs_review: boolean;
  status: 'ready' | 'needs_review' | 'missing_price' | 'hidden';
}

export default function InventoryOnboarding() {
  const [, navigate] = useLocation();
  const { currentTenant } = useTenant();
  
  const [step, setStep] = useState<Step>('source');
  const [sourceType, setSourceType] = useState<'website' | 'file' | 'manual' | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [importedItems, setImportedItems] = useState<ImportedItem[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('');
  
  const [availabilityType, setAvailabilityType] = useState('always');
  const [priceVisibility, setPriceVisibility] = useState('show');
  const [shareAvailability, setShareAvailability] = useState(false);
  const [sharePricing, setSharePricing] = useState(false);
  const [allowHolds, setAllowHolds] = useState(false);
  const [showPublic, setShowPublic] = useState(true);

  async function startWebsiteScan() {
    if (!websiteUrl) return;
    
    setStep('scanning');
    setScanProgress(0);
    
    const messages = [
      'Finding items and services...',
      'Extracting descriptions and photos...',
      'Detecting categories and pricing...',
      'Organizing everything for review...'
    ];
    
    for (let i = 0; i < messages.length; i++) {
      await new Promise(r => setTimeout(r, 1500));
      setScanMessage(messages[i]);
      setScanProgress((i + 1) * 25);
    }
    
    setImportedItems([
      {
        id: '1',
        name: 'Single Kayak Rental',
        description: 'Perfect for solo paddlers exploring the inlet',
        category: 'Rentals',
        price: '$45/day',
        photos: [],
        confidence: 0.95,
        needs_review: false,
        status: 'ready'
      },
      {
        id: '2',
        name: 'Double Kayak Rental',
        description: 'Tandem kayak for two paddlers',
        category: 'Rentals',
        price: '$65/day',
        photos: [],
        confidence: 0.92,
        needs_review: false,
        status: 'ready'
      },
      {
        id: '3',
        name: 'Guided Tour - 3 Hours',
        description: 'Explore the coastline with an experienced guide',
        category: 'Experiences',
        price: '',
        photos: [],
        confidence: 0.7,
        needs_review: true,
        status: 'missing_price'
      },
    ]);
    
    setStep('review');
  }

  function handleContinueFromReview() {
    setStep('availability');
  }

  function handleContinueFromAvailability() {
    setStep('sharing');
  }

  async function handleFinish() {
    setStep('complete');
  }

  function getStepNumber(): number {
    const steps: Step[] = ['source', 'scanning', 'review', 'availability', 'sharing', 'complete'];
    const index = steps.indexOf(step);
    if (step === 'scanning') return 1;
    if (index <= 1) return 1;
    return index;
  }

  const progressPercent = (getStepNumber() / 5) * 100;

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="assets-onboarding">
      <div className="border-b">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4 mb-2">
            <span className="text-sm text-muted-foreground">Add your assets</span>
            <span className="text-sm text-muted-foreground">
              Step {getStepNumber()} of 5
            </span>
          </div>
          <Progress value={progressPercent} className="h-1" />
          <p className="text-xs text-muted-foreground mt-2">
            You can change anything later. Nothing goes public without your approval.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {step === 'source' && (
          <SourceStep
            sourceType={sourceType}
            setSourceType={setSourceType}
            websiteUrl={websiteUrl}
            setWebsiteUrl={setWebsiteUrl}
            onScan={startWebsiteScan}
            onManual={() => navigate('/app/assets')}
          />
        )}

        {step === 'scanning' && (
          <ScanningStep progress={scanProgress} message={scanMessage} />
        )}

        {step === 'review' && (
          <ReviewStep
            items={importedItems}
            setItems={setImportedItems}
            onContinue={handleContinueFromReview}
          />
        )}

        {step === 'availability' && (
          <AvailabilityStep
            availabilityType={availabilityType}
            setAvailabilityType={setAvailabilityType}
            priceVisibility={priceVisibility}
            setPriceVisibility={setPriceVisibility}
            onContinue={handleContinueFromAvailability}
          />
        )}

        {step === 'sharing' && (
          <SharingStep
            shareAvailability={shareAvailability}
            setShareAvailability={setShareAvailability}
            sharePricing={sharePricing}
            setSharePricing={setSharePricing}
            allowHolds={allowHolds}
            setAllowHolds={setAllowHolds}
            showPublic={showPublic}
            setShowPublic={setShowPublic}
            onFinish={handleFinish}
          />
        )}

        {step === 'complete' && (
          <CompleteStep
            itemCount={importedItems.length}
            tenantName={currentTenant?.tenant_name || 'Your business'}
            onViewAssets={() => navigate('/app/assets')}
          />
        )}
      </div>
    </div>
  );
}

function SourceStep({
  sourceType,
  setSourceType,
  websiteUrl,
  setWebsiteUrl,
  onScan,
  onManual
}: {
  sourceType: 'website' | 'file' | 'manual' | null;
  setSourceType: (t: 'website' | 'file' | 'manual' | null) => void;
  websiteUrl: string;
  setWebsiteUrl: (url: string) => void;
  onScan: () => void;
  onManual: () => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">How would you like to add your assets?</h1>
      <p className="text-muted-foreground mb-8">Most people let us import them automatically.</p>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => setSourceType('website')}
          data-testid="button-source-website"
          className={`p-6 rounded-md border text-left transition hover-elevate ${
            sourceType === 'website'
              ? 'bg-primary/10 border-primary'
              : 'bg-muted/50 border-border'
          }`}
        >
          <Globe className="w-8 h-8 mb-3 text-primary" />
          <h3 className="font-semibold mb-2">Import from your website</h3>
          <p className="text-sm text-muted-foreground">
            We'll scan your site and build your inventory for you - items, descriptions, and photos.
          </p>
        </button>

        <button
          onClick={() => setSourceType('file')}
          data-testid="button-source-file"
          className={`p-6 rounded-md border text-left transition hover-elevate ${
            sourceType === 'file'
              ? 'bg-primary/10 border-primary'
              : 'bg-muted/50 border-border'
          }`}
        >
          <FileText className="w-8 h-8 mb-3 text-primary" />
          <h3 className="font-semibold mb-2">Upload a file</h3>
          <p className="text-sm text-muted-foreground">
            Upload a spreadsheet or PDF and we'll convert it into structured inventory.
          </p>
          <p className="text-xs text-muted-foreground mt-2">CSV, Excel, PDF</p>
        </button>

        <button
          onClick={() => {
            setSourceType('manual');
            onManual();
          }}
          data-testid="button-source-manual"
          className="p-6 rounded-md border bg-muted/50 border-border text-left transition hover-elevate"
        >
          <PenLine className="w-8 h-8 mb-3 text-primary" />
          <h3 className="font-semibold mb-2">Start from scratch</h3>
          <p className="text-sm text-muted-foreground">
            Add items manually if you don't have a website or file.
          </p>
        </button>
      </div>

      {sourceType === 'website' && (
        <Card className="p-6">
          <Label htmlFor="website-url" className="block text-sm font-medium mb-2">
            Your website URL
          </Label>
          <Input
            id="website-url"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourwebsite.com"
            className="mb-2"
            data-testid="input-website-url"
          />
          <p className="text-xs text-muted-foreground mb-4">
            Works with most business websites, even simple ones.
          </p>
          <Button
            onClick={onScan}
            disabled={!websiteUrl}
            className="w-full"
            data-testid="button-scan-website"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Scan my website
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Takes about 30-60 seconds
          </p>
        </Card>
      )}

      {sourceType === 'file' && (
        <Card className="p-6 text-center">
          <div className="border-2 border-dashed border-border rounded-md p-8">
            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">Drag and drop your file here, or</p>
            <Button data-testid="button-choose-file">
              Choose File
            </Button>
          </div>
        </Card>
      )}

      <p className="text-sm text-muted-foreground mt-6 text-center">
        You can combine methods later - import now, edit manually anytime.
      </p>
    </div>
  );
}

function ScanningStep({ progress, message }: { progress: number; message: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-24 h-24 mx-auto mb-6 relative flex items-center justify-center">
        <div className="absolute inset-0 border-4 border-muted rounded-full" />
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="44"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            strokeDasharray={`${progress * 2.76} 276`}
            strokeLinecap="round"
          />
        </svg>
        <Search className="w-10 h-10 text-primary" />
      </div>
      
      <h2 className="text-2xl font-bold mb-2">Scanning your inventory...</h2>
      <p className="text-muted-foreground mb-4">{message}</p>
      <div className="max-w-xs mx-auto">
        <Progress value={progress} className="h-2" />
      </div>
      <p className="text-sm text-muted-foreground mt-6">
        You don't need to watch this - we'll let you know when it's ready.
      </p>
    </div>
  );
}

function ReviewStep({
  items,
  setItems,
  onContinue
}: {
  items: ImportedItem[];
  setItems: (items: ImportedItem[]) => void;
  onContinue: () => void;
}) {
  const readyCount = items.filter(i => i.status === 'ready').length;
  const reviewCount = items.filter(i => i.needs_review).length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">We found {items.length} items</h1>
      <p className="text-muted-foreground mb-6">Review what we found. You're always in control.</p>

      <div className="bg-green-500/10 border border-green-500/30 rounded-md p-4 mb-6 flex items-center gap-3">
        <Check className="w-6 h-6 text-green-500" />
        <div>
          <p className="font-medium text-green-600 dark:text-green-400">Import complete - nothing is live yet</p>
          <p className="text-sm text-green-600/70 dark:text-green-400/70">Review items below. You can edit, hide, or delete anything.</p>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap mb-6">
        <Badge variant="secondary" className="bg-green-500/20 text-green-600 dark:text-green-400 border-0">
          {readyCount} ready
        </Badge>
        {reviewCount > 0 && (
          <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-0">
            {reviewCount} need review
          </Badge>
        )}
      </div>

      <div className="space-y-3 mb-8">
        {items.map((item) => (
          <Card
            key={item.id}
            className="p-4 flex items-start gap-4"
            data-testid={`card-item-${item.id}`}
          >
            <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
              <Image className="w-6 h-6 text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-medium">{item.name}</h3>
                <Badge 
                  variant="secondary"
                  className={`text-xs ${
                    item.status === 'ready' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                    item.status === 'needs_review' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                    item.status === 'missing_price' ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                    'bg-muted text-muted-foreground'
                  } border-0`}
                >
                  {item.status === 'ready' ? 'Ready' :
                   item.status === 'needs_review' ? 'Needs review' :
                   item.status === 'missing_price' ? 'Missing price' :
                   'Hidden'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
              <div className="flex gap-4 text-sm flex-wrap">
                <span className="text-muted-foreground">{item.category}</span>
                {item.price && <span className="font-medium">{item.price}</span>}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button variant="ghost" size="sm" data-testid={`button-edit-${item.id}`}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" data-testid={`button-hide-${item.id}`}>
                Hide
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-between gap-4 flex-wrap">
        <Button variant="ghost" className="text-muted-foreground" data-testid="button-save-later">
          Save and finish later
        </Button>
        <Button onClick={onContinue} data-testid="button-continue-review">
          Looks good - continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function AvailabilityStep({
  availabilityType,
  setAvailabilityType,
  priceVisibility,
  setPriceVisibility,
  onContinue
}: {
  availabilityType: string;
  setAvailabilityType: (t: string) => void;
  priceVisibility: string;
  setPriceVisibility: (v: string) => void;
  onContinue: () => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Availability & pricing</h1>
      <p className="text-muted-foreground mb-8">Set the basics. You can fine-tune later.</p>

      <div className="mb-8">
        <Label className="block text-sm font-medium mb-3">
          When are these items generally available?
        </Label>
        <div className="space-y-2">
          {[
            { value: 'always', label: 'Always available' },
            { value: 'seasonal', label: 'Seasonal' },
            { value: 'by_request', label: 'By request' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setAvailabilityType(opt.value)}
              data-testid={`button-availability-${opt.value}`}
              className={`flex items-center gap-3 p-4 rounded-md border w-full text-left transition hover-elevate ${
                availabilityType === opt.value
                  ? 'bg-primary/10 border-primary'
                  : 'bg-muted/50 border-border'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                availabilityType === opt.value ? 'border-primary' : 'border-muted-foreground'
              }`}>
                {availabilityType === opt.value && (
                  <div className="w-2.5 h-2.5 bg-primary rounded-full" />
                )}
              </div>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          You can set exact dates and blackout periods later.
        </p>
      </div>

      <div className="mb-8">
        <Label className="block text-sm font-medium mb-3">
          How should pricing be shown?
        </Label>
        <div className="space-y-2">
          {[
            { value: 'show', label: 'Show approximate prices', desc: 'Helps callers decide faster', icon: Eye },
            { value: 'hide', label: 'Hide prices', desc: 'Operators can still contact you', icon: EyeOff },
            { value: 'varies', label: 'Price varies', desc: "We'll label prices as estimates", icon: Eye },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPriceVisibility(opt.value)}
              data-testid={`button-pricing-${opt.value}`}
              className={`flex items-start gap-3 p-4 rounded-md border w-full text-left transition hover-elevate ${
                priceVisibility === opt.value
                  ? 'bg-primary/10 border-primary'
                  : 'bg-muted/50 border-border'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                priceVisibility === opt.value ? 'border-primary' : 'border-muted-foreground'
              }`}>
                {priceVisibility === opt.value && (
                  <div className="w-2.5 h-2.5 bg-primary rounded-full" />
                )}
              </div>
              <div>
                <div>{opt.label}</div>
                <div className="text-sm text-muted-foreground">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Button onClick={onContinue} className="w-full" data-testid="button-continue-availability">
        Continue
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

function SharingStep({
  shareAvailability,
  setShareAvailability,
  sharePricing,
  setSharePricing,
  allowHolds,
  setAllowHolds,
  showPublic,
  setShowPublic,
  onFinish
}: {
  shareAvailability: boolean;
  setShareAvailability: (v: boolean) => void;
  sharePricing: boolean;
  setSharePricing: (v: boolean) => void;
  allowHolds: boolean;
  setAllowHolds: (v: boolean) => void;
  showPublic: boolean;
  setShowPublic: (v: boolean) => void;
  onFinish: () => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Who can see your availability?</h1>
      <p className="text-muted-foreground mb-8">You control what's shared and with whom.</p>

      <Card className="p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Users className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Community operators</h3>
            <p className="text-sm text-muted-foreground">
              Community admins (like the Chamber or Visitor Centre) can answer calls on your behalf if you opt in.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="share-availability" className="font-medium">Share availability</Label>
              <p className="text-sm text-muted-foreground">Operators can see if you're available</p>
            </div>
            <Switch
              id="share-availability"
              checked={shareAvailability}
              onCheckedChange={setShareAvailability}
              data-testid="switch-share-availability"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="share-pricing" className="font-medium">Share pricing</Label>
              <p className="text-sm text-muted-foreground">Operators can quote approximate prices</p>
            </div>
            <Switch
              id="share-pricing"
              checked={sharePricing}
              onCheckedChange={setSharePricing}
              data-testid="switch-share-pricing"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="allow-holds" className="font-medium">Allow hold requests</Label>
              <p className="text-sm text-muted-foreground">Operators can request tentative holds for callers</p>
            </div>
            <Switch
              id="allow-holds"
              checked={allowHolds}
              onCheckedChange={setAllowHolds}
              data-testid="switch-allow-holds"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6 mb-8">
        <div className="flex items-start gap-3 mb-4">
          <Lock className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Public visibility</h3>
            <p className="text-sm text-muted-foreground">
              Choose whether your assets appear in public search results.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="show-public" className="font-medium">Show in public listings</Label>
            <p className="text-sm text-muted-foreground">Anyone can find your offerings</p>
          </div>
          <Switch
            id="show-public"
            checked={showPublic}
            onCheckedChange={setShowPublic}
            data-testid="switch-show-public"
          />
        </div>
      </Card>

      <Button onClick={onFinish} className="w-full" data-testid="button-finish">
        <Rocket className="w-4 h-4 mr-2" />
        Finish setup
      </Button>
    </div>
  );
}

function CompleteStep({
  itemCount,
  tenantName,
  onViewAssets
}: {
  itemCount: number;
  tenantName: string;
  onViewAssets: () => void;
}) {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
        <Check className="w-10 h-10 text-green-500" />
      </div>

      <h1 className="text-2xl font-bold mb-2">You're all set!</h1>
      <p className="text-muted-foreground mb-8">
        {itemCount} items have been added to {tenantName}'s assets.
      </p>

      <Button onClick={onViewAssets} data-testid="button-view-assets">
        View your assets
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}
