import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import {
  ImageStorageAdapter,
  ImageUploadOptions,
  ImageUploadResult,
} from '../../interfaces/image-storage.adapter';

@Injectable()
export class CloudinaryImageAdapter extends ImageStorageAdapter {
  private readonly logger = new Logger(CloudinaryImageAdapter.name);

  constructor(cloudName: string, apiKey: string, apiSecret: string) {
    super();
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  upload(
    file: Buffer,
    options?: ImageUploadOptions,
  ): Promise<ImageUploadResult> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: options?.folder,
          resource_type: 'image',
        },
        (err, result: UploadApiResponse | undefined) => {
          if (err || !result?.secure_url || !result.public_id) {
            this.logger.error(
              `Cloudinary upload failed: ${err?.message ?? 'unknown'}`,
            );
            reject(
              new InternalServerErrorException('Failed to upload image'),
            );
            return;
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );
      stream.end(file);
    });
  }

  async delete(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (err) {
      this.logger.error(
        `Cloudinary delete failed for ${publicId}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      throw new InternalServerErrorException('Failed to delete image');
    }
  }
}
