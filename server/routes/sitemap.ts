/**
 * Sitemap API Routes
 * 
 * Provides XML sitemaps for SEO:
 * - /sitemap.xml - Sitemap index (portal-aware: main domain shows index, portal domains show portal sitemap)
 * - /sitemap-cc_articles.xml - All published cc_articles (or portal-specific if on portal domain)
 * - /sitemap-cc_organizations.xml - All cc_organizations
 * - /sitemap-infrastructure.xml - All infrastructure cc_entities
 */

import { Router, Request, Response } from 'express';
import {
  generateSitemapXml,
  generateSitemapIndexXml,
  getPortalsForSitemap,
  generateArticlesSitemapEntries,
  generateOrganizationsSitemapEntries,
  generateInfrastructureSitemapEntries,
} from '../lib/sitemap.js';
import { serviceQuery } from '../db/tenantDb.js';

const router = Router();

const CACHE_CONTROL = 'public, max-age=3600'; // 1 hour cache
const VARY_HEADERS = 'Host, X-Forwarded-Host'; // Prevent CDN serving cross-tenant sitemaps

/**
 * Normalize hostname for comparison (strip www, protocol, port)
 */
function normalizeHostname(host: string): string {
  let normalized = host.toLowerCase();
  // Remove port
  normalized = normalized.split(':')[0];
  // Remove www prefix
  if (normalized.startsWith('www.')) {
    normalized = normalized.substring(4);
  }
  return normalized;
}

/**
 * Resolve portal from host header
 * Returns portal info if the host is a portal domain, null for main domain
 * 
 * Resolution order:
 * 1. Exact match in cc_portal_domains table
 * 2. Match against cc_portals.base_url (for custom domains)
 * 3. Subdomain pattern match (e.g., portalslug.communitycanvas.ca)
 */
async function resolvePortalFromHost(host: string | undefined): Promise<{
  id: string;
  slug: string;
  base_url: string | null;
  name: string;
} | null> {
  if (!host) return null;
  
  const hostname = normalizeHostname(host);
  
  // Skip main domain
  if (hostname === 'communitycanvas.ca' || hostname.includes('localhost')) {
    return null;
  }
  
  // 1. Check cc_portal_domains table for exact match
  const domainResult = await serviceQuery(`
    SELECT p.id, p.slug, p.base_url, p.name
    FROM cc_portals p
    JOIN cc_portal_domains pd ON pd.portal_id = p.id
    WHERE LOWER(pd.domain) = $1 AND p.status = 'active'
    LIMIT 1
  `, [hostname]);
  
  if (domainResult.rows.length > 0) {
    return domainResult.rows[0];
  }
  
  // 2. Check cc_portals.base_url for custom domain match
  // Extract hostname from base_url and compare
  const baseUrlResult = await serviceQuery(`
    SELECT id, slug, base_url, name
    FROM cc_portals
    WHERE status = 'active'
      AND base_url IS NOT NULL
      AND (
        LOWER(REGEXP_REPLACE(base_url, '^https?://(www\\.)?', '')) = $1
        OR LOWER(REGEXP_REPLACE(base_url, '^https?://(www\\.)?', '')) LIKE $1 || '/%'
      )
    LIMIT 1
  `, [hostname]);
  
  if (baseUrlResult.rows.length > 0) {
    return baseUrlResult.rows[0];
  }
  
  // 3. Try subdomain pattern (e.g., portalslug.communitycanvas.ca)
  const subdomainMatch = hostname.match(/^([^.]+)\.(?:communitycanvas\.ca|replit\.app|replit\.dev)$/);
  if (subdomainMatch) {
    const slug = subdomainMatch[1];
    const slugResult = await serviceQuery(`
      SELECT id, slug, base_url, name
      FROM cc_portals
      WHERE slug = $1 AND status = 'active'
      LIMIT 1
    `, [slug]);
    
    if (slugResult.rows.length > 0) {
      return slugResult.rows[0];
    }
  }
  
  return null;
}

/**
 * GET /sitemap.xml - Main sitemap index or portal-specific sitemap
 * 
 * On main domain: returns sitemap index pointing to sub-sitemaps and portal sitemaps
 * On portal domain: returns sitemap with only that portal's cc_articles
 */
router.get('/sitemap.xml', async (req: Request, res: Response) => {
  try {
    const host = req.get('host');
    const portal = await resolvePortalFromHost(host);
    
    if (portal) {
      // Portal-specific sitemap: return only this portal's cc_articles
      const entries = await generateArticlesSitemapEntries(portal.id);
      const xml = generateSitemapXml(entries);
      
      res.set('Content-Type', 'application/xml');
      res.set('Cache-Control', CACHE_CONTROL);
      res.set('Vary', VARY_HEADERS);
      res.send(xml);
      return;
    }
    
    // Main domain: return sitemap index
    const cc_portals = await getPortalsForSitemap();
    const now = new Date().toISOString().split('T')[0];
    const baseUrl = process.env.BASE_URL || 'https://communitycanvas.ca';

    const sitemaps = [
      { loc: `${baseUrl}/sitemap-cc_articles.xml`, lastmod: now },
      { loc: `${baseUrl}/sitemap-cc_organizations.xml`, lastmod: now },
      { loc: `${baseUrl}/sitemap-infrastructure.xml`, lastmod: now },
    ];

    // Add per-portal sitemaps
    for (const p of cc_portals) {
      const portalUrl = p.base_url || `https://${p.slug}.communitycanvas.ca`;
      sitemaps.push({ loc: `${portalUrl}/sitemap.xml`, lastmod: now });
    }

    const xml = generateSitemapIndexXml(sitemaps);

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', CACHE_CONTROL);
    res.set('Vary', VARY_HEADERS);
    res.send(xml);
  } catch (error) {
    console.error('[Sitemap] Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

/**
 * GET /sitemap-cc_articles.xml - Articles sitemap (all cc_portals for main domain)
 */
router.get('/sitemap-cc_articles.xml', async (req: Request, res: Response) => {
  try {
    const host = req.get('host');
    const portal = await resolvePortalFromHost(host);
    
    // If on portal domain, filter to that portal; otherwise return all
    const entries = await generateArticlesSitemapEntries(portal?.id);
    const xml = generateSitemapXml(entries);

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', CACHE_CONTROL);
    res.set('Vary', VARY_HEADERS);
    res.send(xml);
  } catch (error) {
    console.error('[Sitemap] Error generating cc_articles sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

/**
 * GET /sitemap-cc_organizations.xml - Organizations sitemap
 */
router.get('/sitemap-cc_organizations.xml', async (_req: Request, res: Response) => {
  try {
    const baseUrl = process.env.BASE_URL || 'https://communitycanvas.ca';
    const entries = await generateOrganizationsSitemapEntries(baseUrl);
    const xml = generateSitemapXml(entries);

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', CACHE_CONTROL);
    res.set('Vary', VARY_HEADERS);
    res.send(xml);
  } catch (error) {
    console.error('[Sitemap] Error generating cc_organizations sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

/**
 * GET /sitemap-infrastructure.xml - Infrastructure sitemap
 */
router.get('/sitemap-infrastructure.xml', async (_req: Request, res: Response) => {
  try {
    const baseUrl = process.env.BASE_URL || 'https://communitycanvas.ca';
    const entries = await generateInfrastructureSitemapEntries(baseUrl);
    const xml = generateSitemapXml(entries);

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', CACHE_CONTROL);
    res.set('Vary', VARY_HEADERS);
    res.send(xml);
  } catch (error) {
    console.error('[Sitemap] Error generating infrastructure sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

export default router;
