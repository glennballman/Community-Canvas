import { z } from 'zod';
import { AvailabilitySignalSchema, ScarcityBandSchema, NextActionSchema } from './availability';

const PublicItemSchema = z.object({
  assetId: z.string().uuid(),
  assetType: z.enum(['lodging', 'slip', 'parking']),
  providerTenantId: z.string().uuid(),
  providerDisplayName: z.string(),
  title: z.string(),
  availability: AvailabilitySignalSchema,
  scarcityBand: ScarcityBandSchema,
  confidence: z.number().min(0).max(1),
  nextAction: NextActionSchema,
  location: z.object({
    latitude: z.number(),
    longitude: z.number()
  }).optional()
});

const PublicCellSchema = z.object({
  date: z.string(),
  availability: AvailabilitySignalSchema,
  scarcityBand: ScarcityBandSchema
});

const PublicRowSchema = z.object({
  rowId: z.string(),
  rowType: z.enum(['provider', 'category']),
  providerTenantId: z.string().uuid(),
  providerDisplayName: z.string(),
  category: z.string(),
  items: z.array(z.object({
    assetId: z.string().uuid(),
    title: z.string(),
    cells: z.array(PublicCellSchema)
  }))
});

export const PublicPortalAvailabilityResponseSchema = z.object({
  apiVersion: z.literal('3.3'),
  portal: z.object({
    id: z.string().uuid(),
    slug: z.string()
  }),
  window: z.object({
    start: z.string(),
    end: z.string()
  }),
  results: z.array(PublicItemSchema).optional(),
  rows: z.array(PublicRowSchema).optional(),
  granularityMinutes: z.number().default(1440),
  disclosurePolicy: z.object({
    mode: z.string(),
    neverExposeCounts: z.literal(true)
  })
});

export type PublicPortalAvailabilityResponse = z.infer<typeof PublicPortalAvailabilityResponseSchema>;
export { PublicItemSchema, PublicRowSchema, PublicCellSchema };
