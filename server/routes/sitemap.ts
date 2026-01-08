/**
 * Sitemap API Routes
 * 
 * Provides XML sitemaps for SEO:
 * - /sitemap.xml - Sitemap index (portal-aware: main domain shows index, portal domains show portal sitemap)
 * - /sitemap-articles.xml - All published articles (or portal-specific if on portal domain)
 * - /sitemap-organizations.xml - All organizations
 * - /sitemap-infrastructure.xml - All infrastructure entities
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
 * 1. Exact match in portal_domains table
 * 2. Match against portals.base_url (for custom domains)
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
  
  // 1. Check portal_domains table for exact match
  const domainResult = await serviceQuery(`
    SELECT p.id, p.slug, p.base_url, p.name
    FROM portals p
    JOIN portal_domains pd ON pd.portal_id = p.id
    WHERE LOWER(pd.domain) = $1 AND p.status = 'active'
    LIMIT 1
  `, [hostname]);
  
  if (domainResult.rows.length > 0) {
    return domainResult.rows[0];
  }
  
  // 2. Check portals.base_url for custom domain match
  // Extract hostname from base_url and compare
  const baseUrlResult = await serviceQuery(`
    SELECT id, slug, base_url, name
    FROM portals
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
      FROM portals
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
 * On portal domain: returns sitemap with only that portal's articles
 */
router.get('/sitemap.xml', async (req: Request, res: Response) => {
  try {
    const host = req.get('host');
    const portal = await resolvePortalFromHost(host);
    
    if (portal) {
      // Portal-specific sitemap: return only this portal's articles
      const entries = await generateArticlesSitemapEntries(portal.id);
      const xml = generateSitemapXml(entries);
      
      res.set('Content-Type', 'application/xml');
      res.set('Cache-Control', CACHE_CONTROL);
      res.set('Vary', VARY_HEADERS);
      res.send(xml);
      return;
    }
    
    // Main domain: return sitemap index
    const portals = await getPortalsForSitemap();
    const now = new Date().toISOString().split('T')[0];
    const baseUrl = process.env.BASE_URL || 'https://communitycanvas.ca';

    const sitemaps = [
      { loc: `${baseUrl}/sitemap-articles.xml`, lastmod: now },
      { loc: `${baseUrl}/sitemap-organizations.xml`, lastmod: now },
      { loc: `${baseUrl}/sitemap-infrastructure.xml`, lastmod: now },
    ];

    // Add per-portal sitemaps
    for (const p of portals) {
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
 * GET /sitemap-articles.xml - Articles sitemap (all portals for main domain)
 */
router.get('/sitemap-articles.xml', async (req: Request, res: Response) => {
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
    console.error('[Sitemap] Error generating articles sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

/**
 * GET /sitemap-organizations.xml - Organizations sitemap
 */
router.get('/sitemap-organizations.xml', async (_req: Request, res: Response) => {
  try {
    const baseUrl = process.env.BASE_URL || 'https://communitycanvas.ca';
    const entries = await generateOrganizationsSitemapEntries(baseUrl);
    const xml = generateSitemapXml(entries);

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', CACHE_CONTROL);
    res.set('Vary', VARY_HEADERS);
    res.send(xml);
  } catch (error) {
    console.error('[Sitemap] Error generating organizations sitemap:', error);
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
