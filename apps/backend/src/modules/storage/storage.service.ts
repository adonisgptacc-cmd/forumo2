import type { Express } from 'express';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Allowed MIME types per upload category and their magic-byte signatures.
// Format: [byteOffset, expectedBytes[]]
type MagicEntry = { offset: number; bytes: number[] };

const IMAGE_SIGNATURES: Record<string, MagicEntry[]> = {
  'image/jpeg': [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/gif': [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }],
  'image/webp': [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }], // RIFF header; full WebP check needs bytes[8-11]=WEBP
};

const KYC_SIGNATURES: Record<string, MagicEntry[]> = {
  ...IMAGE_SIGNATURES,
  'application/pdf': [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
};

function matchesMagic(buf: Buffer, entries: MagicEntry[]): boolean {
  return entries.every(({ offset, bytes }) =>
    bytes.every((b, i) => buf[offset + i] === b),
  );
}

function validateMimeType(
  file: Express.Multer.File,
  allowed: Record<string, MagicEntry[]>,
  label: string,
): void {
  const signatures = allowed[file.mimetype];
  if (!signatures) {
    throw new BadRequestException(
      `${label}: unsupported file type "${file.mimetype}". Allowed: ${Object.keys(allowed).join(', ')}`,
    );
  }
  if (!matchesMagic(file.buffer, signatures)) {
    throw new BadRequestException(
      `${label}: file content does not match declared MIME type "${file.mimetype}"`,
    );
  }
}

/** Strip path separators and non-printable characters from an uploaded filename. */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 128);
}

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
    validateMimeType(file, IMAGE_SIGNATURES, 'Listing image');
    const key = `listings/${listingId}/${Date.now()}-${randomUUID()}-${sanitizeFilename(file.originalname)}`;
    return this.persistFile(key, file);
  }

  async saveMessageAttachment(threadId: string, file: Express.Multer.File): Promise<StoredObjectReference> {
    validateMimeType(file, IMAGE_SIGNATURES, 'Message attachment');
    const key = `messages/${threadId}/${Date.now()}-${randomUUID()}-${sanitizeFilename(file.originalname)}`;
    return this.persistFile(key, file);
  }

  async saveKycDocument(userId: string, file: Express.Multer.File): Promise<StoredObjectReference> {
    validateMimeType(file, KYC_SIGNATURES, 'KYC document');
    const key = `kyc/${userId}/${Date.now()}-${randomUUID()}-${sanitizeFilename(file.originalname)}`;
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
