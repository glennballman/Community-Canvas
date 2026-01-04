import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireTenant } from '../middleware/guards';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ok = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ].includes(file.mimetype);
  if (ok) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 80 * 1024 * 1024 }
});

router.post('/', requireAuth, requireTenant, upload.single('file'), async (req, res) => {
  const file = (req as any).file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/${file.filename}`;
  res.json({ url, mimetype: file.mimetype, originalname: file.originalname, size: file.size });
});

export default router;
