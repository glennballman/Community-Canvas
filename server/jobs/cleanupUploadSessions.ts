import { serviceQuery } from '../db/tenantDb';

interface CleanupResult {
  sessionsFound: number;
  sessionsDeleted: number;
  mediaMarked: number;
  errors: string[];
}

export async function cleanupAbandonedUploadSessions(dryRun = false): Promise<CleanupResult> {
  const result: CleanupResult = {
    sessionsFound: 0,
    sessionsDeleted: 0,
    mediaMarked: 0,
    errors: []
  };

  try {
    const expiredSessions = await serviceQuery(`
      SELECT 
        s.id, s.purpose, s.expires_at, s.used_at,
        COUNT(m.id) as media_count
      FROM cc_public_upload_sessions s
      LEFT JOIN cc_public_upload_session_media m ON m.session_id = s.id
      WHERE s.expires_at < now()
        AND s.used_at IS NULL
      GROUP BY s.id
      ORDER BY s.expires_at ASC
      LIMIT 1000
    `);

    result.sessionsFound = expiredSessions.rows.length;

    if (dryRun) {
      console.log(`[Cleanup] DRY RUN: Would process ${result.sessionsFound} expired sessions`);
      for (const session of expiredSessions.rows) {
        console.log(`  - Session ${session.id}: ${session.media_count} media files, expired ${session.expires_at}`);
      }
      return result;
    }

    for (const session of expiredSessions.rows) {
      try {
        const mediaResult = await serviceQuery(`
          SELECT id, media_id, f2_key FROM cc_public_upload_session_media
          WHERE session_id = $1
        `, [session.id]);

        for (const media of mediaResult.rows) {
          if (media.media_id) {
            await serviceQuery(`
              UPDATE cc_media 
              SET garbage_collect_after = now() + interval '7 days'
              WHERE id = $1 
                AND garbage_collect_after IS NULL
            `, [media.media_id]);
            result.mediaMarked++;
          }
        }

        await serviceQuery(`
          DELETE FROM cc_public_upload_session_media WHERE session_id = $1
        `, [session.id]);

        await serviceQuery(`
          DELETE FROM cc_public_upload_sessions WHERE id = $1
        `, [session.id]);

        result.sessionsDeleted++;
      } catch (err: any) {
        result.errors.push(`Session ${session.id}: ${err.message}`);
      }
    }

    console.log(`[Cleanup] Completed: ${result.sessionsDeleted}/${result.sessionsFound} sessions cleaned, ${result.mediaMarked} media marked for GC`);
    if (result.errors.length > 0) {
      console.warn(`[Cleanup] Errors:`, result.errors);
    }

  } catch (err: any) {
    console.error('[Cleanup] Fatal error:', err);
    result.errors.push(`Fatal: ${err.message}`);
  }

  return result;
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`[Cleanup] Starting ${dryRun ? 'DRY RUN' : 'live cleanup'}...`);
  
  cleanupAbandonedUploadSessions(dryRun)
    .then((result) => {
      console.log('[Cleanup] Result:', JSON.stringify(result, null, 2));
      process.exit(result.errors.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('[Cleanup] Unhandled error:', err);
      process.exit(1);
    });
}
