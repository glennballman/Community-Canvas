import { describe, it, expect } from 'vitest';
import { entityKindSchema, entityKindEnum } from '../../shared/schema';

describe('Entity Kind Validation', () => {
  it('should accept valid entity kinds', () => {
    const validKinds = [
      'contractor',
      'dock',
      'project',
      'community',
      'parking',
      'organization',
      'asset',
      'person',
      'article',
      'place',
    ];
    
    validKinds.forEach(kind => {
      const result = entityKindSchema.safeParse(kind);
      expect(result.success).toBe(true);
    });
  });

  it('should reject invalid entity kinds', () => {
    const invalidKinds = [
      'unknown_type',
      'PARKING',
      'foo',
      '',
      123,
      null,
    ];
    
    invalidKinds.forEach(kind => {
      const result = entityKindSchema.safeParse(kind);
      expect(result.success).toBe(false);
    });
  });

  it('should have all expected entity kinds in the enum', () => {
    const expectedKinds = [
      'contractor',
      'dock',
      'project',
      'community',
      'moorage',
      'parking',
      'infrastructure',
      'organization',
      'asset',
      'equipment',
      'service',
      'person',
      'article',
      'presentation',
      'reservation',
      'trip',
      'accommodation',
      'place',
    ];
    
    const actualKinds = entityKindEnum.enumValues;
    
    expectedKinds.forEach(kind => {
      expect(actualKinds).toContain(kind);
    });
  });

  it('should provide TypeScript-friendly enum values', () => {
    const kinds = entityKindEnum.enumValues;
    expect(Array.isArray(kinds)).toBe(true);
    expect(kinds.length).toBeGreaterThan(15);
  });
});
