import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import {
  ImageDeliveryVariant,
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
          if (err || !result?.public_id) {
            this.logger.error(
              `Cloudinary upload failed: ${err?.message ?? 'unknown'}`,
            );
            reject(
              new InternalServerErrorException('Failed to upload image'),
            );
            return;
          }
          const publicId = result.public_id;
          resolve({
            publicId,
            url: this.getDeliveryUrl(publicId, options?.variant ?? 'default'),
          });
        },
      );
      stream.end(file);
    });
  }

  async delete(publicId: string): Promise<void> {
    try {
      const result = (await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      })) as { result?: string };

      // "not found" is idempotent success (already gone)
      if (result.result !== 'ok' && result.result !== 'not found') {
        this.logger.error(
          `Cloudinary delete unexpected result for ${publicId}: ${result.result}`,
        );
        throw new InternalServerErrorException('Failed to delete image');
      }
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error(
        `Cloudinary delete failed for ${publicId}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      throw new InternalServerErrorException('Failed to delete image');
    }
  }

  getDeliveryUrl(
    publicId: string,
    variant: ImageDeliveryVariant = 'default',
  ): string {
    const transformation = this.transformationFor(variant);
    return cloudinary.url(publicId, {
      secure: true,
      resource_type: 'image',
      // Separate components: crop (optional) then f_auto / q_auto
      transformation,
    });
  }

  private transformationFor(variant: ImageDeliveryVariant) {
    const optimize = [{ fetch_format: 'auto' }, { quality: 'auto' }];

    if (variant === 'avatar') {
      return [
        { width: 400, height: 400, crop: 'thumb', gravity: 'face' },
        ...optimize,
      ];
    }

    if (variant === 'product') {
      return [{ width: 1200, crop: 'limit' }, ...optimize];
    }

    return optimize;
  }
}
