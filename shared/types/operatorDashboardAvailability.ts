import { z } from 'zod';
import { 
  AvailabilitySignalSchema, 
  ScarcityBandSchema, 
  NextActionSchema,
  SourceVisibilitySchema 
} from './availability';

const LocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number()
});

const WebcamSchema = z.object({
  entityId: z.number(),
  title: z.string(),
  availability: AvailabilitySignalSchema.optional()
});

const CellSchema = z.object({
  date: z.string(),
  availability: AvailabilitySignalSchema,
  scarcityBand: ScarcityBandSchema,
  truthAvailability: AvailabilitySignalSchema.optional(),
  nextAction: NextActionSchema,
  reasons: z.array(z.string()).optional()
});

const ItemSchema = z.object({
  assetId: z.string().uuid(),
  assetType: z.enum(['lodging', 'slip', 'parking', 'segment', 'room']),
  title: z.string(),
  location: LocationSchema.optional(),
  
  availability: AvailabilitySignalSchema,
  scarcityBand: ScarcityBandSchema,
  confidence: z.number().min(0).max(1),
  nextAction: NextActionSchema,
  
  sourceVisibility: SourceVisibilitySchema.optional(),
  truthAvailability: AvailabilitySignalSchema.optional(),
  reasons: z.array(z.string()).optional(),
  operatorNotes: z.array(z.string()).optional(),
  
  cells: z.array(CellSchema).optional(),
  webcams: z.array(WebcamSchema).optional()
});

const RowSchema = z.object({
  rowId: z.string(),
  rowType: z.enum(['provider', 'category', 'facility']),
  providerTenantId: z.string().uuid(),
  providerDisplayName: z.string(),
  category: z.string(),
  items: z.array(ItemSchema)
});

const MapMarkerSchema = z.object({
  markerId: z.string(),
  providerTenantId: z.string().uuid(),
  label: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  categorySignals: z.array(z.object({
    category: z.string(),
    availability: AvailabilitySignalSchema,
    scarcityBand: ScarcityBandSchema
  }))
});

const IncidentSummarySchema = z.object({
  id: z.string().uuid(),
  incidentNumber: z.string(),
  status: z.string(),
  incidentType: z.string(),
  severity: z.string(),
  location: LocationSchema.optional(),
  createdAt: z.string()
});

const DisclosurePolicySchema = z.object({
  mode: z.string(),
  neverExposeCounts: z.literal(true)
});

export const OperatorDashboardAvailabilityResponseSchema = z.object({
  apiVersion: z.literal('3.3'),
  traceId: z.string(),
  portal: z.object({
    id: z.string().uuid(),
    slug: z.string(),
    communityId: z.string().uuid()
  }),
  window: z.object({
    start: z.string(),
    end: z.string()
  }),
  filtersEcho: z.object({
    types: z.array(z.string()).optional(),
    view: z.string().optional(),
    includeTruthOnly: z.boolean().optional()
  }).optional(),
  granularityMinutes: z.number().default(1440),
  rows: z.array(RowSchema),
  map: z.object({
    markers: z.array(MapMarkerSchema)
  }).optional(),
  incidents: z.array(IncidentSummarySchema).optional(),
  disclosurePolicy: DisclosurePolicySchema
});

export type OperatorDashboardAvailabilityResponse = z.infer<typeof OperatorDashboardAvailabilityResponseSchema>;
export { ItemSchema, RowSchema, CellSchema, MapMarkerSchema, IncidentSummarySchema };
