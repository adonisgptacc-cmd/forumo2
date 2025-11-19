import type { Express } from 'express';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface StoredObjectReference {
  bucket: string;
  key: string;
  url: string;
}

@Injectable()
export class StorageService {
  private readonly bucket = process.env.UPLOADS_BUCKET ?? 'local-dev';
  private readonly uploadsRoot = path.resolve(process.cwd(), 'uploads');

  async saveListingImage(listingId: string, file: Express.Multer.File): Promise<StoredObjectReference> {
    const key = path.join('listings', listingId, `${Date.now()}-${randomUUID()}-${file.originalname}`);
    return this.persistFile(key, file);
  }

  async saveMessageAttachment(threadId: string, file: Express.Multer.File): Promise<StoredObjectReference> {
    const key = path.join('messages', threadId, `${Date.now()}-${randomUUID()}-${file.originalname}`);
    return this.persistFile(key, file);
  }

  private async persistFile(key: string, file: Express.Multer.File): Promise<StoredObjectReference> {
    const filePath = path.join(this.uploadsRoot, this.bucket, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, file.buffer);

    return {
      bucket: this.bucket,
      key: key.replace(/\\/g, '/'),
      url: `s3://${this.bucket}/${key.replace(/\\/g, '/')}`,
    };
  }
}
