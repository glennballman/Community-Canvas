# PROMPT — MEDIA STORAGE SYSTEM (Images, Documents, Crawled Assets)

**Context:** Photos are critical. Contractors live on photos. A contractor takes a photo of his truck and sticky notes on his dash → he's in business. Every accommodation, parking spot, piece of equipment, job site, before/after needs photos.

**Requirements:**
1. Upload from mobile (contractor in the field)
2. Upload from desktop (admin batch uploads)
3. Capture from crawling (Firecrawl/Apify scraped images)
4. Store permanently (not hotlink)
5. Serve fast (CDN)
6. Link to ANY entity (asset, person, organization, project, article, etc.)
7. SEO-ready (alt text, schema.org ImageObject)

---

## PHASE 1: STORAGE BACKEND SELECTION

### Recommended: Cloudflare R2 (or Supabase Storage)

| Option | Pros | Cons |
|--------|------|------|
| **Cloudflare R2** | S3-compatible, no egress fees, built-in CDN, generous free tier (10GB free) | Separate service |
| **Supabase Storage** | Already using Supabase/Neon, integrated auth | May have egress costs |
| **AWS S3 + CloudFront** | Industry standard | Complex setup, egress costs |
| **Vercel Blob** | Easy if on Vercel | Vercel-specific |

**Decision:** Use **Cloudflare R2** for production (no egress fees = free image serving forever).

For MVP/dev: Can start with Supabase Storage if already configured.

### Environment Variables Needed

```env
# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=community-canvas-media
R2_PUBLIC_URL=https://media.communitycanvas.ca  # Custom domain or R2.dev URL

# OR Supabase Storage
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_key
SUPABASE_STORAGE_BUCKET=media
```

---

## PHASE 2: DATABASE SCHEMA

### 2A. Media Table (Core)

```sql
-- Media items (images, documents, videos)
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Storage
  storage_key TEXT NOT NULL,           -- Path in R2/S3: "tenants/{tenant_id}/assets/{asset_id}/{filename}"
  storage_provider TEXT NOT NULL DEFAULT 'r2',  -- 'r2', 'supabase', 's3', 'local'
  public_url TEXT NOT NULL,            -- CDN URL for serving
  
  -- File info
  filename TEXT NOT NULL,              -- Original filename
  mime_type TEXT NOT NULL,             -- image/jpeg, image/png, application/pdf
  file_size INTEGER NOT NULL,          -- Bytes
  width INTEGER,                       -- For images
  height INTEGER,                      -- For images
  
  -- Metadata
  alt_text TEXT,                       -- SEO: describes the image
  caption TEXT,                        -- Display caption
  title TEXT,                          -- Optional title
  
  -- Classification
  media_type TEXT NOT NULL DEFAULT 'image',  -- 'image', 'document', 'video'
  purpose TEXT,                        -- 'hero', 'gallery', 'thumbnail', 'proof', 'document', 'avatar'
  tags TEXT[] DEFAULT '{}',
  
  -- Source tracking
  source TEXT NOT NULL DEFAULT 'upload',  -- 'upload', 'crawl', 'import', 'ai_generated'
  source_url TEXT,                     -- If crawled, original URL
  crawl_job_id UUID,                   -- Reference to crawl job
  
  -- Processing
  processing_status TEXT DEFAULT 'complete',  -- 'pending', 'processing', 'complete', 'failed'
  variants JSONB DEFAULT '{}',         -- {"thumbnail": "url", "medium": "url", "large": "url"}
  
  -- Audit
  uploaded_by UUID,                    -- Actor who uploaded
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, storage_key)
);

CREATE INDEX idx_media_tenant ON media(tenant_id);
CREATE INDEX idx_media_type ON media(media_type, purpose);
CREATE INDEX idx_media_source ON media(source);
```

### 2B. Entity Media Links (Polymorphic)

```sql
-- Link media to ANY entity
CREATE TABLE entity_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  
  -- Polymorphic entity reference
  entity_type TEXT NOT NULL,           -- 'asset', 'person', 'organization', 'project', 'article', 'service', 'place'
  entity_id UUID NOT NULL,
  
  -- Context
  role TEXT NOT NULL DEFAULT 'gallery', -- 'hero', 'gallery', 'thumbnail', 'avatar', 'before', 'after', 'proof', 'document'
  sort_order INTEGER DEFAULT 0,
  
  -- Portal-specific (same asset, different hero per portal)
  portal_id UUID REFERENCES portals(id),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(media_id, entity_type, entity_id, role, portal_id)
);

CREATE INDEX idx_entity_media_entity ON entity_media(entity_type, entity_id);
CREATE INDEX idx_entity_media_portal ON entity_media(portal_id) WHERE portal_id IS NOT NULL;
```

### 2C. Crawl Media Queue (For Firecrawl/Apify)

```sql
-- Queue for downloading crawled images
CREATE TABLE crawl_media_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Source
  source_url TEXT NOT NULL,            -- Original image URL
  source_page_url TEXT,                -- Page it was found on
  crawl_job_id UUID,
  
  -- Target entity (what this image is for)
  entity_type TEXT,
  entity_id UUID,
  suggested_role TEXT DEFAULT 'gallery',
  
  -- Processing
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'downloading', 'processing', 'complete', 'failed', 'skipped'
  error_message TEXT,
  media_id UUID REFERENCES media(id),  -- Once processed
  
  -- Metadata extracted from crawl
  suggested_alt_text TEXT,
  page_context TEXT,                   -- Nearby text/heading
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  
  UNIQUE(source_url, entity_type, entity_id)
);

CREATE INDEX idx_crawl_media_status ON crawl_media_queue(status);
```

---

## PHASE 3: UPLOAD API

### 3A. Direct Upload Endpoint (Mobile + Desktop)

```typescript
// server/routes/media/upload.ts

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { nanoid } from 'nanoid';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// POST /api/media/upload
// Handles direct file upload with automatic optimization
export async function uploadMedia(req: Request) {
  const { tenantId, actorId } = req.context;
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const entityType = formData.get('entity_type') as string;
  const entityId = formData.get('entity_id') as string;
  const role = formData.get('role') as string || 'gallery';
  const altText = formData.get('alt_text') as string;
  
  if (!file) throw new Error('No file provided');
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('File type not allowed');
  }
  
  // Generate storage key
  const ext = file.name.split('.').pop();
  const filename = `${nanoid(12)}.${ext}`;
  const storageKey = `tenants/${tenantId}/${entityType || 'general'}/${entityId || 'misc'}/${filename}`;
  
  // Read file buffer
  const buffer = Buffer.from(await file.arrayBuffer());
  
  // Process image (resize, optimize)
  let processedBuffer = buffer;
  let width, height;
  const variants: Record<string, string> = {};
  
  if (file.type.startsWith('image/') && file.type !== 'image/gif') {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    width = metadata.width;
    height = metadata.height;
    
    // Optimize original (max 2000px, quality 85)
    processedBuffer = await image
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    // Create thumbnail (400px)
    const thumbnailBuffer = await sharp(buffer)
      .resize(400, 400, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    const thumbnailKey = storageKey.replace(filename, `thumb_${filename}`);
    await uploadToR2(thumbnailKey, thumbnailBuffer, 'image/jpeg');
    variants.thumbnail = `${process.env.R2_PUBLIC_URL}/${thumbnailKey}`;
    
    // Create medium (800px)
    const mediumBuffer = await sharp(buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    const mediumKey = storageKey.replace(filename, `medium_${filename}`);
    await uploadToR2(mediumKey, mediumBuffer, 'image/jpeg');
    variants.medium = `${process.env.R2_PUBLIC_URL}/${mediumKey}`;
  }
  
  // Upload original/processed
  await uploadToR2(storageKey, processedBuffer, file.type);
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${storageKey}`;
  
  // Save to database
  const [media] = await db.insert(mediaTable).values({
    tenant_id: tenantId,
    storage_key: storageKey,
    storage_provider: 'r2',
    public_url: publicUrl,
    filename: file.name,
    mime_type: file.type,
    file_size: processedBuffer.length,
    width,
    height,
    alt_text: altText,
    media_type: file.type.startsWith('image/') ? 'image' : 'document',
    purpose: role,
    source: 'upload',
    variants,
    uploaded_by: actorId,
  }).returning();
  
  // Link to entity if provided
  if (entityType && entityId) {
    await db.insert(entityMedia).values({
      media_id: media.id,
      entity_type: entityType,
      entity_id: entityId,
      role,
    });
  }
  
  return {
    id: media.id,
    url: publicUrl,
    thumbnail: variants.thumbnail,
    medium: variants.medium,
    width,
    height,
  };
}

async function uploadToR2(key: string, buffer: Buffer, contentType: string) {
  await r2Client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000', // 1 year cache
  }));
}
```

### 3B. Presigned URL Upload (For Large Files)

```typescript
// POST /api/media/presign
// Returns a presigned URL for direct browser-to-R2 upload
export async function getPresignedUploadUrl(req: Request) {
  const { tenantId } = req.context;
  const { filename, contentType, entityType, entityId } = req.body;
  
  const ext = filename.split('.').pop();
  const storageKey = `tenants/${tenantId}/${entityType || 'general'}/${entityId || 'misc'}/${nanoid(12)}.${ext}`;
  
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: storageKey,
    ContentType: contentType,
  });
  
  const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
  
  // Create pending media record
  const [media] = await db.insert(mediaTable).values({
    tenant_id: tenantId,
    storage_key: storageKey,
    storage_provider: 'r2',
    public_url: `${process.env.R2_PUBLIC_URL}/${storageKey}`,
    filename,
    mime_type: contentType,
    file_size: 0, // Updated after upload
    media_type: contentType.startsWith('image/') ? 'image' : 'document',
    source: 'upload',
    processing_status: 'pending',
  }).returning();
  
  return {
    upload_url: presignedUrl,
    media_id: media.id,
    public_url: media.public_url,
  };
}

// POST /api/media/:id/complete
// Called after presigned upload completes
export async function completeUpload(req: Request) {
  const { id } = req.params;
  const { entityType, entityId, role, altText } = req.body;
  
  // Get file info from R2
  const media = await db.query.media.findFirst({ where: eq(media.id, id) });
  const headResponse = await r2Client.send(new HeadObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: media.storage_key,
  }));
  
  // Process image variants (queue background job)
  await queueJob('process-media-variants', { mediaId: id });
  
  // Update record
  await db.update(mediaTable)
    .set({
      file_size: headResponse.ContentLength,
      alt_text: altText,
      processing_status: 'processing',
    })
    .where(eq(mediaTable.id, id));
  
  // Link to entity
  if (entityType && entityId) {
    await db.insert(entityMedia).values({
      media_id: id,
      entity_type: entityType,
      entity_id: entityId,
      role: role || 'gallery',
    });
  }
  
  return { success: true };
}
```

---

## PHASE 4: CRAWL INTEGRATION

### 4A. Firecrawl Image Extraction

```typescript
// server/jobs/crawl-images.ts

import { downloadImage, uploadToR2 } from '../lib/media';

// When Firecrawl returns a page, extract and queue images
export async function extractImagesFromCrawl(
  tenantId: string,
  crawlJobId: string,
  pageUrl: string,
  pageContent: any,
  entityType?: string,
  entityId?: string
) {
  // Extract image URLs from crawl result
  const images = pageContent.images || [];
  const ogImage = pageContent.metadata?.ogImage;
  
  const imageUrls = [
    ...images.map((img: any) => ({
      url: img.src || img.url,
      alt: img.alt,
      context: img.nearbyText
    })),
    ogImage && { url: ogImage, alt: pageContent.metadata?.title, context: 'og:image' }
  ].filter(Boolean);
  
  // Queue each for download
  for (const img of imageUrls) {
    await db.insert(crawlMediaQueue).values({
      tenant_id: tenantId,
      source_url: img.url,
      source_page_url: pageUrl,
      crawl_job_id: crawlJobId,
      entity_type: entityType,
      entity_id: entityId,
      suggested_role: img.url === ogImage ? 'hero' : 'gallery',
      suggested_alt_text: img.alt,
      page_context: img.context,
      status: 'pending',
    }).onConflictDoNothing();
  }
}

// Background job: process crawl media queue
export async function processCrawlMediaQueue() {
  const pending = await db.select()
    .from(crawlMediaQueue)
    .where(eq(crawlMediaQueue.status, 'pending'))
    .limit(50);
  
  for (const item of pending) {
    try {
      // Update status
      await db.update(crawlMediaQueue)
        .set({ status: 'downloading' })
        .where(eq(crawlMediaQueue.id, item.id));
      
      // Download image
      const response = await fetch(item.source_url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      // Skip if too small (likely tracking pixel)
      if (buffer.length < 5000) {
        await db.update(crawlMediaQueue)
          .set({ status: 'skipped', error_message: 'Image too small' })
          .where(eq(crawlMediaQueue.id, item.id));
        continue;
      }
      
      // Upload to R2
      const filename = `crawl_${nanoid(12)}.${contentType.split('/')[1] || 'jpg'}`;
      const storageKey = `tenants/${item.tenant_id}/crawled/${item.entity_type || 'general'}/${filename}`;
      
      // Process with sharp
      const image = sharp(buffer);
      const metadata = await image.metadata();
      
      const processedBuffer = await image
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      
      await uploadToR2(storageKey, processedBuffer, 'image/jpeg');
      
      // Create media record
      const [media] = await db.insert(mediaTable).values({
        tenant_id: item.tenant_id,
        storage_key: storageKey,
        storage_provider: 'r2',
        public_url: `${process.env.R2_PUBLIC_URL}/${storageKey}`,
        filename,
        mime_type: 'image/jpeg',
        file_size: processedBuffer.length,
        width: metadata.width,
        height: metadata.height,
        alt_text: item.suggested_alt_text,
        media_type: 'image',
        purpose: item.suggested_role,
        source: 'crawl',
        source_url: item.source_url,
        crawl_job_id: item.crawl_job_id,
      }).returning();
      
      // Link to entity
      if (item.entity_type && item.entity_id) {
        await db.insert(entityMedia).values({
          media_id: media.id,
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          role: item.suggested_role || 'gallery',
        });
      }
      
      // Update queue
      await db.update(crawlMediaQueue)
        .set({ status: 'complete', media_id: media.id, processed_at: new Date() })
        .where(eq(crawlMediaQueue.id, item.id));
      
    } catch (error) {
      await db.update(crawlMediaQueue)
        .set({ status: 'failed', error_message: error.message })
        .where(eq(crawlMediaQueue.id, item.id));
    }
  }
}
```

---

## PHASE 5: MOBILE UPLOAD UI (Contractor in Field)

### 5A. Quick Photo Capture Component

```tsx
// client/src/components/QuickPhotoCapture.tsx

export function QuickPhotoCapture({ 
  entityType, 
  entityId, 
  role = 'gallery',
  onUpload 
}: {
  entityType: string;
  entityId: string;
  role?: string;
  onUpload?: (media: Media) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Show preview immediately
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', entityType);
      formData.append('entity_id', entityId);
      formData.append('role', role);
      
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });
      
      const media = await res.json();
      onUpload?.(media);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="quick-photo-capture">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"  // Use back camera on mobile
        onChange={handleCapture}
        className="hidden"
      />
      
      <button 
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg"
        disabled={uploading}
      >
        {uploading ? (
          <Spinner />
        ) : (
          <>
            <CameraIcon className="w-5 h-5" />
            Take Photo
          </>
        )}
      </button>
      
      {preview && (
        <div className="mt-2 relative">
          <img src={preview} className="w-full max-w-xs rounded" />
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Spinner className="text-white" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 5B. Contractor Quick Start Flow

```tsx
// client/src/pages/contractor/QuickStart.tsx

// The "contractor takes photo of truck and sticky notes" flow
export function ContractorQuickStart() {
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<Media[]>([]);
  const [profile, setProfile] = useState({ name: '', phone: '', email: '' });
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {step === 1 && (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Get Started in 60 Seconds</h1>
          <p>Take a photo of your truck or van</p>
          
          <QuickPhotoCapture
            entityType="contractor_onboarding"
            entityId="pending"
            role="vehicle"
            onUpload={(m) => {
              setPhotos(prev => [...prev, m]);
              setStep(2);
            }}
          />
        </div>
      )}
      
      {step === 2 && (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Almost There!</h1>
          <p>Take a photo of your business card or license</p>
          
          <QuickPhotoCapture
            entityType="contractor_onboarding"
            entityId="pending"
            role="document"
            onUpload={(m) => {
              setPhotos(prev => [...prev, m]);
              setStep(3);
            }}
          />
          
          <button onClick={() => setStep(3)} className="text-blue-400">
            Skip for now →
          </button>
        </div>
      )}
      
      {step === 3 && (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Contact Info</h1>
          
          <input
            type="text"
            placeholder="Your name"
            value={profile.name}
            onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
            className="w-full p-3 bg-gray-800 rounded"
          />
          
          <input
            type="tel"
            placeholder="Phone number"
            value={profile.phone}
            onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
            className="w-full p-3 bg-gray-800 rounded"
          />
          
          <input
            type="email"
            placeholder="Email"
            value={profile.email}
            onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
            className="w-full p-3 bg-gray-800 rounded"
          />
          
          <button 
            onClick={handleSubmit}
            className="w-full p-4 bg-green-600 rounded-lg font-bold"
          >
            I'm Ready to Work!
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## PHASE 6: API ENDPOINTS SUMMARY

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/media/upload` | POST | Direct file upload with processing |
| `/api/media/presign` | POST | Get presigned URL for large files |
| `/api/media/:id/complete` | POST | Finalize presigned upload |
| `/api/media/:id` | GET | Get media details |
| `/api/media/:id` | DELETE | Delete media |
| `/api/entities/:type/:id/media` | GET | Get all media for entity |
| `/api/entities/:type/:id/media` | POST | Add media link to entity |
| `/api/entities/:type/:id/media/reorder` | PUT | Reorder gallery |

---

## PHASE 7: UPDATE PUBLIC SITE ENDPOINTS

### 7A. Include Media in Asset/Entity Responses

```typescript
// GET /api/public/portals/:slug/assets now includes media
{
  "assets": [
    {
      "id": "uuid",
      "name": "The Perch Cottage",
      "type": "accommodation",
      "media": {
        "hero": {
          "url": "https://media.communitycanvas.ca/...",
          "thumbnail": "https://media.communitycanvas.ca/.../thumb_...",
          "alt": "Ocean view from The Perch cottage deck"
        },
        "gallery": [
          { "url": "...", "thumbnail": "...", "alt": "..." },
          { "url": "...", "thumbnail": "...", "alt": "..." }
        ]
      }
    }
  ]
}
```

### 7B. JSON-LD ImageObject

```typescript
// In generateArticleJsonLd / generateAssetJsonLd
{
  "@type": "Accommodation",
  "name": "The Perch",
  "image": [
    {
      "@type": "ImageObject",
      "url": "https://media.communitycanvas.ca/.../hero.jpg",
      "width": 1200,
      "height": 800,
      "caption": "Ocean view from The Perch cottage deck"
    }
  ]
}
```

---

## PHASE 8: VERIFICATION

```sql
-- Verify media table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'media';

-- Verify entity_media linking table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'entity_media';

-- Count media by source
SELECT source, COUNT(*) FROM media GROUP BY source;

-- Count media by entity type
SELECT entity_type, COUNT(*) 
FROM entity_media 
GROUP BY entity_type;
```

### API Tests

```bash
# Upload test
curl -X POST "https://app.communitycanvas.ca/api/media/upload" \
  -F "file=@test.jpg" \
  -F "entity_type=asset" \
  -F "entity_id=xxx" \
  -F "role=hero"

# Get entity media
curl "https://app.communitycanvas.ca/api/entities/asset/xxx/media"
```

---

## CLOUDFLARE R2 SETUP (One-Time)

1. Create R2 bucket in Cloudflare dashboard
2. Create API token with R2 read/write permissions
3. Configure custom domain (media.communitycanvas.ca) OR use R2.dev URL
4. Set CORS rules for browser uploads
5. Add environment variables to Replit

```json
// R2 CORS configuration
[
  {
    "AllowedOrigins": ["https://communitycanvas.ca", "https://*.communitycanvas.ca", "http://localhost:*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## SUMMARY

| Feature | Implementation |
|---------|----------------|
| Storage | Cloudflare R2 (S3-compatible, no egress fees) |
| Upload | Direct + presigned URLs |
| Processing | Sharp.js (resize, optimize, variants) |
| Linking | Polymorphic entity_media table |
| Crawling | Queue + background processor |
| Mobile | Camera capture component |
| CDN | R2 built-in OR custom domain |
| SEO | schema.org ImageObject in JSON-LD |

BEGIN.
