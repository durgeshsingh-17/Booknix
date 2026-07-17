import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(new Error('Only JPEG, PNG, WEBP, or AVIF images are allowed'));
    return;
  }
  cb(null, true);
}

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

export const UPLOADS_DIR = UPLOAD_ROOT;
