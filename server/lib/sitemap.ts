/**
 * Sitemap generation utilities
 * 
 * Generates XML sitemaps for:
 * - Articles (per portal)
 * - Organizations
 * - Infrastructure
 * - Combined sitemap index
 */

import { serviceQuery } from '../db/tenantDb.js';

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: string;
}

export interface SitemapIndexEntry {
  loc: string;
  lastmod?: string;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate XML for a single sitemap
 */
export function generateSitemapXml(urls: SitemapEntry[]): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  const entries = urls.map(entry => {
    let xml = '  <url>\n';
    xml += `    <loc>${escapeXml(entry.loc)}</loc>\n`;
    if (entry.lastmod) xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
    if (entry.changefreq) xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
    if (entry.priority) xml += `    <priority>${entry.priority}</priority>\n`;
    xml += '  </url>';
    return xml;
  }).join('\n');

  return `${header}\n${entries}\n</urlset>`;
}

/**
 * Generate sitemap index (points to sub-sitemaps)
 */
export function generateSitemapIndexXml(sitemaps: SitemapIndexEntry[]): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  const entries = sitemaps.map(smap => {
    let xml = '  <sitemap>\n';
    xml += `    <loc>${escapeXml(smap.loc)}</loc>\n`;
    if (smap.lastmod) xml += `    <lastmod>${smap.lastmod}</lastmod>\n`;
    xml += '  </sitemap>';
    return xml;
  }).join('\n');

  return `${header}\n${entries}\n</sitemapindex>`;
}

/**
 * Fetch all active portals for sitemap
 */
export async function getPortalsForSitemap(): Promise<Array<{
  id: string;
  slug: string;
  base_url: string | null;
  name: string;
}>> {
  const result = await serviceQuery(`
    SELECT id, slug, base_url, name
    FROM portals
    WHERE status = 'active'
    ORDER BY name
  `);
  return result.rows;
}

/**
 * Fetch published articles for sitemap
 */
export async function getArticlesForSitemap(portalId?: string): Promise<Array<{
  slug: string;
  updated_at: Date | null;
  portal_id: string;
  portal_slug: string;
  portal_base_url: string | null;
}>> {
  let query = `
    SELECT 
      a.slug,
      a.updated_at,
      a.portal_id,
      p.slug as portal_slug,
      p.base_url as portal_base_url
    FROM articles a
    JOIN portals p ON p.id = a.portal_id
    WHERE a.status = 'published'
      AND a.published_at IS NOT NULL
  `;
  
  const params: string[] = [];
  if (portalId) {
    query += ` AND a.portal_id = $1`;
    params.push(portalId);
  }
  
  query += ` ORDER BY a.updated_at DESC LIMIT 5000`;
  
  const result = await serviceQuery(query, params);
  return result.rows;
}

/**
 * Fetch organizations for sitemap
 */
export async function getOrganizationsForSitemap(limit = 5000): Promise<Array<{
  id: string;
  name: string;
  updated_at: Date | null;
}>> {
  const result = await serviceQuery(`
    SELECT 
      id,
      name,
      updated_at
    FROM organizations
    ORDER BY updated_at DESC NULLS LAST
    LIMIT $1
  `, [limit]);
  return result.rows;
}

/**
 * Fetch infrastructure for sitemap (from organizations with infrastructure flag)
 */
export async function getInfrastructureForSitemap(limit = 5000): Promise<Array<{
  id: string;
  name: string;
  infrastructure_type: string | null;
  updated_at: Date | null;
}>> {
  const result = await serviceQuery(`
    SELECT 
      id,
      name,
      infrastructure_type,
      updated_at
    FROM organizations
    WHERE is_infrastructure = true
    ORDER BY updated_at DESC NULLS LAST
    LIMIT $1
  `, [limit]);
  return result.rows;
}

/**
 * Derive a valid base URL for a portal
 * Priority: base_url > slug-based URL
 * Returns null if no valid URL can be constructed
 */
function derivePortalBaseUrl(baseUrl: string | null, slug: string | null): string | null {
  // Use base_url if it exists and is valid
  if (baseUrl && baseUrl.trim()) {
    // Ensure it has a protocol
    if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
      return baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }
    return `https://${baseUrl}`.replace(/\/$/, '');
  }
  
  // Fall back to slug-based URL
  if (slug && slug.trim()) {
    return `https://${slug}.communitycanvas.ca`;
  }
  
  return null;
}

/**
 * Generate sitemap entries for articles
 */
export async function generateArticlesSitemapEntries(portalId?: string): Promise<SitemapEntry[]> {
  const articles = await getArticlesForSitemap(portalId);
  const entries: SitemapEntry[] = [];
  
  for (const article of articles) {
    const baseUrl = derivePortalBaseUrl(article.portal_base_url, article.portal_slug);
    
    // Skip entries without valid base URL
    if (!baseUrl) {
      console.warn(`[Sitemap] Skipping article ${article.slug}: no valid portal URL`);
      continue;
    }
    
    entries.push({
      loc: `${baseUrl}/articles/${article.slug}`,
      lastmod: article.updated_at?.toISOString().split('T')[0],
      changefreq: 'weekly',
      priority: '0.8',
    });
  }
  
  return entries;
}

/**
 * Generate sitemap entries for organizations
 */
export async function generateOrganizationsSitemapEntries(baseUrl = 'https://communitycanvas.ca'): Promise<SitemapEntry[]> {
  const orgs = await getOrganizationsForSitemap();
  
  return orgs.map(org => ({
    loc: `${baseUrl}/organizations/${org.id}`,
    lastmod: org.updated_at?.toISOString().split('T')[0],
    changefreq: 'monthly' as const,
    priority: '0.6',
  }));
}

/**
 * Generate sitemap entries for infrastructure
 */
export async function generateInfrastructureSitemapEntries(baseUrl = 'https://communitycanvas.ca'): Promise<SitemapEntry[]> {
  const infra = await getInfrastructureForSitemap();
  
  return infra.map(item => ({
    loc: `${baseUrl}/infrastructure/${item.id}`,
    lastmod: item.updated_at?.toISOString().split('T')[0],
    changefreq: 'monthly' as const,
    priority: '0.5',
  }));
}
