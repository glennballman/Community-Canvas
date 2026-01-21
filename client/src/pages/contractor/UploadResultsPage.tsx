/**
 * A2.3: Upload Results Page - "Here's what I found" UI
 * A2.6: Next Actions Workspace - durable action tracking
 * 
 * Displays:
 * - Classification results for each uploaded image
 * - Extracted entities (license plates, phones, addresses, materials)
 * - Proposed links (fleet, tools, jobsites, customers)
 * - Next actions with accept/edit/dismiss workflow (A2.6)
 * - Opportunities (asset upsells, zone expansion)
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Check, 
  X, 
  Pencil, 
  Truck, 
  Wrench, 
  StickyNote,
  MapPin,
  User,
  Phone,
  Globe,
  Package,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Loader2,
  Camera,
  ChevronRight,
  AlertTriangle,
  Image,
  ClipboardList,
  Play,
  FileText,
  Quote,
  Hammer,
  RefreshCw,
  MessageSquare,
  ExternalLink
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { LocationResolutionBlock } from '@/components/contractor/LocationResolutionBlock';

interface ClassificationResult {
  primary: string;
  secondary: string[];
  confidence: number;
}

interface ExtractedEntity {
  value: string;
  confidence: number;
}

interface ExtractedEntities {
  // PRIVACY: No licensePlate - only region is stored
  licensePlateRegion?: ExtractedEntity;
  companyName?: ExtractedEntity;
  phone?: ExtractedEntity;
  email?: ExtractedEntity;
  website?: ExtractedEntity;
  customerName?: ExtractedEntity;
  // PRIVACY: Address is ADVISORY ONLY - UI must display as "Photo captured near..."
  addressAdvisory?: ExtractedEntity;
  materials?: Array<{ name: string; qty?: string; unit?: string; confidence: number }>;
}

interface GeoInference {
  lat?: number;
  lng?: number;
  proposedAddress?: string;
  confidence: number;
  source: string;
}

interface ProposedLinks {
  vehicle: boolean;
  trailer: boolean;
  tool: boolean;
  material: boolean;
  jobsite: boolean;
  customer: boolean;
  serviceRun: boolean;
  beforeAfterBundle: boolean;
}

interface NextAction {
  type: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  payload?: any;
}

interface ClassifiedIngestion {
  ingestionId: string;
  classification: ClassificationResult;
  extractedEntities: ExtractedEntities;
  geoInference: GeoInference;
  proposedLinks: ProposedLinks;
  nextActions: NextAction[];
}

interface Opportunity {
  id: string;
  opportunityType: string;
  reason: string;
  confidence: string;
  details: Record<string, any>;
  status: string;
}

// A2.6: Durable next actions from backend
interface DurableNextAction {
  id: string;
  ingestionId: string;
  actionType: string;
  actionPayload: Record<string, any>;
  confidence: string;
  status: 'proposed' | 'confirmed' | 'dismissed';
  createdAt: string;
}

// Action type metadata for UI
const ACTION_TYPE_META: Record<string, { icon: React.ReactNode; label: string; description: string }> = {
  create_work_request: {
    icon: <ClipboardList className="h-4 w-4" />,
    label: 'Create Work Request',
    description: 'Turn this sticky note into a tracked work request'
  },
  attach_to_zone: {
    icon: <MapPin className="h-4 w-4" />,
    label: 'Attach to Zone',
    description: 'Link this photo to a customer jobsite'
  },
  request_more_photos: {
    icon: <Camera className="h-4 w-4" />,
    label: 'Need More Photos',
    description: 'Add more context photos for better analysis'
  },
  draft_n3_run: {
    icon: <Play className="h-4 w-4" />,
    label: 'Create Service Run',
    description: 'Draft a service run from this evidence'
  },
  open_quote_draft: {
    icon: <FileText className="h-4 w-4" />,
    label: 'Open Quote Draft',
    description: 'Create a quote from this work'
  },
  add_tool: {
    icon: <Hammer className="h-4 w-4" />,
    label: 'Add Tool',
    description: 'Add detected tool to your inventory'
  },
  add_fleet: {
    icon: <Truck className="h-4 w-4" />,
    label: 'Add Fleet Asset',
    description: 'Add detected vehicle to your fleet'
  }
};

function getClassificationIcon(type: string) {
  switch (type) {
    case 'vehicle_truck':
    case 'vehicle_van':
      return <Truck className="h-5 w-5" />;
    case 'vehicle_trailer':
      return <Package className="h-5 w-5" />;
    case 'tool':
    case 'material':
      return <Wrench className="h-5 w-5" />;
    case 'sticky_note':
    case 'whiteboard':
      return <StickyNote className="h-5 w-5" />;
    case 'jobsite':
    case 'before_photo':
    case 'after_photo':
      return <MapPin className="h-5 w-5" />;
    case 'receipt':
    case 'document':
      return <Package className="h-5 w-5" />;
    default:
      return <Image className="h-5 w-5" />;
  }
}

function getClassificationLabel(type: string): string {
  const labels: Record<string, string> = {
    vehicle_truck: 'Truck',
    vehicle_van: 'Van',
    vehicle_trailer: 'Trailer',
    tool: 'Tool',
    material: 'Material',
    sticky_note: 'Sticky Note',
    whiteboard: 'Whiteboard',
    jobsite: 'Jobsite',
    before_photo: 'Before Photo',
    after_photo: 'After Photo',
    receipt: 'Receipt',
    document: 'Document',
    unknown: 'Unknown'
  };
  return labels[type] || type;
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  return (
    <div className="flex items-center gap-2">
      <Progress value={percent} className="h-2 w-16" />
      <span className="text-xs text-muted-foreground">{percent}%</span>
    </div>
  );
}

// Action types that support edit workflow
const EDITABLE_ACTION_TYPES = ['request_more_photos', 'create_work_request', 'open_quote_draft', 'attach_to_zone'];

// A2.6: Durable Action Card with confirm/dismiss/edit workflow
interface ZoneCandidate {
  zoneId: string;
  label: string;
  confidence: number;
}

function DurableActionCard({ 
  action,
  onConfirm,
  onDismiss,
  onEdit,
  isLoading,
  isLocationConfirmed = false
}: { 
  action: DurableNextAction;
  onConfirm: (payload?: Record<string, any>) => void;
  onDismiss: () => void;
  onEdit?: (updatedPayload: Record<string, any>) => void;
  isLoading: boolean;
  isLocationConfirmed?: boolean;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedPrompts, setEditedPrompts] = useState<string>('');
  const [editedTodos, setEditedTodos] = useState<string>('');
  const [editedCategory, setEditedCategory] = useState<string>('');
  const [editedAddress, setEditedAddress] = useState<string>('');
  const [selectedZoneId, setSelectedZoneId] = useState<string>(action.actionPayload?.selectedZoneId || '');
  
  const meta = ACTION_TYPE_META[action.actionType] || {
    icon: <Sparkles className="h-4 w-4" />,
    label: action.actionType.replace(/_/g, ' '),
    description: 'AI suggested action'
  };
  
  const confidenceNum = parseInt(action.confidence || '50');
  const payload = action.actionPayload || {};
  const isEditable = EDITABLE_ACTION_TYPES.includes(action.actionType);
  
  // Initialize edit fields when dialog opens
  const handleEditOpen = () => {
    if (action.actionType === 'request_more_photos') {
      setEditedPrompts((payload.prompts || []).join('\n'));
    } else if (action.actionType === 'create_work_request') {
      setEditedTodos((payload.todos || payload.lineItems?.map((i: any) => i.text) || []).join('\n'));
    } else if (action.actionType === 'open_quote_draft') {
      setEditedCategory(payload.category || '');
      setEditedAddress(payload.address || '');
    }
    setIsEditOpen(true);
  };
  
  const handleSaveEdit = () => {
    if (!onEdit) return;
    
    let updatedPayload: Record<string, any> = {};
    
    if (action.actionType === 'request_more_photos') {
      updatedPayload = { prompts: editedPrompts.split('\n').filter(p => p.trim()) };
    } else if (action.actionType === 'create_work_request') {
      updatedPayload = { todos: editedTodos.split('\n').filter(t => t.trim()) };
    } else if (action.actionType === 'open_quote_draft') {
      updatedPayload = { category: editedCategory, address: editedAddress };
    }
    
    onEdit(updatedPayload);
    setIsEditOpen(false);
  };
  
  return (
    <div 
      className="p-3 rounded-lg border bg-card hover-elevate"
      data-testid={`durable-action-${action.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-medium">{meta.label}</div>
            <Badge variant="secondary" className="text-xs">
              {confidenceNum}% confidence
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {meta.description}
          </p>
          
          {/* Show payload details for work requests */}
          {action.actionType === 'create_work_request' && payload.title && (
            <div className="mt-2 p-2 rounded bg-muted/50 text-sm">
              <div className="font-medium">{payload.title}</div>
              {payload.lineItems?.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {payload.lineItems.slice(0, 3).map((item: any, i: number) => (
                    <li key={i} className="flex items-center gap-1">
                      <span className="text-xs">-</span>
                      {item.text}
                    </li>
                  ))}
                  {payload.lineItems.length > 3 && (
                    <li className="text-xs">+{payload.lineItems.length - 3} more</li>
                  )}
                </ul>
              )}
              {payload.urgency && payload.urgency !== 'medium' && (
                <Badge 
                  variant={payload.urgency === 'urgent' ? 'destructive' : 'secondary'}
                  className="mt-2"
                >
                  {payload.urgency}
                </Badge>
              )}
            </div>
          )}
          
          {/* Show prompts for request_more_photos */}
          {action.actionType === 'request_more_photos' && payload.prompts?.length > 0 && (
            <div className="mt-2 p-2 rounded bg-muted/50 text-sm">
              <ul className="space-y-1 text-muted-foreground">
                {payload.prompts.slice(0, 3).map((prompt: string, i: number) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-xs">-</span>
                    <span>{prompt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Show details for fleet/tool additions */}
          {action.actionType === 'add_fleet' && payload.assetType && (
            <div className="mt-2 text-sm text-muted-foreground">
              Type: {payload.assetType}
              {payload.color && `, Color: ${payload.color}`}
              {payload.make && `, Make: ${payload.make}`}
            </div>
          )}
          
          {action.actionType === 'add_tool' && payload.name && (
            <div className="mt-2 text-sm text-muted-foreground">
              {payload.name}
              {payload.category && ` (${payload.category})`}
            </div>
          )}
          
          {/* Zone selection for attach_to_zone */}
          {action.actionType === 'attach_to_zone' && (
            <div className="mt-2 space-y-2">
              {!isLocationConfirmed && payload.geo?.lat && (
                <div className="flex items-center gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-amber-700 dark:text-amber-300">Confirm location first</span>
                </div>
              )}
              
              {payload.proposedAddress && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>Near: {payload.proposedAddress}</span>
                </div>
              )}
              
              {payload.zoneCandidates && payload.zoneCandidates.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Select Zone:</Label>
                  <div className="space-y-1">
                    {payload.zoneCandidates.map((zone: ZoneCandidate) => (
                      <label
                        key={zone.zoneId}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                          selectedZoneId === zone.zoneId 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:bg-muted/50'
                        }`}
                        data-testid={`zone-option-${zone.zoneId}`}
                      >
                        <input
                          type="radio"
                          name={`zone-${action.id}`}
                          value={zone.zoneId}
                          checked={selectedZoneId === zone.zoneId}
                          onChange={(e) => {
                            setSelectedZoneId(e.target.value);
                            onEdit?.({ selectedZoneId: e.target.value });
                          }}
                          className="text-primary"
                        />
                        <span className="text-sm">{zone.label}</span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {zone.confidence}%
                        </Badge>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              
              {(!payload.zoneCandidates || payload.zoneCandidates.length === 0) && (
                <div className="text-sm text-muted-foreground">
                  No zones available. Create a zone first.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onDismiss}
          disabled={isLoading}
          data-testid={`button-dismiss-action-${action.id}`}
        >
          <X className="h-4 w-4 mr-1" />
          Skip
        </Button>
        
        {isEditable && onEdit && (
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleEditOpen}
                disabled={isLoading}
                data-testid={`button-edit-action-${action.id}`}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit {meta.label}</DialogTitle>
                <DialogDescription>
                  Modify the details before confirming this action.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {action.actionType === 'request_more_photos' && (
                  <div className="space-y-2">
                    <Label htmlFor="prompts">Photo Prompts (one per line)</Label>
                    <Textarea
                      id="prompts"
                      value={editedPrompts}
                      onChange={(e) => setEditedPrompts(e.target.value)}
                      placeholder="Please add a 'before' photo..."
                      rows={4}
                    />
                  </div>
                )}
                
                {action.actionType === 'create_work_request' && (
                  <div className="space-y-2">
                    <Label htmlFor="todos">Tasks (one per line)</Label>
                    <Textarea
                      id="todos"
                      value={editedTodos}
                      onChange={(e) => setEditedTodos(e.target.value)}
                      placeholder="Task 1&#10;Task 2"
                      rows={4}
                    />
                  </div>
                )}
                
                {action.actionType === 'open_quote_draft' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        value={editedCategory}
                        onChange={(e) => setEditedCategory(e.target.value)}
                        placeholder="e.g., landscaping, plumbing"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={editedAddress}
                        onChange={(e) => setEditedAddress(e.target.value)}
                        placeholder="Service address"
                      />
                    </div>
                  </>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        
        <Button 
          size="sm" 
          onClick={() => {
            // For attach_to_zone, pass selectedZoneId in payload
            if (action.actionType === 'attach_to_zone' && selectedZoneId) {
              onConfirm({ selectedZoneId });
            } else {
              onConfirm();
            }
          }}
          disabled={isLoading || (action.actionType === 'attach_to_zone' && !selectedZoneId)}
          data-testid={`button-confirm-action-${action.id}`}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          {action.actionType === 'attach_to_zone' ? 'Attach Zone' : 'Confirm'}
        </Button>
      </div>
    </div>
  );
}

function ActionCard({ 
  action, 
  ingestionId,
  extractedEntities,
  geoInference
}: { 
  action: NextAction; 
  ingestionId: string;
  extractedEntities: ExtractedEntities;
  geoInference: GeoInference;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const { currentTenant } = useTenant();
  
  const handleAction = async () => {
    if (action.type === 'open_message_thread' && action.payload?.autoCreateThread) {
      setIsLoading(true);
      try {
        await apiRequest(`/api/contractor/ingestions/${ingestionId}/create-thread`, JSON.stringify({
          proposedMessage: action.payload.proposedMessage
        }));
        setIsDone(true);
      } catch (err) {
        console.error('Failed to create thread:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  if (isDone) {
    return (
      <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-green-500/10 text-green-600">
        <Check className="h-4 w-4" />
        <span>Proposal saved - create work request to enable messaging</span>
      </div>
    );
  }
  
  return (
    <div 
      className="flex items-center justify-between gap-2 text-sm p-2 rounded-md bg-muted/50 hover-elevate cursor-pointer"
      onClick={handleAction}
      data-testid={`action-${action.type}`}
    >
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-primary mt-0.5" />
        <div>
          <div className="font-medium">{action.title}</div>
          <div className="text-muted-foreground text-xs">{action.description}</div>
        </div>
      </div>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

function ClassificationCard({ 
  result, 
  onAccept, 
  onDismiss 
}: { 
  result: ClassifiedIngestion; 
  onAccept: () => void; 
  onDismiss: () => void;
}) {
  const { classification, extractedEntities, geoInference, proposedLinks, nextActions } = result;
  
  return (
    <Card className="overflow-visible" data-testid={`card-classification-${result.ingestionId}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              {getClassificationIcon(classification.primary)}
            </div>
            <div>
              <CardTitle className="text-lg">{getClassificationLabel(classification.primary)}</CardTitle>
              {classification.secondary.length > 0 && (
                <CardDescription>
                  Also: {classification.secondary.map(getClassificationLabel).join(', ')}
                </CardDescription>
              )}
            </div>
          </div>
          <ConfidenceMeter confidence={classification.confidence} />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {Object.keys(extractedEntities).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Detected Information</h4>
            <div className="grid gap-2">
              {extractedEntities.licensePlateRegion && (
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span>Vehicle plate detected</span>
                  <Badge variant="secondary">{extractedEntities.licensePlateRegion.value}</Badge>
                </div>
              )}
              {extractedEntities.companyName && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span>{extractedEntities.companyName.value}</span>
                </div>
              )}
              {extractedEntities.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{extractedEntities.phone.value}</span>
                </div>
              )}
              {extractedEntities.customerName && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{extractedEntities.customerName.value}</span>
                </div>
              )}
              {extractedEntities.materials && extractedEntities.materials.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    {extractedEntities.materials.map((m, i) => (
                      <div key={i}>{m.name} {m.qty && `(${m.qty} ${m.unit || ''})`}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {(geoInference.proposedAddress || geoInference.lat) && (
          <LocationResolutionBlock
            ingestionId={result.ingestionId}
            initialAddress={geoInference.proposedAddress}
            initialLat={geoInference.lat}
            initialLng={geoInference.lng}
            source={geoInference.source}
          />
        )}
        
        {Object.values(proposedLinks).some(Boolean) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Will Create</h4>
            <div className="flex flex-wrap gap-1">
              {proposedLinks.vehicle && <Badge variant="outline">Fleet Asset</Badge>}
              {proposedLinks.trailer && <Badge variant="outline">Trailer</Badge>}
              {proposedLinks.tool && <Badge variant="outline">Tool</Badge>}
              {proposedLinks.material && <Badge variant="outline">Material</Badge>}
              {proposedLinks.jobsite && <Badge variant="outline">Jobsite</Badge>}
              {proposedLinks.customer && <Badge variant="outline">Customer</Badge>}
              {proposedLinks.beforeAfterBundle && <Badge variant="outline">Before/After Bundle</Badge>}
            </div>
          </div>
        )}
        
        {nextActions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Suggested Actions</h4>
            {nextActions.slice(0, 2).map((action, i) => (
              <ActionCard 
                key={i} 
                action={action} 
                ingestionId={result.ingestionId}
                extractedEntities={extractedEntities}
                geoInference={geoInference}
              />
            ))}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="justify-end gap-2 pt-0">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onDismiss}
          data-testid="button-dismiss"
        >
          <X className="h-4 w-4 mr-1" />
          Dismiss
        </Button>
        <Button 
          size="sm" 
          onClick={onAccept}
          data-testid="button-accept"
        >
          <Check className="h-4 w-4 mr-1" />
          Accept
        </Button>
      </CardFooter>
    </Card>
  );
}

function OpportunityCard({ 
  opportunity, 
  onAccept, 
  onDismiss 
}: { 
  opportunity: Opportunity; 
  onAccept: () => void; 
  onDismiss: () => void;
}) {
  const details = opportunity.details || {};
  
  return (
    <Card className="border-primary/20 bg-primary/5" data-testid={`card-opportunity-${opportunity.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-md bg-primary/20 text-primary">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Growth Opportunity</CardTitle>
            <CardDescription>{opportunity.opportunityType.replace(/_/g, ' ')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <p className="text-sm">{opportunity.reason}</p>
        
        {details.openRequestsCount && (
          <div className="text-sm text-muted-foreground">
            {details.openRequestsCount} open work requests in this area
          </div>
        )}
        
        {details.suggestedAsset && (
          <Badge variant="secondary">
            Suggested: {details.suggestedAsset.replace(/_/g, ' ')}
          </Badge>
        )}
        
        {details.demandLevel && (
          <Badge variant={details.demandLevel === 'high' ? 'default' : 'secondary'}>
            {details.demandLevel.toUpperCase()} demand
          </Badge>
        )}
      </CardContent>
      
      <CardFooter className="justify-end gap-2 pt-0">
        <Button variant="ghost" size="sm" onClick={onDismiss} data-testid="button-opportunity-dismiss">
          Not Now
        </Button>
        <Button size="sm" onClick={onAccept} data-testid="button-opportunity-accept">
          Learn More
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function UploadResultsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [resolvingActionId, setResolvingActionId] = useState<string | null>(null);
  
  // Get ingestion IDs from URL params
  const ingestionIds = searchParams.get('ids')?.split(',') || [];
  
  // Fetch classifications for these ingestions
  const { data: classificationsData, isLoading } = useQuery<{
    ok: boolean;
    classifications: ClassifiedIngestion[];
  }>({
    queryKey: ['/api/contractor/ingestions', 'batch', ingestionIds.join(',')],
    queryFn: async () => {
      // Fetch each ingestion
      const results = await Promise.all(
        ingestionIds.map(async (id) => {
          const res = await fetch(`/api/contractor/ingestions/${id}`, {
            headers: {
              'x-portal-id': currentTenant?.tenant_id || '',
              'x-tenant-id': currentTenant?.tenant_id || ''
            },
            credentials: 'include'
          });
          const data = await res.json();
          if (!data.ok) return null;
          
          const ing = data.ingestion;
          return {
            ingestionId: ing.id,
            classification: ing.classification || { primary: ing.sourceType, secondary: [], confidence: 0.5 },
            extractedEntities: ing.extractedEntities || {},
            geoInference: ing.geoInference || { confidence: 0, source: 'none' },
            proposedLinks: ing.proposedLinks || {},
            nextActions: []
          };
        })
      );
      
      return {
        ok: true,
        classifications: results.filter(Boolean) as ClassifiedIngestion[]
      };
    },
    enabled: ingestionIds.length > 0 && !!currentTenant
  });
  
  // A2.6: Fetch durable next actions for all ingestions
  const { data: nextActionsData, isLoading: loadingActions, refetch: refetchActions } = useQuery<{
    ok: boolean;
    actions: DurableNextAction[];
  }>({
    queryKey: ['/api/contractor/ingestions/next-actions', ingestionIds.join(',')],
    queryFn: async () => {
      // Fetch next actions for each ingestion
      const allActions: DurableNextAction[] = [];
      
      for (const id of ingestionIds) {
        try {
          const res = await fetch(`/api/contractor/ingestions/${id}/next-actions`, {
            headers: {
              'x-portal-id': currentTenant?.tenant_id || '',
              'x-tenant-id': currentTenant?.tenant_id || ''
            },
            credentials: 'include'
          });
          const data = await res.json();
          if (data.ok && data.actions) {
            allActions.push(...data.actions.map((a: any) => ({
              ...a,
              ingestionId: id
            })));
          }
        } catch (err) {
          console.error('Failed to fetch next actions for', id, err);
        }
      }
      
      return { ok: true, actions: allActions };
    },
    enabled: ingestionIds.length > 0 && !!currentTenant
  });
  
  // Fetch opportunities
  const { data: opportunitiesData } = useQuery<{ ok: boolean; opportunities: Opportunity[] }>({
    queryKey: ['/api/contractor/ingestions/opportunities'],
    enabled: !!user && !!currentTenant
  });
  
  // Confirm ingestion mutation
  const confirmMutation = useMutation({
    mutationFn: async (ingestionId: string) => {
      const res = await apiRequest('POST', `/api/contractor/ingestions/${ingestionId}/confirm`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/ingestions'] });
    }
  });
  
  // Dismiss ingestion mutation
  const dismissMutation = useMutation({
    mutationFn: async (ingestionId: string) => {
      const res = await apiRequest('POST', `/api/contractor/ingestions/${ingestionId}/discard`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/ingestions'] });
    }
  });
  
  // A2.6: Resolve next action mutation (supports confirm, dismiss, edit)
  const resolveActionMutation = useMutation({
    mutationFn: async ({ ingestionId, actionId, resolution, payload }: {
      ingestionId: string;
      actionId: string;
      resolution: 'confirm' | 'dismiss' | 'edit';
      payload?: Record<string, any>;
    }) => {
      setResolvingActionId(actionId);
      const res = await apiRequest('POST', `/api/contractor/ingestions/${ingestionId}/next-actions/${actionId}/resolve`, {
        resolution,
        payload
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/ingestions/next-actions'] });
      setResolvingActionId(null);
    },
    onError: () => {
      setResolvingActionId(null);
    }
  });
  
  // Respond to opportunity mutation
  const respondOpportunityMutation = useMutation({
    mutationFn: async ({ id, response }: { id: string; response: 'accepted' | 'dismissed' }) => {
      const res = await apiRequest('POST', `/api/contractor/ingestions/opportunities/${id}/respond`, { response });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/ingestions/opportunities'] });
    }
  });
  
  // A2.6: Ensure thread mutation
  const [threadId, setThreadId] = useState<string | null>(null);
  const ensureThreadMutation = useMutation({
    mutationFn: async (ingestionId: string) => {
      const res = await apiRequest('POST', `/api/contractor/ingestions/${ingestionId}/ensure-thread`, {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.ok && data.threadId) {
        setThreadId(data.threadId);
      }
    }
  });
  
  const classifications = classificationsData?.classifications || [];
  const opportunities = opportunitiesData?.opportunities || [];
  const durableActions = (nextActionsData?.actions || []).filter(a => a.status === 'proposed');
  
  const handleDone = () => {
    navigate('/app/contractor/onboard');
  };
  
  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (ingestionIds.length === 0) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Upload Photos
            </CardTitle>
            <CardDescription>
              Start by uploading photos of your truck, tools, or sticky notes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/app/contractor/onboard')}>
              Go to Upload
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <div className="space-y-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Here's What I Found</h1>
          </div>
          <p className="text-muted-foreground">
            Review what we detected from your photos. Accept to add to your profile.
          </p>
        </div>
        
        {classifications.length > 0 ? (
          <div className="space-y-4">
            {classifications.map((result) => (
              <ClassificationCard
                key={result.ingestionId}
                result={result}
                onAccept={() => confirmMutation.mutate(result.ingestionId)}
                onDismiss={() => dismissMutation.mutate(result.ingestionId)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No classifications found</p>
            </CardContent>
          </Card>
        )}
        
        {/* A2.6: Next Actions Workspace */}
        {durableActions.length > 0 && (
          <div className="space-y-4 mt-8" data-testid="section-next-actions">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Suggested Actions
              </h2>
              <div className="flex items-center gap-2">
                {/* Open Thread button */}
                {classifications[0]?.ingestionId && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => ensureThreadMutation.mutate(classifications[0].ingestionId)}
                    disabled={ensureThreadMutation.isPending}
                    data-testid="button-open-thread"
                  >
                    {ensureThreadMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4 mr-1" />
                    )}
                    {threadId ? 'View Thread' : 'Open Thread'}
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => refetchActions()}
                  disabled={loadingActions}
                  data-testid="button-refresh-actions"
                >
                  {loadingActions ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Based on your uploads, here are some actions you can take:
            </p>
            <div className="space-y-3">
              {durableActions.map((action) => (
                <DurableActionCard
                  key={action.id}
                  action={action}
                  onConfirm={(payload) => resolveActionMutation.mutate({
                    ingestionId: action.ingestionId,
                    actionId: action.id,
                    resolution: 'confirm',
                    payload
                  })}
                  onDismiss={() => resolveActionMutation.mutate({
                    ingestionId: action.ingestionId,
                    actionId: action.id,
                    resolution: 'dismiss'
                  })}
                  onEdit={(payload) => resolveActionMutation.mutate({
                    ingestionId: action.ingestionId,
                    actionId: action.id,
                    resolution: 'edit',
                    payload
                  })}
                  isLoading={resolvingActionId === action.id}
                />
              ))}
            </div>
          </div>
        )}
        
        <Separator className="my-6" />
        
        {opportunities.length > 0 && (
          <div className="space-y-4 mt-8">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Growth Opportunities
            </h2>
            {opportunities.slice(0, 3).map((opp) => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                onAccept={() => respondOpportunityMutation.mutate({ id: opp.id, response: 'accepted' })}
                onDismiss={() => respondOpportunityMutation.mutate({ id: opp.id, response: 'dismissed' })}
              />
            ))}
          </div>
        )}
        
        <div className="flex justify-center pt-4">
          <Button onClick={handleDone} size="lg" data-testid="button-done">
            Done
            <Check className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
