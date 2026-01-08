import { describe, it, expect } from 'vitest';
import {
  generateArticleJsonLd,
  generateHowToJsonLd,
  generateFaqPageJsonLd,
  generateInfrastructureJsonLd,
  generateOrganizationJsonLd,
  generateBreadcrumbJsonLd,
  generateContentJsonLd,
} from '../../server/lib/schema-org';

describe('Schema.org JSON-LD Generators', () => {
  describe('generateArticleJsonLd', () => {
    it('should generate valid Article JSON-LD', () => {
      const mockArticle = {
        id: 'test-123',
        title: 'Test Article',
        slug: 'test-article',
        summary: 'A test summary',
        schema_type: 'Article',
        published_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-08'),
      };
      
      const jsonLd = generateArticleJsonLd(mockArticle) as Record<string, unknown>;
      
      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('Article');
      expect(jsonLd.headline).toBe('Test Article');
      expect(jsonLd.description).toBe('A test summary');
      expect(jsonLd.datePublished).toBe('2026-01-01T00:00:00.000Z');
      expect(jsonLd.dateModified).toBe('2026-01-08T00:00:00.000Z');
    });

    it('should use portal base URL for article URL', () => {
      const mockArticle = {
        id: 'test-123',
        title: 'Test',
        slug: 'test',
        portal_base_url: 'https://example.com',
      };
      
      const jsonLd = generateArticleJsonLd(mockArticle) as Record<string, unknown>;
      expect(jsonLd['@id']).toContain('https://example.com');
    });
  });

  describe('generateHowToJsonLd', () => {
    it('should generate valid HowTo JSON-LD with steps', () => {
      const mockHowTo = {
        title: 'How to Reserve Parking',
        summary: 'Step-by-step guide to parking reservation',
        steps: [
          { name: 'Select dates', text: 'Choose your check-in and check-out dates' },
          { name: 'Pick a spot', text: 'Select an available parking spot' },
          { name: 'Confirm', text: 'Enter your details and confirm' },
        ],
      };
      
      const jsonLd = generateHowToJsonLd(mockHowTo) as Record<string, unknown>;
      
      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('HowTo');
      expect(jsonLd.name).toBe('How to Reserve Parking');
      expect(jsonLd.description).toBe('Step-by-step guide to parking reservation');
      expect(Array.isArray(jsonLd.step)).toBe(true);
      expect((jsonLd.step as unknown[]).length).toBe(3);
    });

    it('should include step positions starting from 1', () => {
      const mockHowTo = {
        title: 'Test',
        steps: [
          { name: 'Step 1', text: 'First step' },
          { name: 'Step 2', text: 'Second step' },
        ],
      };
      
      const jsonLd = generateHowToJsonLd(mockHowTo) as Record<string, unknown>;
      const steps = jsonLd.step as Array<{ position: number }>;
      
      expect(steps[0].position).toBe(1);
      expect(steps[1].position).toBe(2);
    });

    it('should include totalTime when provided', () => {
      const mockHowTo = {
        title: 'Quick Guide',
        total_time_minutes: 15,
      };
      
      const jsonLd = generateHowToJsonLd(mockHowTo) as Record<string, unknown>;
      expect(jsonLd.totalTime).toBe('PT15M');
    });
  });

  describe('generateFaqPageJsonLd', () => {
    it('should generate valid FAQPage JSON-LD', () => {
      const mockFaq = {
        title: 'Parking FAQ',
        faqs: [
          { question: 'What are check-in times?', answer: 'Check-in is at 3pm.' },
          { question: 'Can I cancel?', answer: 'Yes, with 24 hours notice.' },
        ],
      };
      
      const jsonLd = generateFaqPageJsonLd(mockFaq) as Record<string, unknown>;
      
      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('FAQPage');
      expect(Array.isArray(jsonLd.mainEntity)).toBe(true);
      expect((jsonLd.mainEntity as unknown[]).length).toBe(2);
    });

    it('should format questions and answers correctly', () => {
      const mockFaq = {
        title: 'FAQ',
        faqs: [
          { question: 'Test Question?', answer: 'Test Answer.' },
        ],
      };
      
      const jsonLd = generateFaqPageJsonLd(mockFaq) as Record<string, unknown>;
      const questions = jsonLd.mainEntity as Array<{
        '@type': string;
        name: string;
        acceptedAnswer: { '@type': string; text: string };
      }>;
      
      expect(questions[0]['@type']).toBe('Question');
      expect(questions[0].name).toBe('Test Question?');
      expect(questions[0].acceptedAnswer['@type']).toBe('Answer');
      expect(questions[0].acceptedAnswer.text).toBe('Test Answer.');
    });
  });

  describe('generateContentJsonLd (unified router)', () => {
    it('should route HowTo schema_type to HowTo generator', () => {
      const article = {
        id: 'test',
        title: 'How to Test',
        slug: 'how-to-test',
        schema_type: 'HowTo',
        steps: [{ name: 'Step', text: 'Do this' }],
      };
      
      const jsonLd = generateContentJsonLd(article) as Record<string, unknown>;
      expect(jsonLd['@type']).toBe('HowTo');
    });

    it('should route FAQPage schema_type to FAQ generator', () => {
      const article = {
        id: 'test',
        title: 'FAQ',
        slug: 'faq',
        schema_type: 'FAQPage',
        faqs: [{ question: 'Q?', answer: 'A.' }],
      };
      
      const jsonLd = generateContentJsonLd(article) as Record<string, unknown>;
      expect(jsonLd['@type']).toBe('FAQPage');
    });

    it('should default to Article for unknown schema_type', () => {
      const article = {
        id: 'test',
        title: 'Generic',
        slug: 'generic',
        schema_type: 'UnknownType',
      };
      
      const jsonLd = generateContentJsonLd(article) as Record<string, unknown>;
      expect(jsonLd['@type']).toBe('UnknownType');
    });
  });

  describe('generateInfrastructureJsonLd', () => {
    it('should generate valid Infrastructure JSON-LD', () => {
      const mockInfra = {
        id: 'infra-1',
        name: 'Victoria General Hospital',
        schema_type: 'Hospital',
        latitude: 48.4284,
        longitude: -123.3656,
        telephone: '250-555-0100',
      };
      
      const jsonLd = generateInfrastructureJsonLd(mockInfra) as Record<string, unknown>;
      
      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('Hospital');
      expect(jsonLd.name).toBe('Victoria General Hospital');
      expect(jsonLd.telephone).toBe('250-555-0100');
      expect(jsonLd.geo).toBeDefined();
    });
  });

  describe('generateOrganizationJsonLd', () => {
    it('should generate valid Organization JSON-LD', () => {
      const mockOrg = {
        id: 'org-1',
        name: 'BC Ferries',
        schema_type: 'Organization',
        website: 'https://bcferries.com',
        naics_code: '483000',
      };
      
      const jsonLd = generateOrganizationJsonLd(mockOrg) as Record<string, unknown>;
      
      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('Organization');
      expect(jsonLd.name).toBe('BC Ferries');
      expect(jsonLd.url).toBe('https://bcferries.com');
      expect(jsonLd.naics).toBe('483000');
    });
  });

  describe('generateBreadcrumbJsonLd', () => {
    it('should generate valid BreadcrumbList JSON-LD', () => {
      const items = [
        { name: 'Home', url: 'https://example.com' },
        { name: 'Parking', url: 'https://example.com/parking' },
        { name: 'Reserve', url: 'https://example.com/parking/reserve' },
      ];
      
      const jsonLd = generateBreadcrumbJsonLd(items) as Record<string, unknown>;
      
      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('BreadcrumbList');
      expect(Array.isArray(jsonLd.itemListElement)).toBe(true);
      expect((jsonLd.itemListElement as unknown[]).length).toBe(3);
    });
  });
});
