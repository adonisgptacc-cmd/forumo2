import type { Express } from 'express';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface StoredObjectReference {
  bucket: string;
  key: string;
  url: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket = process.env.UPLOADS_BUCKET ?? 'local-dev';
  private readonly uploadsRoot = path.resolve(process.cwd(), 'uploads');
  private readonly s3: S3Client | null;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT;
    if (endpoint) {
      const port = process.env.MINIO_PORT ?? '9000';
      const useSsl = process.env.MINIO_USE_SSL === 'true';
      const scheme = useSsl ? 'https' : 'http';
      this.s3 = new S3Client({
        endpoint: `${scheme}://${endpoint}:${port}`,
        region: process.env.AWS_REGION ?? 'us-east-1',
        credentials: {
          accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
          secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
        },
        forcePathStyle: true, // required for MinIO path-style addressing
      });
    } else {
      this.s3 = null;
    }
  }

  async saveListingImage(listingId: string, file: Express.Multer.File): Promise<StoredObjectReference> {
    const key = `listings/${listingId}/${Date.now()}-${randomUUID()}-${file.originalname}`;
    return this.persistFile(key, file);
  }

  async saveMessageAttachment(threadId: string, file: Express.Multer.File): Promise<StoredObjectReference> {
    const key = `messages/${threadId}/${Date.now()}-${randomUUID()}-${file.originalname}`;
    return this.persistFile(key, file);
  }

  async saveKycDocument(userId: string, file: Express.Multer.File): Promise<StoredObjectReference> {
    const key = `kyc/${userId}/${Date.now()}-${randomUUID()}-${file.originalname}`;
    return this.persistFile(key, file);
  }

  private async persistFile(key: string, file: Express.Multer.File): Promise<StoredObjectReference> {
    if (this.s3) {
      return this.persistToS3(key, file);
    }
    return this.persistToLocal(key, file);
  }

  private async persistToS3(key: string, file: Express.Multer.File): Promise<StoredObjectReference> {
    await this.s3!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    const endpoint = process.env.MINIO_ENDPOINT!;
    const port = process.env.MINIO_PORT ?? '9000';
    const useSsl = process.env.MINIO_USE_SSL === 'true';
    const scheme = useSsl ? 'https' : 'http';
    return {
      bucket: this.bucket,
      key,
      url: `${scheme}://${endpoint}:${port}/${this.bucket}/${key}`,
    };
  }

  private async persistToLocal(key: string, file: Express.Multer.File): Promise<StoredObjectReference> {
    const filePath = path.join(this.uploadsRoot, this.bucket, key.replace(/\//g, path.sep));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, file.buffer);
    return {
      bucket: this.bucket,
      key,
      url: `s3://${this.bucket}/${key}`,
    };
  }
}
