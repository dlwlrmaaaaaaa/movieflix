import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ENV } from '../config/env';

export class R2Service {
  private static client(): S3Client {
    if (!ENV.CLOUDFLARE_R2_ACCOUNT_ID || !ENV.CLOUDFLARE_R2_ACCESS_KEY_ID || !ENV.CLOUDFLARE_R2_SECRET_ACCESS_KEY || !ENV.CLOUDFLARE_R2_BUCKET_NAME) {
      throw new Error('Cloudflare R2 is not configured. Set the CLOUDFLARE_R2_* environment variables.');
    }
    return new S3Client({
      region: 'auto',
      endpoint: `https://${ENV.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: ENV.CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: ENV.CLOUDFLARE_R2_SECRET_ACCESS_KEY },
    });
  }

  static async createMultipartUpload(key: string, mimeType: string) {
    const response = await this.client().send(new CreateMultipartUploadCommand({ Bucket: ENV.CLOUDFLARE_R2_BUCKET_NAME, Key: key, ContentType: mimeType }));
    if (!response.UploadId) throw new Error('R2 did not create an upload ID.');
    return response.UploadId;
  }

  static signUploadPart(key: string, uploadId: string, partNumber: number) {
    return getSignedUrl(this.client(), new UploadPartCommand({ Bucket: ENV.CLOUDFLARE_R2_BUCKET_NAME, Key: key, UploadId: uploadId, PartNumber: partNumber }), { expiresIn: 15 * 60 });
  }

  static async completeMultipartUpload(key: string, uploadId: string, parts: Array<{ partNumber: number; eTag: string }>) {
    await this.client().send(new CompleteMultipartUploadCommand({
      Bucket: ENV.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.sort((a, b) => a.partNumber - b.partNumber).map((part) => ({ PartNumber: part.partNumber, ETag: part.eTag })) },
    }));
  }

  static abortMultipartUpload(key: string, uploadId: string) {
    return this.client().send(new AbortMultipartUploadCommand({ Bucket: ENV.CLOUDFLARE_R2_BUCKET_NAME, Key: key, UploadId: uploadId }));
  }

  static headObject(key: string) {
    return this.client().send(new HeadObjectCommand({ Bucket: ENV.CLOUDFLARE_R2_BUCKET_NAME, Key: key }));
  }

  static signedPlaybackUrl(key: string) {
    return getSignedUrl(this.client(), new GetObjectCommand({ Bucket: ENV.CLOUDFLARE_R2_BUCKET_NAME, Key: key, ResponseContentDisposition: 'inline' }), { expiresIn: 60 * 60 });
  }

  static putObject(key: string, body: string | Uint8Array, mimeType: string) {
    return this.client().send(new PutObjectCommand({ Bucket: ENV.CLOUDFLARE_R2_BUCKET_NAME, Key: key, Body: body, ContentType: mimeType }));
  }

  static deleteObject(key: string) {
    return this.client().send(new DeleteObjectCommand({ Bucket: ENV.CLOUDFLARE_R2_BUCKET_NAME, Key: key }));
  }
}
