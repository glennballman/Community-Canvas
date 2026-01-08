/**
 * JSON-LD generation for schema.org compliance
 * 
 * Provides structured data generation for:
 * - Articles (with multiple schema.org types)
 * - Infrastructure cc_entities
 * - Organizations
 * - HowTo guides and tutorials
 * - FAQPage for FAQ sections
 * - Breadcrumbs for navigation
 * - WebSite for portal homepages
 */

export interface ArticleForJsonLd {
  id: string;
  title: string;
  subtitle?: string | null;
  summary?: string | null;
  meta_description?: string | null;
  slug: string;
  schema_type?: string | null;
  content_type?: string | null;
  published_at?: Date | null;
  updated_at?: Date | null;
  featured_image_url?: string | null;
  canonical_url?: string | null;
  author_name?: string | null;
  reading_time_minutes?: number | null;
  portal_name?: string | null;
  portal_base_url?: string | null;
  cc_entity_links?: Array<{
    entity_kind: string;
    entity_id: string;
    entity_name?: string | null;
    relation?: string | null;
  }>;
}

export interface InfrastructureForJsonLd {
  id: string;
  name: string;
  schema_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  telephone?: string | null;
  website?: string | null;
  description?: string | null;
}

export interface OrganizationForJsonLd {
  id: string;
  name: string;
  schema_type?: string | null;
  website?: string | null;
  telephone?: string | null;
  address?: string | null;
  naics_code?: string | null;
  logo_url?: string | null;
}

/**
 * Map entity kinds to schema.org types
 */
function mapEntityKindToSchemaType(entityKind: string): string {
  const mapping: Record<string, string> = {
    'place': 'Place',
    'community': 'Place',
    'organization': 'Organization',
    'contractor': 'LocalBusiness',
    'dock': 'CivicStructure',
    'moorage': 'BoatTerminal',
    'parking': 'ParkingFacility',
    'asset': 'Product',
    'project': 'Project',
    'event': 'Event',
    'person': 'Person',
    'infrastructure': 'CivicStructure',
    'airport': 'Airport',
    'hospital': 'Hospital',
    'fire_station': 'FireStation',
    'police_station': 'PoliceStation',
    'school': 'School',
    'bus_station': 'BusStation',
    'pharmacy': 'Pharmacy',
    'government_office': 'GovernmentOffice',
  };
  return mapping[entityKind] || 'Thing';
}

/**
 * Generate JSON-LD for an article
 */
export function generateArticleJsonLd(article: ArticleForJsonLd): object {
  const baseUrl = article.portal_base_url || 'https://communitycanvas.ca';
  const articleUrl = article.canonical_url || `${baseUrl}/cc_articles/${article.slug}`;
  
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': article.schema_type || 'Article',
    '@id': articleUrl,
    headline: article.title,
    description: article.meta_description || article.summary || article.subtitle || article.title,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
  };

  // Dates
  if (article.published_at) {
    jsonLd.datePublished = article.published_at.toISOString();
  }
  if (article.updated_at) {
    jsonLd.dateModified = article.updated_at.toISOString();
  }

  // Image
  if (article.featured_image_url) {
    jsonLd.image = {
      '@type': 'ImageObject',
      url: article.featured_image_url,
    };
  }

  // Author
  if (article.author_name) {
    jsonLd.author = {
      '@type': 'Person',
      name: article.author_name,
    };
  }

  // Reading time (as timeRequired for HowTo/Guide types)
  if (article.reading_time_minutes) {
    jsonLd.timeRequired = `PT${article.reading_time_minutes}M`;
  }

  // Publisher (the portal)
  jsonLd.publisher = {
    '@type': 'Organization',
    name: article.portal_name || 'Community Canvas',
    url: baseUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${baseUrl}/logo.png`,
    },
  };

  // Entity links as "about" and "mentions" references
  if (article.cc_entity_links && article.cc_entity_links.length > 0) {
    const aboutLinks = article.cc_entity_links
      .filter(link => link.relation === 'about' || link.relation === 'featured')
      .map(link => ({
        '@type': mapEntityKindToSchemaType(link.entity_kind),
        name: link.entity_name || link.entity_kind,
        '@id': `${baseUrl}/${link.entity_kind}/${link.entity_id}`,
      }));
    
    if (aboutLinks.length > 0) {
      jsonLd.about = aboutLinks;
    }
    
    const mentionLinks = article.cc_entity_links
      .filter(link => link.relation === 'mentions')
      .map(link => ({
        '@type': mapEntityKindToSchemaType(link.entity_kind),
        name: link.entity_name || link.entity_kind,
        '@id': `${baseUrl}/${link.entity_kind}/${link.entity_id}`,
      }));
    
    if (mentionLinks.length > 0) {
      jsonLd.mentions = mentionLinks;
    }
  }

  return jsonLd;
}

/**
 * Generate JSON-LD for infrastructure cc_entities
 */
export function generateInfrastructureJsonLd(entity: InfrastructureForJsonLd): object {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': entity.schema_type || 'CivicStructure',
    name: entity.name,
  };

  if (entity.description) jsonLd.description = entity.description;
  if (entity.telephone) jsonLd.telephone = entity.telephone;
  if (entity.website) jsonLd.url = entity.website;
  
  if (entity.latitude && entity.longitude) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude: entity.latitude,
      longitude: entity.longitude,
    };
  }

  if (entity.address) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      streetAddress: entity.address,
    };
  }

  return jsonLd;
}

/**
 * Generate JSON-LD for cc_organizations
 */
export function generateOrganizationJsonLd(org: OrganizationForJsonLd): object {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': org.schema_type || 'Organization',
    name: org.name,
  };

  if (org.website) jsonLd.url = org.website;
  if (org.telephone) jsonLd.telephone = org.telephone;
  if (org.naics_code) jsonLd.naics = org.naics_code;
  
  if (org.logo_url) {
    jsonLd.logo = {
      '@type': 'ImageObject',
      url: org.logo_url,
    };
  }

  if (org.address) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      streetAddress: org.address,
    };
  }

  return jsonLd;
}

/**
 * Generate BreadcrumbList JSON-LD for navigation
 */
export function generateBreadcrumbJsonLd(items: Array<{ name: string; url: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Generate WebSite JSON-LD for portal homepage
 */
export function generateWebSiteJsonLd(portal: {
  name: string;
  base_url: string;
  description?: string | null;
  search_url?: string | null;
}): object {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: portal.name,
    url: portal.base_url,
  };

  if (portal.description) {
    jsonLd.description = portal.description;
  }

  // Add SearchAction if portal has search
  if (portal.search_url) {
    jsonLd.potentialAction = {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${portal.search_url}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    };
  }

  return jsonLd;
}

// ============================================================================
// HOWTO AND FAQ JSON-LD GENERATORS
// ============================================================================

export interface HowToStep {
  name: string;
  text: string;
  image_url?: string | null;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface HowToArticle {
  title: string;
  summary?: string | null;
  featured_image_url?: string | null;
  total_time_minutes?: number | null;
  steps?: HowToStep[];
}

export interface FaqPageArticle {
  title: string;
  faqs?: FaqItem[];
}

/**
 * Generate HowTo JSON-LD for guides, tutorials, and instructions
 */
export function generateHowToJsonLd(article: HowToArticle): object {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: article.title,
  };

  if (article.summary) {
    jsonLd.description = article.summary;
  }

  if (article.featured_image_url) {
    jsonLd.image = {
      '@type': 'ImageObject',
      url: article.featured_image_url,
    };
  }

  if (article.total_time_minutes) {
    jsonLd.totalTime = `PT${article.total_time_minutes}M`;
  }

  if (article.steps && article.steps.length > 0) {
    jsonLd.step = article.steps.map((step, index) => {
      const stepJsonLd: Record<string, unknown> = {
        '@type': 'HowToStep',
        position: index + 1,
        name: step.name,
        itemListElement: {
          '@type': 'HowToDirection',
          text: step.text,
        },
      };

      if (step.image_url) {
        stepJsonLd.image = {
          '@type': 'ImageObject',
          url: step.image_url,
        };
      }

      return stepJsonLd;
    });
  }

  return jsonLd;
}

/**
 * Generate FAQPage JSON-LD for FAQ sections
 */
export function generateFaqPageJsonLd(article: FaqPageArticle): object {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
  };

  if (article.faqs && article.faqs.length > 0) {
    jsonLd.mainEntity = article.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    }));
  }

  return jsonLd;
}

/**
 * Unified JSON-LD generator that routes based on schema_type
 */
export function generateContentJsonLd(article: ArticleForJsonLd & {
  steps?: HowToStep[];
  faqs?: FaqItem[];
  total_time_minutes?: number | null;
}): object {
  switch (article.schema_type) {
    case 'HowTo':
      return generateHowToJsonLd({
        title: article.title,
        summary: article.summary,
        featured_image_url: article.featured_image_url,
        total_time_minutes: article.total_time_minutes || article.reading_time_minutes,
        steps: article.steps,
      });

    case 'FAQPage':
      return generateFaqPageJsonLd({
        title: article.title,
        faqs: article.faqs,
      });

    case 'NewsArticle':
    case 'BlogPosting':
    case 'Article':
    default:
      return generateArticleJsonLd(article);
  }
}
