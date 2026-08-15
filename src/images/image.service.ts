import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  IMAGE_STORAGE_ADAPTER,
  ImageStorageAdapter,
  ImageUploadOptions,
  ImageUploadResult,
} from './interfaces/image-storage.adapter';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class ImageService {
  constructor(
    @Inject(IMAGE_STORAGE_ADAPTER)
    private readonly storage: ImageStorageAdapter,
  ) {}

  async upload(
    file: Express.Multer.File | undefined,
    options?: ImageUploadOptions,
  ): Promise<ImageUploadResult> {
    this.assertValidImage(file);
    return this.storage.upload(file!.buffer, options);
  }

  async delete(publicId: string): Promise<void> {
    if (!publicId?.trim()) return;
    await this.storage.delete(publicId);
  }

  private assertValidImage(file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('file is required (multipart field "file")');
    }
    if (!file.buffer?.length) {
      throw new BadRequestException('Uploaded file is empty');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Image must be 5 MB or smaller');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WEBP images are allowed',
      );
    }
  }
}
