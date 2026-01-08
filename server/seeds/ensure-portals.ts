import { withServiceTransaction } from '../db/tenantDb';
import { PoolClient } from 'pg';

export async function ensurePortalsExist(): Promise<void> {
  try {
    await withServiceTransaction(async (client: PoolClient) => {
      const existingCheck = await client.query(
        `SELECT id FROM portals WHERE slug = 'save-paradise-parking' LIMIT 1`
      );
      
      if (existingCheck.rows.length > 0) {
        console.log('[SEED] Portals already exist, skipping seed');
        return;
      }
      
      console.log('[SEED] Seeding portals for production...');
      
      let tenantResult = await client.query(`
        SELECT id FROM cc_tenants 
        WHERE slug = 'bamfield-operations' 
           OR slug = '1252093-bc-ltd'
           OR name ILIKE '%bamfield%'
        LIMIT 1
      `);
      
      if (tenantResult.rows.length === 0) {
        console.log('[SEED] Creating default Bamfield tenant...');
        const newTenant = await client.query(`
          INSERT INTO cc_tenants (name, slug, tenant_type, status, created_at)
          VALUES ('Bamfield Operations', 'bamfield-operations', 'business', 'active', NOW())
          RETURNING id
        `);
        tenantResult.rows.push(newTenant.rows[0]);
      }
      
      const tenantId = tenantResult.rows[0].id;
      console.log(`[SEED] Using tenant ID: ${tenantId}`);
      
      await client.query(`
        INSERT INTO portals (owning_tenant_id, name, slug, portal_type, legal_dba_name, status, primary_audience, tagline, site_config)
        VALUES ($1, 'Save Paradise Parking', 'save-paradise-parking', 'business_service', 'Save Paradise Parking', 'active', 'buyer', 'Secure parking at the gateway to Bamfield', 
          '{"brand_name": "Save Paradise Parking", "tagline": "Secure parking at the gateway to Bamfield", "hero": {"title": "Park Safe. Explore More.", "subtitle": "Secure vehicle storage while you adventure on the water"}, "primary_cta": {"label": "Reserve Your Spot", "action": "reserve"}, "theme": {"primary_color": "#2563eb", "secondary_color": "#1e40af", "accent_color": "#fbbf24"}, "contact": {"email": "info@saveparadiseparking.com"}}'::jsonb)
        ON CONFLICT (slug) DO UPDATE SET status = 'active'
      `, [tenantId]);
      console.log('[SEED] Created Save Paradise Parking portal');
      
      await client.query(`
        INSERT INTO portals (owning_tenant_id, name, slug, portal_type, legal_dba_name, status, primary_audience, tagline, site_config)
        VALUES ($1, 'Woods End Landing Cottages', 'woods-end-landing', 'business_service', 'Woods End Landing', 'active', 'buyer', 'Waterfront cottages in the heart of Bamfield',
          '{"brand_name": "Woods End Landing", "tagline": "Waterfront cottages in the heart of Bamfield", "hero": {"title": "Your Bamfield Basecamp", "subtitle": "Cozy waterfront cottages with kayaks, hot tub, and adventure at your doorstep"}, "primary_cta": {"label": "Check Availability", "action": "reserve"}, "theme": {"primary_color": "#065f46", "secondary_color": "#047857", "accent_color": "#fcd34d"}, "contact": {"email": "stay@woodsendlanding.com", "telephone": "250-728-3383"}}'::jsonb)
        ON CONFLICT (slug) DO UPDATE SET status = 'active'
      `, [tenantId]);
      console.log('[SEED] Created Woods End Landing portal');
      
      await client.query(`
        INSERT INTO portals (owning_tenant_id, name, slug, portal_type, legal_dba_name, status, primary_audience, tagline, site_config)
        VALUES ($1, 'Bamfield Adventure Center', 'bamfield-adventure', 'business_service', 'Bamfield Adventure Center', 'active', 'buyer', 'Tours and rentals in Bamfield',
          '{"brand_name": "Bamfield Adventure Center", "tagline": "Tours and rentals in Bamfield", "hero": {"title": "Adventure Awaits", "subtitle": "Kayak rentals, fishing charters, and guided tours"}, "primary_cta": {"label": "Book Now", "action": "reserve"}, "theme": {"primary_color": "#0891b2", "secondary_color": "#0e7490", "accent_color": "#fcd34d"}}'::jsonb)
        ON CONFLICT (slug) DO UPDATE SET status = 'active'
      `, [tenantId]);
      console.log('[SEED] Created Bamfield Adventure Center portal');
      
      await client.query(`
        INSERT INTO portals (owning_tenant_id, name, slug, portal_type, legal_dba_name, status, primary_audience, tagline, site_config)
        VALUES ($1, 'Bamfield Community Portal', 'bamfield', 'community', 'Bamfield Community', 'active', 'buyer', 'Your connection to Bamfield BC',
          '{"brand_name": "Bamfield Community", "tagline": "Your connection to Bamfield BC", "hero": {"title": "Welcome to Bamfield", "subtitle": "Gateway to the Pacific Rim"}, "theme": {"primary_color": "#166534", "secondary_color": "#15803d", "accent_color": "#fbbf24"}}'::jsonb)
        ON CONFLICT (slug) DO UPDATE SET status = 'active'
      `, [tenantId]);
      console.log('[SEED] Created Bamfield Community Portal');

      let tenant1252093Result = await client.query(`
        SELECT id FROM cc_tenants WHERE slug = '1252093-bc-ltd' LIMIT 1
      `);
      
      let tenant1252093Id = tenant1252093Result.rows[0]?.id;
      if (!tenant1252093Id) {
        console.log('[SEED] Creating 1252093 BC LTD tenant...');
        const newTenant = await client.query(`
          INSERT INTO cc_tenants (name, slug, tenant_type, status, created_at)
          VALUES ('1252093 BC LTD', '1252093-bc-ltd', 'business', 'active', NOW())
          RETURNING id
        `);
        tenant1252093Id = newTenant.rows[0].id;
      }
      
      await client.query(`
        INSERT INTO portals (owning_tenant_id, name, slug, portal_type, legal_dba_name, status, primary_audience, tagline)
        VALUES ($1, 'Enviropaving BC', 'enviropaving', 'business_service', 'Enviropaving BC', 'active', 'buyer', 'Eco-friendly paving solutions for BC communities')
        ON CONFLICT (slug) DO UPDATE SET status = 'active'
      `, [tenant1252093Id]);
      
      await client.query(`
        INSERT INTO portals (owning_tenant_id, name, slug, portal_type, legal_dba_name, status, primary_audience, tagline)
        VALUES ($1, 'Remote Serve', 'remote-serve', 'business_service', 'Remote Serve', 'active', 'buyer', 'Reliable services for remote BC communities')
        ON CONFLICT (slug) DO UPDATE SET status = 'active'
      `, [tenant1252093Id]);
      
      await client.query(`
        INSERT INTO portals (owning_tenant_id, name, slug, portal_type, legal_dba_name, status, primary_audience, tagline)
        VALUES ($1, 'Enviro Bright Lights', 'enviro-bright', 'business_service', 'Enviro Bright Lights', 'active', 'buyer', 'Sustainable lighting solutions')
        ON CONFLICT (slug) DO UPDATE SET status = 'active'
      `, [tenant1252093Id]);
      console.log('[SEED] Created 1252093 BC LTD portals (Enviropaving, Remote Serve, Enviro Bright)');

      const countResult = await client.query(`SELECT COUNT(*) as count FROM portals`);
      console.log(`[SEED] Portal seeding complete. Total portals: ${countResult.rows[0].count}`);
    });
  } catch (error) {
    console.error('[SEED] Error seeding portals:', error);
  }
}
