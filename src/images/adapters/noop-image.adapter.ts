import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ImageStorageAdapter,
  ImageUploadOptions,
  ImageUploadResult,
} from '../interfaces/image-storage.adapter';

/** Used when Cloudinary env vars are missing / placeholders. */
@Injectable()
export class NoOpImageStorageAdapter extends ImageStorageAdapter {
  upload(
    _file: Buffer,
    _options?: ImageUploadOptions,
  ): Promise<ImageUploadResult> {
    throw new ServiceUnavailableException(
      'Image storage is not configured (set CLOUDINARY_* env vars)',
    );
  }

  delete(_publicId: string): Promise<void> {
    throw new ServiceUnavailableException(
      'Image storage is not configured (set CLOUDINARY_* env vars)',
    );
  }
}
